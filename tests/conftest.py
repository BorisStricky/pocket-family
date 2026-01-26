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

# Set environment variables BEFORE importing app modules
# This is critical because auth.py validates JWT_SECRET on import
os.environ["TEST_MODE"] = "1"
os.environ["JWT_SECRET"] = "test-secret-key-do-not-use-in-production-generate-with-openssl-rand-hex-32"

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
    Placeholder fixture to maintain test structure.
    Environment variables (TEST_MODE and JWT_SECRET) are now set at module import time
    at the top of this file to ensure they're available before auth.py imports.
    """
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


# Async fixtures for async tests (pytest-asyncio)
# Note: These fixtures are specifically for async tests that use httpx.AsyncClient
# The synchronous 'client' fixture above is used by existing synchronous tests

@pytest.fixture
async def test_session(async_engine):
    """
    Async database session for async tests.
    Provides direct async database access for test setup/teardown.
    """
    from sqlalchemy.orm import sessionmaker
    async_session_factory = sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session_factory() as session:
        yield session


@pytest.fixture
async def async_client(override_get_db, test_session):
    """
    Async HTTP client for testing FastAPI endpoints with async/await.
    Used by async tests that need to make HTTP requests.
    Uses the test_session for database operations to ensure data consistency.
    """
    from httpx import AsyncClient, ASGITransport
    from backend.api.app.db import get_db as original_get_db

    # Override get_db to use the test_session
    async def get_db_override():
        yield test_session

    app.dependency_overrides[original_get_db] = get_db_override

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as test_client:
        yield test_client

    # Clean up overrides after test
    if original_get_db in app.dependency_overrides:
        del app.dependency_overrides[original_get_db]


# Test data fixtures for async tests

@pytest.fixture
async def test_user(test_session):
    """Create a test user in the database (async version)."""
    from uuid import uuid4
    from backend.api.app.models import User
    from backend.api.app.auth import hash_password

    user = User(
        id=uuid4(),
        email="test@example.com",
        password_hash=hash_password("testpass123"),
        name="Test User"
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest.fixture
async def test_user2(test_session):
    """Create a second test user for multi-user scenarios (async version)."""
    from uuid import uuid4
    from backend.api.app.models import User
    from backend.api.app.auth import hash_password

    user = User(
        id=uuid4(),
        email="test2@example.com",
        password_hash=hash_password("testpass456"),
        name="Test User 2"
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest.fixture
async def test_tenant(test_session):
    """Create a test tenant (family) (async version)."""
    from uuid import uuid4
    from datetime import datetime
    from backend.api.app.models import Tenant

    tenant = Tenant(
        id=uuid4(),
        name="Test Family",
        created_at=datetime.utcnow()
    )
    test_session.add(tenant)
    await test_session.commit()
    await test_session.refresh(tenant)
    return tenant


@pytest.fixture
async def test_tenant2(test_session):
    """Create a second test tenant for multi-tenant scenarios (async version)."""
    from uuid import uuid4
    from datetime import datetime
    from backend.api.app.models import Tenant

    tenant = Tenant(
        id=uuid4(),
        name="Test Family 2",
        created_at=datetime.utcnow()
    )
    test_session.add(tenant)
    await test_session.commit()
    await test_session.refresh(tenant)
    return tenant


@pytest.fixture
async def test_membership(test_session, test_user, test_tenant):
    """Create an active membership linking test_user to test_tenant as OWNER (async version)."""
    from uuid import uuid4
    from backend.api.app.models import Membership, MembershipRole, MembershipStatus

    membership = Membership(
        id=uuid4(),
        tenant_id=test_tenant.id,
        user_id=test_user.id,
        role=MembershipRole.OWNER,
        status=MembershipStatus.ACTIVE
    )
    test_session.add(membership)
    await test_session.commit()
    await test_session.refresh(membership)
    return membership


@pytest.fixture
async def test_membership2(test_session, test_user, test_tenant2):
    """Create an active membership linking test_user to test_tenant2 as MEMBER (async version)."""
    from uuid import uuid4
    from backend.api.app.models import Membership, MembershipRole, MembershipStatus

    membership = Membership(
        id=uuid4(),
        tenant_id=test_tenant2.id,
        user_id=test_user.id,
        role=MembershipRole.MEMBER,
        status=MembershipStatus.ACTIVE
    )
    test_session.add(membership)
    await test_session.commit()
    await test_session.refresh(membership)
    return membership


@pytest.fixture
def auth_headers(test_user, test_tenant):
    """Generate authorization headers with JWT token for test_user and test_tenant (async version)."""
    from backend.api.app.auth import create_access_token

    access_token = create_access_token(
        token_payload={
            "sub": str(test_user.id),
            "email": test_user.email,
            "tenant_id": str(test_tenant.id)
        }
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def auth_headers_tenant2(test_user, test_tenant2):
    """Generate authorization headers with JWT token for test_user and test_tenant2 (async version)."""
    from backend.api.app.auth import create_access_token

    access_token = create_access_token(
        token_payload={
            "sub": str(test_user.id),
            "email": test_user.email,
            "tenant_id": str(test_tenant2.id)
        }
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
async def test_account(test_session, test_user):
    """Create a test account owned by test_user (async version)."""
    from uuid import uuid4
    from datetime import datetime
    from decimal import Decimal
    from backend.api.app.models import Account, AccountType, Currency

    account = Account(
        id=uuid4(),
        user_id=test_user.id,
        name="Test Checking Account",
        type=AccountType.DEBIT,
        currency=Currency.BRL,
        balance=Decimal("1000.00"),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    test_session.add(account)
    await test_session.commit()
    await test_session.refresh(account)
    return account


@pytest.fixture
async def test_account2(test_session, test_user2):
    """Create a test account owned by test_user2 (async version)."""
    from uuid import uuid4
    from datetime import datetime
    from decimal import Decimal
    from backend.api.app.models import Account, AccountType, Currency

    account = Account(
        id=uuid4(),
        user_id=test_user2.id,
        name="Test Cash Account",
        type=AccountType.CASH,
        currency=Currency.BRL,
        balance=Decimal("500.00"),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    test_session.add(account)
    await test_session.commit()
    await test_session.refresh(account)
    return account


@pytest.fixture
async def test_category(test_session, test_tenant):
    """Create a test expense category for test_tenant (async version)."""
    from uuid import uuid4
    from datetime import datetime
    from backend.api.app.models import Category, CategoryKind

    category = Category(
        id=uuid4(),
        tenant_id=test_tenant.id,
        name="Food",
        kind=CategoryKind.EXPENSE,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    test_session.add(category)
    await test_session.commit()
    await test_session.refresh(category)
    return category
