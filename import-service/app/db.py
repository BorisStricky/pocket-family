# import-service/app/db.py
# Synchronous SQLAlchemy engine for the Celery worker.
#
# Celery tasks run in regular synchronous Python, so we cannot use the
# asyncpg + async session that the main FastAPI backend uses. We declare
# lightweight Core Table objects instead of full ORM models to avoid
# duplicating the complex SQLModel/SAEnum type setup.
#
# PostgreSQL will cast the string literals we pass for enum columns
# (e.g. "expense", "manual") to their respective enum types automatically,
# so we can use String columns on our Python side for simplicity.
#
# DB_INSTANCE controls the connection strategy (mirrors the main backend's db.py):
#   "local" (default)        → DATABASE_URL from settings (password auth)
#   "aws_aurora_serverless"  → IAM auth tokens via boto3 (no static password, SSL required)

import logging
import os
from contextlib import contextmanager
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    create_engine,
    event,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import sessionmaker

from .config import settings

logger = logging.getLogger(__name__)

DB_INSTANCE: str = os.getenv("DB_INSTANCE", "local")


def _build_aurora_engine():
    """Build a sync psycopg2 engine for Aurora Serverless v2 with IAM auth.

    Mirrors the async approach in the main backend's db.py but adapted for the
    sync psycopg2 driver that Celery tasks require (no asyncio context available).
    """
    # Lazy-import boto3 — local dev never needs it installed
    import boto3

    required_vars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_NAME", "AWS_REGION"]
    missing_vars = [v for v in required_vars if not os.getenv(v)]
    if missing_vars:
        raise ValueError(
            f"DB_INSTANCE=aws_aurora_serverless requires env vars: {', '.join(missing_vars)}"
        )

    database_host = os.environ["DB_HOST"]
    database_port = int(os.environ["DB_PORT"])
    database_user = os.environ["DB_USER"]
    database_name = os.environ["DB_NAME"]
    aws_region = os.environ["AWS_REGION"]

    rds_client = boto3.client("rds", region_name=aws_region)

    # Placeholder password replaced per-connection by the do_connect event below.
    aurora_engine = create_engine(
        f"postgresql+psycopg2://{database_user}:placeholder"
        f"@{database_host}:{database_port}/{database_name}",
        pool_pre_ping=True,
        # Recycle connections before the 15-min IAM token expiry.
        pool_recycle=600,
        # IAM auth requires SSL — Aurora rejects non-SSL IAM connections.
        connect_args={"sslmode": "require"},
    )

    @event.listens_for(aurora_engine, "do_connect")
    def inject_iam_token(dialect, connection_record, cargs, cparams):
        """Replace placeholder password with a fresh IAM auth token per connection."""
        cparams["password"] = rds_client.generate_db_auth_token(
            DBHostname=database_host,
            Port=database_port,
            DBUsername=database_user,
            Region=aws_region,
        )

    logger.info(
        "Aurora Serverless sync engine created for %s:%s/%s (IAM auth, SSL enabled)",
        database_host, database_port, database_name,
    )
    return aurora_engine


if DB_INSTANCE == "local":
    # Local / traditional path: use DATABASE_URL directly.
    engine = create_engine(settings.database_url, pool_pre_ping=True)
elif DB_INSTANCE == "aws_aurora_serverless":
    engine = _build_aurora_engine()
else:
    raise ValueError(
        f"Unknown DB_INSTANCE: {DB_INSTANCE!r}. Expected 'local' or 'aws_aurora_serverless'."
    )

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

metadata = MetaData()

# Minimal table reference for writing new transactions.
# Only the columns the import task needs to set are listed here.
transaction_table = Table(
    "transaction",
    metadata,
    Column("id", PGUUID(as_uuid=True), primary_key=True),
    Column("tenant_id", PGUUID(as_uuid=True), nullable=False),
    Column("account_id", PGUUID(as_uuid=True), nullable=True),
    Column("category_id", PGUUID(as_uuid=True), nullable=True),
    Column("transaction_date", Date, nullable=False),
    # PostgreSQL enum column — psycopg2 sends the string and PG casts it
    Column("transaction_type", String, nullable=False),
    Column("amount", Numeric(18, 2), nullable=False),
    Column("currency", String, nullable=False),
    Column("created_by", PGUUID(as_uuid=True), nullable=False),
    Column("description", String, nullable=True),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    Column("reconciled", Boolean, default=False),
    Column("source", String, nullable=False),
)

# Minimal table reference for updating the account balance after import.
account_table = Table(
    "account",
    metadata,
    Column("id", PGUUID(as_uuid=True), primary_key=True),
    Column("balance", Numeric(18, 2), nullable=False),
)

# Minimal table reference for the ImportJob row created by the API before
# dispatching this task. The worker transitions status PENDING → STARTED → DONE
# (or FAILED on exception) and records imported_rows + completed_at.
import_job_table = Table(
    "importjob",
    metadata,
    Column("id", PGUUID(as_uuid=True), primary_key=True),
    # Postgres enum column — psycopg2 sends the uppercase label string
    Column("status", String, nullable=False),
    Column("imported_rows", Integer, nullable=False),
    Column("error_message", String, nullable=True),
    Column("updated_at", DateTime, nullable=False),
    Column("completed_at", DateTime, nullable=True),
)


@contextmanager
def get_session():
    """Yield a synchronous DB session that automatically closes on exit."""
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
