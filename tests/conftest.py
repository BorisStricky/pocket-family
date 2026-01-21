# tests/conftest.py
# Purpose:
# - Provide a FastAPI TestClient bound to the app in backend.api.app.main
# - Override the app's async DB engine and dependency (get_db) to use a local SQLite file
# - Expose a synchronous SQLModel Session for direct DB manipulations in tests
#
# Notes:
# - The application uses SQLAlchemy AsyncSession and create_async_engine (Postgres by default).
#   For tests we point both an async engine (for the app) and a sync engine (for direct queries)
#   at the same SQLite file, so state is shared.
# - We enable TEST_MODE=1 so /auth endpoints return raw refresh_token in JSON as required by tests.

import os
import pytest
from fastapi.testclient import TestClient

from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Import app and database module from this repository package
import sys
from pathlib import Path
# Ensure repo root is on sys.path for 'backend' package imports when running pytest from repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.api.app.main import app
import backend.api.app.db as database
from backend.api.app import models  # noqa: F401  (ensures models are imported so metadata is complete)
import backend.api.app.main as main
import backend.api.app.routers.auth as auth_router


@pytest.fixture(scope="session", autouse=True)
def set_test_mode_env():
    """
    Ensure endpoints return raw refresh_token for tests that assert it.
    The code checks app.auth.is_test_mode() which reads TEST_MODE env var.
    """
    os.environ["TEST_MODE"] = "1"
    yield


@pytest.fixture(scope="session")
def sqlite_path(tmp_path_factory) -> str:
    """
    Create a temporary file path for the test database.
    Using a file-backed SQLite ensures both async and sync engines see the same data.
    """
    db_dir = tmp_path_factory.mktemp("data")
    return str(db_dir / "test_auth.db")


@pytest.fixture(scope="session")
def sync_engine(sqlite_path):
    """
    Synchronous engine bound to the same SQLite file.
    We create tables here synchronously to avoid managing an event loop in fixtures.
    """
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(scope="session")
def async_engine(sqlite_path, sync_engine):
    """
    Async engine used by the FastAPI app via dependency override.
    Depends on sync_engine so tables are created before use.
    """
    engine = create_async_engine(f"sqlite+aiosqlite:///{sqlite_path}", echo=False, future=True)
    return engine


@pytest.fixture(autouse=True)
def override_get_db(monkeypatch, async_engine):
    """
    Override backend.api.app.db.engine and backend.api.app.db.get_db
    to use the async SQLite engine in tests.
    Applied automatically for every test.
    """
    async_session_factory = sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)

    # Ensure any code that uses database.SessionLocal yields sessions bound to the sqlite async engine
    monkeypatch.setattr(database, "SessionLocal", async_session_factory)
    # Also advertise the test DB URL via env to defensive code paths (if any)
    try:
        os.environ["DATABASE_URL"] = str(async_engine.url)
    except Exception:
        pass

    async def get_db_override():
        async with async_session_factory() as session:
            yield session

    # Monkeypatch the engine and get_db used by the application code
    monkeypatch.setattr(database, "engine", async_engine)
    monkeypatch.setattr(database, "get_db", get_db_override)

    # Ensure app startup does not try to connect to the default Postgres service.
    # Override init_db used by backend.api.app.main to a no-op since tables are created via sync_engine.
    async def init_db_override():
        return None
    monkeypatch.setattr(main, "init_db", init_db_override)

    # Apply FastAPI dependency overrides so routes use the test session
    app.dependency_overrides[database.get_db] = get_db_override
    app.dependency_overrides[auth_router.get_db] = get_db_override

    yield


@pytest.fixture
def client(override_get_db):
    """
    FastAPI TestClient using the app from backend.api.app.main.
    Depends on override_get_db so DB overrides are in place before startup.
    """
    return TestClient(app)


@pytest.fixture
def db_session(sync_engine):
    """
    Provide a direct synchronous DB session for test helpers that need DB mutations/queries.
    Shares the same SQLite file with the async app engine.
    """
    with Session(sync_engine) as s:
        yield s
