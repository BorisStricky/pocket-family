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
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import sessionmaker

from .config import settings

# Single sync engine shared across all worker tasks in this process.
# pool_pre_ping detects stale connections before each use.
engine = create_engine(settings.database_url, pool_pre_ping=True)

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
