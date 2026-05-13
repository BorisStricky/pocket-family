import os
import ssl as ssl_module
import logging
from typing import AsyncGenerator, Optional

from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, AsyncEngine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine import Engine
from sqlalchemy import create_engine as _create_sync_engine, event

# DB helpers
# - Public names (DATABASE_URL, engine, SessionLocal, get_db, init_db) must remain for compatibility.
# - Use create_async_engine for application runtime; tests may override SessionLocal & engine via monkeypatch.
# - DB_INSTANCE env var selects the connection strategy:
#     "local" (default)            → uses DATABASE_URL directly (standard PostgreSQL with password)
#     "aws_aurora_serverless"      → uses IAM auth tokens via boto3 (no static password, SSL required)

log = logging.getLogger(__name__)

# DB_INSTANCE controls which connection strategy is used.
# Downstream code (routers, deps, tests) is agnostic — they import engine/SessionLocal/get_db as before.
DB_INSTANCE: str = os.getenv("DB_INSTANCE", "local")


def _build_aurora_engine() -> AsyncEngine:
    """Build an async engine for Aurora Serverless v2 with IAM database authentication.

    Instead of a static password, each new physical connection gets a fresh IAM auth token
    generated via boto3. Tokens expire after ~15 minutes, so we:
      - attach a ``do_connect`` event that injects a fresh token per-connection
      - set ``pool_recycle=600`` to force connection turnover before expiry
      - require SSL (mandatory for IAM auth)

    Required env vars: DB_HOST, DB_PORT, DB_USER, DB_NAME, AWS_REGION.

    Returns:
        AsyncEngine bound to the Aurora cluster with IAM token injection.

    Raises:
        ValueError: if any required environment variable is missing.
    """
    # Lazy-import boto3 so local dev never needs it installed
    import boto3

    # Validate all required env vars upfront — fail fast at startup, not on first query
    required_vars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_NAME", "AWS_REGION"]
    missing_vars = [variable for variable in required_vars if not os.getenv(variable)]
    if missing_vars:
        raise ValueError(
            f"DB_INSTANCE=aws_aurora_serverless requires these env vars: {', '.join(missing_vars)}"
        )

    # DB_HOST is assumed to be the Aurora **cluster (writer) endpoint**.
    # This single engine currently handles both reads and writes — the reader
    # endpoint is not used. Fine at current scale; revisit when read load grows.
    # #hardening — future: route reads to the reader endpoint via a custom
    # Session.get_bind() (auto read/write splitting) so replicas earn their keep.
    database_host = os.environ["DB_HOST"]
    database_port = int(os.environ["DB_PORT"])
    database_user = os.environ["DB_USER"]
    database_name = os.environ["DB_NAME"]
    aws_region = os.environ["AWS_REGION"]

    rds_client = boto3.client("rds", region_name=aws_region)

    # Build a DSN with a placeholder password. The real IAM token is injected
    # per-connection via the do_connect event below.
    database_url = (
        f"postgresql+asyncpg://{database_user}:placeholder"
        f"@{database_host}:{database_port}/{database_name}"
    )

    # SSL context for the Aurora connection. IAM auth requires SSL —
    # Aurora rejects non-SSL IAM auth attempts. The default context
    # trusts the system CA store, which includes AWS RDS root CAs.
    ssl_context = ssl_module.create_default_context()

    aurora_engine = create_async_engine(
        database_url,
        echo=os.getenv("DB_ECHO", "False").lower() in ("1", "true", "yes"),
        future=True,
        pool_pre_ping=True,
        # Recycle connections before the 15-min IAM token expiry.
        # 600 seconds (10 min) gives a comfortable safety margin.
        pool_recycle=600,
        connect_args={"ssl": ssl_context},
    )

    # Inject a fresh IAM auth token on every new physical connection.
    # SQLAlchemy 2.x fires do_connect on the sync engine proxy that
    # underlies the async engine — this is the documented approach for asyncpg.
    @event.listens_for(aurora_engine.sync_engine, "do_connect")
    def inject_iam_token(dialect, connection_record, cargs, cparams):
        """Replace the placeholder password with a fresh IAM auth token.

        This fires before asyncpg establishes the TCP connection, so we can
        safely mutate cparams here. Each new connection gets a freshly generated
        token, ensuring tokens never expire mid-session.
        """
        fresh_token = rds_client.generate_db_auth_token(
            DBHostname=database_host,
            Port=database_port,
            DBUsername=database_user,
            Region=aws_region,
        )
        cparams["password"] = fresh_token

    log.info(
        "Aurora Serverless engine created for %s:%s/%s (IAM auth, SSL enabled)",
        database_host,
        database_port,
        database_name,
    )
    return aurora_engine


# ---------------------------------------------------------------------------
# Engine creation dispatch — pick the right strategy based on DB_INSTANCE
# ---------------------------------------------------------------------------

if DB_INSTANCE == "local":
    # Local / traditional path: use DATABASE_URL directly (unchanged from original)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@db:5432/expense_dev",
    )
    async_engine: AsyncEngine = create_async_engine(
        DATABASE_URL,
        echo=os.getenv("DB_ECHO", "False").lower() in ("1", "true", "yes"),
        future=True,
        pool_pre_ping=True,
    )

elif DB_INSTANCE == "aws_aurora_serverless":
    # Aurora Serverless v2 with IAM database authentication
    async_engine = _build_aurora_engine()
    # Keep DATABASE_URL exported for any code that reads it (e.g. logging)
    DATABASE_URL = str(async_engine.url)

else:
    raise ValueError(
        f"Unknown DB_INSTANCE value: {DB_INSTANCE!r}. "
        "Expected 'local' or 'aws_aurora_serverless'."
    )

# ---------------------------------------------------------------------------
# Common module-level exports — identical regardless of connection strategy
# ---------------------------------------------------------------------------

# Public alias for backwards compatibility (tests and other modules may import `engine`).
engine = async_engine

# Async session factory (named AsyncSessionLocal internally)
AsyncSessionLocal = sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)

# Public alias: keep SessionLocal exported so tests can monkeypatch it.
SessionLocal = AsyncSessionLocal

# -- Test helper: synchronous engine factory used by pytest setup --
# Test helper: used by pytest fixtures to create a synchronous engine that shares the same file DB.
# Keep this helper lightweight and only import sqlalchemy.create_engine inside the function.
_test_sync_engine: Optional[Engine] = None

def create_sync_engine_for_tests(sqlite_url: str) -> Engine:
    """Create a synchronous SQLAlchemy engine useful for test fixtures that need sync access.

    The return value can be used in tests to create tables synchronously (e.g. SQLModel.metadata.create_all).
    This helper stores the created engine in-module so it can be retrieved by get_sync_engine().

    Args:
        sqlite_url: DSN for sqlite e.g. "sqlite:///./test.db" or "sqlite:///:memory:"

    Returns:
        Engine: a synchronous SQLAlchemy Engine instance.
    """
    global _test_sync_engine
    _test_sync_engine = _create_sync_engine(sqlite_url, connect_args={"check_same_thread": False})
    return _test_sync_engine


def get_sync_engine() -> Optional[Engine]:
    """Optional accessor for the synchronous test engine if one was created.

    Returns:
        Optional[Engine]: the sync Engine created by create_sync_engine_for_tests, or None.
    """
    return _test_sync_engine


# Dependency: yields an AsyncSession for FastAPI endpoints.
# Tests override `SessionLocal` (and may override `engine`) in tests/conftest.py.
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Async dependency that yields a DB session for request handlers.

    Yields:
        AsyncSession: an async SQLAlchemy session bound to the configured engine.

    Notes:
        - Tests often override `SessionLocal` and `engine` using monkeypatch in tests/conftest.py.
        - Keep this function lightweight and use `expire_on_commit=False` to avoid detached object surprises.
    """
    async with SessionLocal() as session:
        yield session


# Initialize DB schema (dev/test only). Production deployments should use Alembic migrations instead.
async def init_db() -> None:
    """Create DB tables from SQLModel metadata.

    This is appropriate for development and tests. Production deploys should prefer Alembic migrations.
    The function uses the async engine to run create_all synchronously via run_sync.

    Raises:
        Exception: propagates underlying DB connection errors during startup.
    """
    async with async_engine.begin() as conn:
        # use SQLModel.metadata.create_all(conn) via run_sync to create tables
        await conn.run_sync(SQLModel.metadata.create_all)
