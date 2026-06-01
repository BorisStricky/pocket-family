import asyncio
import os
import ssl as ssl_module
from logging.config import fileConfig

from sqlalchemy import event, pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
fileConfig(config.config_file_name)

# Add your model's MetaData object here for 'autogenerate' support
# Import the SQLModel metadata from the application models
# Make sure the app package is importable when running alembic
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))
from app.models import SQLModel  # type: ignore
target_metadata = SQLModel.metadata  # type: ignore

# DB_INSTANCE selects the connection strategy (mirrors backend/api/app/db.py):
#   "local" (default)        → DATABASE_URL directly (password auth)
#   "aws_aurora_serverless"  → IAM auth tokens via boto3 (no static password, SSL required)
DB_INSTANCE = os.getenv("DB_INSTANCE", "local")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@db:5432/expense_dev")


def _build_aurora_engine():
    """Build an async engine for Aurora Serverless v2 with IAM database auth.

    Mirrors backend/api/app/db.py:_build_aurora_engine. Alembic env.py needs the
    same IAM token injection because Aurora Free Plan rejects static-password
    connections — env.py is invoked both from `docker compose exec backend ...`
    (local prod, where DB_INSTANCE=local) and from the daily demo-reset ECS task
    (AWS, where DB_INSTANCE=aws_aurora_serverless).
    """
    import boto3

    required_vars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_NAME", "AWS_REGION"]
    missing_vars = [variable for variable in required_vars if not os.getenv(variable)]
    if missing_vars:
        raise ValueError(
            f"DB_INSTANCE=aws_aurora_serverless requires these env vars: {', '.join(missing_vars)}"
        )

    database_host = os.environ["DB_HOST"]
    database_port = int(os.environ["DB_PORT"])
    database_user = os.environ["DB_USER"]
    database_name = os.environ["DB_NAME"]
    aws_region = os.environ["AWS_REGION"]

    rds_client = boto3.client("rds", region_name=aws_region)
    ssl_context = ssl_module.create_default_context()

    aurora_engine = create_async_engine(
        f"postgresql+asyncpg://{database_user}:placeholder"
        f"@{database_host}:{database_port}/{database_name}",
        poolclass=pool.NullPool,
        connect_args={"ssl": ssl_context},
    )

    @event.listens_for(aurora_engine.sync_engine, "do_connect")
    def inject_iam_token(dialect, connection_record, cargs, cparams):
        cparams["password"] = rds_client.generate_db_auth_token(
            DBHostname=database_host,
            Port=database_port,
            DBUsername=database_user,
            Region=aws_region,
        )

    return aurora_engine


def _make_engine():
    if DB_INSTANCE == "aws_aurora_serverless":
        return _build_aurora_engine()
    return create_async_engine(DATABASE_URL, poolclass=pool.NullPool)


def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection):
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    """Run migrations in 'online' mode using an async engine."""
    connectable = _make_engine()

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
