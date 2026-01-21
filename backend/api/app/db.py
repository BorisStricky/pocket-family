import os
import logging
from typing import AsyncGenerator, Optional

from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, AsyncEngine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine import Engine
from sqlalchemy import create_engine as _create_sync_engine

# DB helpers
# - Public names (DATABASE_URL, engine, SessionLocal, get_db, init_db) must remain for compatibility.
# - Use create_async_engine for application runtime; tests may override SessionLocal & engine via monkeypatch.

log = logging.getLogger(__name__)

# Public: DATABASE_URL (may be overridden in test envs)
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@db:5432/expense_dev",
)

# Create async engine for application runtime. Keep `engine` name exported for backward compatibility.
# NOTE: In production prefer connection params tuned for your cloud DB (pool size, timeouts).
async_engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("DB_ECHO", "False").lower() in ("1", "true", "yes"),
    future=True,
    pool_pre_ping=True,
)

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
