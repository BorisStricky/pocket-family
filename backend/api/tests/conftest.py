"""
Shared pytest fixtures for backend API tests.

This conftest provides two separate test infrastructure strategies:

1. **Async in-memory fixtures** (for async tests like test_budget_endpoints, test_seed_defaults,
   test_accounts_endpoints):
   - Uses an in-memory SQLite database with StaticPool for per-test isolation
   - Provides `async_session` and `async_client` (httpx.AsyncClient)
   - Each test gets a fresh database with all tables created/dropped

2. **Sync file-backed fixtures** (for sync tests like test_auth_endpoints, test_account_crud,
   test_category_crud, test_membership_crud, test_tenant_crud, test_transaction_crud,
   test_account_share_crud):
   - Uses a file-backed SQLite database shared across the session
   - Provides `client` (FastAPI TestClient) and `db_session` (sync Session)
   - Tests share state across the session (idempotent via helpers.signup_and_auth)

The two strategies are independent and do not interfere with each other.
"""

import os

# Set environment variables BEFORE importing app modules.
# auth.py validates JWT_SECRET at import time so it must exist first.
# DATABASE_URL must use aiosqlite so the eager engine creation in app.db
# does not attempt to import asyncpg (which is not installed in test env).
os.environ.setdefault("JWT_SECRET", "test-secret-key-do-not-use-in-production")
os.environ.setdefault("TEST_MODE", "1")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import datetime
from uuid import uuid4

from httpx import AsyncClient, ASGITransport
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine, Session
from fastapi.testclient import TestClient

from app.models import (
    User,
    Tenant,
    Membership,
    Account,
    AccountShare,
    Category,
    Transaction,
    Budget,
    BudgetCategory,
    MembershipRole,
    MembershipStatus,
    AccountType,
    CategoryKind,
    Currency,
    ShareVisibility,
    TransactionSource,
)
from app.auth import hash_password, create_access_token
from app.deps import get_db
from app.main import app
import app.db as database
import app.main as main_module
import app.routers.auth as auth_router


# =====================================================================
# Environment setup
# =====================================================================

@pytest.fixture(scope="session", autouse=True)
def set_test_mode_environment():
    """Set TEST_MODE environment variable for the entire test session.

    This enables returning refresh tokens in API responses, which is
    necessary for testing the authentication flow end-to-end.
    """
    os.environ["TEST_MODE"] = "1"
    yield
    del os.environ["TEST_MODE"]


# =====================================================================
# STRATEGY 1: Async in-memory SQLite fixtures
# Used by: test_budget_endpoints, test_seed_defaults, test_accounts_endpoints
# =====================================================================

# In-memory SQLite database URL for test isolation
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def async_session():
    """Create a fresh in-memory SQLite database session for each test.

    Uses StaticPool to keep the in-memory database alive for the
    duration of the test. Tables are created before and dropped after
    each test to ensure complete isolation between tests.
    """
    test_engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Enable foreign key enforcement in SQLite (off by default).
    # Without this, ON DELETE CASCADE constraints are silently ignored.
    @event.listens_for(test_engine.sync_engine, "connect")
    def enable_sqlite_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Create all tables defined in SQLModel metadata
    async with test_engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    # Create an async session factory bound to the test engine
    test_session_factory = sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with test_session_factory() as session:
        yield session

    # Teardown: drop all tables to prevent state leakage
    async with test_engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.drop_all)

    await test_engine.dispose()


@pytest_asyncio.fixture
async def async_client(async_session: AsyncSession):
    """Create a FastAPI test client with the database session overridden.

    All API calls made through this client use the in-memory test
    database instead of the production database.
    """
    async def override_get_db():
        yield async_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as test_client:
        yield test_client

    app.dependency_overrides.clear()


# =====================================================================
# STRATEGY 2: Sync file-backed SQLite fixtures
# Used by: test_auth_endpoints, test_account_crud, test_category_crud,
#          test_membership_crud, test_tenant_crud, test_transaction_crud,
#          test_account_share_crud
# =====================================================================

@pytest.fixture(scope="session")
def sqlite_path(tmp_path_factory) -> str:
    """Create a temporary file path for the sync test database.

    Using a file-backed SQLite ensures both async and sync engines see
    the same data. This is needed because the FastAPI app uses async
    sessions while direct test DB queries use sync sessions.
    """
    database_directory = tmp_path_factory.mktemp("data")
    return str(database_directory / "test_auth.db")


@pytest.fixture(scope="session")
def sync_engine(sqlite_path):
    """Synchronous engine bound to the file-backed SQLite.

    We create tables here synchronously to avoid managing an event loop
    in session-scoped fixtures.
    """
    engine = create_engine(
        f"sqlite:///{sqlite_path}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(scope="session")
def file_async_engine(sqlite_path, sync_engine):
    """Async engine used by the FastAPI app for sync tests via dependency override.

    Depends on sync_engine so tables are guaranteed to be created before use.
    Points at the same file-backed SQLite as the sync engine.
    """
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{sqlite_path}",
        echo=False,
        future=True,
    )
    return engine


@pytest.fixture
def override_get_db_for_sync(monkeypatch, file_async_engine):
    """Override the app's database engine and get_db dependency for sync tests.

    This is NOT autouse -- only sync test fixtures (client, db_session) depend
    on it so it does not interfere with the async in-memory test strategy.
    """
    file_async_session_factory = sessionmaker(
        bind=file_async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Point the app's SessionLocal at the file-backed async engine
    monkeypatch.setattr(database, "SessionLocal", file_async_session_factory)

    # Advertise the test DB URL via env for any defensive code paths
    try:
        os.environ["DATABASE_URL"] = str(file_async_engine.url)
    except Exception:
        pass

    async def get_db_override():
        async with file_async_session_factory() as session:
            yield session

    # Monkeypatch engine and get_db used by application code
    monkeypatch.setattr(database, "engine", file_async_engine)
    monkeypatch.setattr(database, "get_db", get_db_override)

    # Prevent app startup from connecting to Postgres
    async def init_db_override():
        return None
    monkeypatch.setattr(main_module, "init_db", init_db_override)

    # Apply FastAPI dependency overrides so routes use the test session
    app.dependency_overrides[database.get_db] = get_db_override
    app.dependency_overrides[auth_router.get_db] = get_db_override

    yield


@pytest.fixture
def client(override_get_db_for_sync):
    """Synchronous FastAPI TestClient for sync tests.

    Depends on override_get_db_for_sync to ensure the app uses the
    file-backed SQLite test database.
    """
    return TestClient(app)


@pytest.fixture
def db_session(sync_engine, override_get_db_for_sync):
    """Direct synchronous DB session for test helpers that need DB mutations/queries.

    Shares the same SQLite file with the async app engine so changes
    made through the sync session are visible to the FastAPI app.
    """
    with Session(sync_engine) as session:
        yield session


# =====================================================================
# Async data fixtures (used by async tests: budgets, seed, accounts_endpoints)
# =====================================================================

# ---------------------
# User fixtures
# ---------------------

@pytest_asyncio.fixture
async def test_user(async_session: AsyncSession) -> User:
    """Create a test user with a known email and password hash.

    Returns the User model instance after committing to the database.
    """
    user = User(
        email="testowner@example.com",
        password_hash=hash_password("testpassword123"),
        name="Test Owner",
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user2(async_session: AsyncSession) -> User:
    """Create a second test user for multi-user scenarios.

    Used by test_accounts_endpoints for cross-user account sharing tests.
    """
    user = User(
        id=uuid4(),
        email="test2@example.com",
        password_hash=hash_password("testpass456"),
        name="Test User 2",
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def member_user(async_session: AsyncSession) -> User:
    """Create a second user to test MEMBER role permissions.

    This user will have MEMBER role (not OWNER) for authorization tests.
    """
    user = User(
        email="testmember@example.com",
        password_hash=hash_password("testpassword123"),
        name="Test Member",
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def viewer_user(async_session: AsyncSession) -> User:
    """Create a third user to test VIEWER role permissions.

    This user will have VIEWER role (read-only) for authorization tests.
    """
    user = User(
        email="testviewer@example.com",
        password_hash=hash_password("testpassword123"),
        name="Test Viewer",
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


# ---------------------
# Tenant fixtures
# ---------------------

@pytest_asyncio.fixture
async def test_tenant(async_session: AsyncSession) -> Tenant:
    """Create a primary test tenant (family) for budget tests."""
    tenant = Tenant(name="Test Family")
    async_session.add(tenant)
    await async_session.commit()
    await async_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def test_tenant2(async_session: AsyncSession) -> Tenant:
    """Create a second test tenant for multi-tenant scenarios.

    Used by test_accounts_endpoints for cross-tenant sharing tests.
    """
    tenant = Tenant(
        id=uuid4(),
        name="Test Family 2",
        created_at=datetime.utcnow(),
    )
    async_session.add(tenant)
    await async_session.commit()
    await async_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def other_tenant(async_session: AsyncSession) -> Tenant:
    """Create a separate tenant for multi-tenant isolation tests.

    Used to verify that data from one tenant is not accessible
    from another tenant's context.
    """
    tenant = Tenant(name="Other Family")
    async_session.add(tenant)
    await async_session.commit()
    await async_session.refresh(tenant)
    return tenant


# ---------------------
# Membership fixtures
# ---------------------

@pytest_asyncio.fixture
async def test_membership(
    async_session: AsyncSession, test_user: User, test_tenant: Tenant
) -> Membership:
    """Create an active OWNER membership linking test_user to test_tenant.

    Used by test_accounts_endpoints tests that need a basic user+tenant context.
    """
    membership = Membership(
        id=uuid4(),
        tenant_id=test_tenant.id,
        user_id=test_user.id,
        role=MembershipRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    async_session.add(membership)
    await async_session.commit()
    await async_session.refresh(membership)
    return membership


@pytest_asyncio.fixture
async def test_membership2(
    async_session: AsyncSession, test_user: User, test_tenant2: Tenant
) -> Membership:
    """Create an active MEMBER membership linking test_user to test_tenant2.

    Used by test_accounts_endpoints for cross-tenant sharing tests.
    """
    membership = Membership(
        id=uuid4(),
        tenant_id=test_tenant2.id,
        user_id=test_user.id,
        role=MembershipRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    async_session.add(membership)
    await async_session.commit()
    await async_session.refresh(membership)
    return membership


@pytest_asyncio.fixture
async def owner_membership(
    async_session: AsyncSession, test_user: User, test_tenant: Tenant
) -> Membership:
    """Create an OWNER membership linking test_user to test_tenant.

    OWNER role has full CRUD permissions on budgets.
    """
    membership = Membership(
        tenant_id=test_tenant.id,
        user_id=test_user.id,
        role=MembershipRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    async_session.add(membership)
    await async_session.commit()
    await async_session.refresh(membership)
    return membership


@pytest_asyncio.fixture
async def member_membership(
    async_session: AsyncSession, member_user: User, test_tenant: Tenant
) -> Membership:
    """Create a MEMBER membership linking member_user to test_tenant.

    MEMBER role can read but not create/update/delete budgets.
    """
    membership = Membership(
        tenant_id=test_tenant.id,
        user_id=member_user.id,
        role=MembershipRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    async_session.add(membership)
    await async_session.commit()
    await async_session.refresh(membership)
    return membership


@pytest_asyncio.fixture
async def viewer_membership(
    async_session: AsyncSession, viewer_user: User, test_tenant: Tenant
) -> Membership:
    """Create a VIEWER membership linking viewer_user to test_tenant.

    VIEWER role can read but not create/update/delete budgets.
    """
    membership = Membership(
        tenant_id=test_tenant.id,
        user_id=viewer_user.id,
        role=MembershipRole.VIEWER,
        status=MembershipStatus.ACTIVE,
    )
    async_session.add(membership)
    await async_session.commit()
    await async_session.refresh(membership)
    return membership


@pytest_asyncio.fixture
async def other_tenant_owner(
    async_session: AsyncSession, other_tenant: Tenant
) -> tuple:
    """Create a user and OWNER membership for the other_tenant.

    Returns a tuple of (User, Membership) for cross-tenant tests.
    """
    user = User(
        email="otherowner@example.com",
        password_hash=hash_password("testpassword123"),
        name="Other Owner",
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)

    membership = Membership(
        tenant_id=other_tenant.id,
        user_id=user.id,
        role=MembershipRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    async_session.add(membership)
    await async_session.commit()
    await async_session.refresh(membership)
    return user, membership


# ---------------------
# Token / auth header fixtures
# ---------------------

@pytest.fixture
def auth_headers(test_user: User, test_tenant: Tenant) -> dict:
    """Generate authorization headers with JWT token for test_user and test_tenant.

    Used by test_accounts_endpoints for authenticated requests.
    """
    access_token = create_access_token(
        token_payload={
            "sub": str(test_user.id),
            "email": test_user.email,
            "tenant_id": str(test_tenant.id),
        }
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def auth_headers_tenant2(test_user: User, test_tenant2: Tenant) -> dict:
    """Generate authorization headers for test_user scoped to test_tenant2.

    Used by test_accounts_endpoints for cross-tenant queries.
    """
    access_token = create_access_token(
        token_payload={
            "sub": str(test_user.id),
            "email": test_user.email,
            "tenant_id": str(test_tenant2.id),
        }
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def owner_token(test_user: User, test_tenant: Tenant, owner_membership: Membership) -> str:
    """Generate a valid JWT access token for the OWNER user.

    The token includes user_id (sub) and tenant_id claims needed
    by get_active_context to resolve the authenticated context.
    """
    token_payload = {
        "sub": str(test_user.id),
        "tenant_id": str(test_tenant.id),
        "email": test_user.email,
    }
    return create_access_token(token_payload)


@pytest.fixture
def member_token(
    member_user: User, test_tenant: Tenant, member_membership: Membership
) -> str:
    """Generate a valid JWT access token for the MEMBER user."""
    token_payload = {
        "sub": str(member_user.id),
        "tenant_id": str(test_tenant.id),
        "email": member_user.email,
    }
    return create_access_token(token_payload)


@pytest.fixture
def viewer_token(
    viewer_user: User, test_tenant: Tenant, viewer_membership: Membership
) -> str:
    """Generate a valid JWT access token for the VIEWER user."""
    token_payload = {
        "sub": str(viewer_user.id),
        "tenant_id": str(test_tenant.id),
        "email": viewer_user.email,
    }
    return create_access_token(token_payload)


@pytest.fixture
def other_tenant_token(other_tenant: Tenant, other_tenant_owner: tuple) -> str:
    """Generate a valid JWT access token for the other tenant's owner.

    Used in tenant isolation tests to verify cross-tenant access is blocked.
    """
    user, membership = other_tenant_owner
    token_payload = {
        "sub": str(user.id),
        "tenant_id": str(other_tenant.id),
        "email": user.email,
    }
    return create_access_token(token_payload)


# ---------------------
# Category fixtures
# ---------------------

@pytest_asyncio.fixture
async def test_category(
    async_session: AsyncSession, test_tenant: Tenant
) -> Category:
    """Create a test expense category 'Food' for test_tenant.

    Used by test_accounts_endpoints for transaction-related tests.
    """
    category = Category(
        id=uuid4(),
        tenant_id=test_tenant.id,
        name="Food",
        kind=CategoryKind.EXPENSE,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    async_session.add(category)
    await async_session.commit()
    await async_session.refresh(category)
    return category


@pytest_asyncio.fixture
async def expense_category_food(
    async_session: AsyncSession, test_tenant: Tenant
) -> Category:
    """Create an expense category 'Food' for the test tenant."""
    category = Category(
        tenant_id=test_tenant.id,
        name="Food",
        kind=CategoryKind.EXPENSE,
    )
    async_session.add(category)
    await async_session.commit()
    await async_session.refresh(category)
    return category


@pytest_asyncio.fixture
async def expense_category_entertainment(
    async_session: AsyncSession, test_tenant: Tenant
) -> Category:
    """Create an expense category 'Entertainment' for the test tenant."""
    category = Category(
        tenant_id=test_tenant.id,
        name="Entertainment",
        kind=CategoryKind.EXPENSE,
    )
    async_session.add(category)
    await async_session.commit()
    await async_session.refresh(category)
    return category


@pytest_asyncio.fixture
async def expense_category_transport(
    async_session: AsyncSession, test_tenant: Tenant
) -> Category:
    """Create an expense category 'Transport' for the test tenant."""
    category = Category(
        tenant_id=test_tenant.id,
        name="Transport",
        kind=CategoryKind.EXPENSE,
    )
    async_session.add(category)
    await async_session.commit()
    await async_session.refresh(category)
    return category


@pytest_asyncio.fixture
async def income_category(
    async_session: AsyncSession, test_tenant: Tenant
) -> Category:
    """Create an income category 'Salary' for the test tenant.

    Used to verify that income transactions are NOT counted in
    budget spent calculations (only expenses count).
    """
    category = Category(
        tenant_id=test_tenant.id,
        name="Salary",
        kind=CategoryKind.INCOME,
    )
    async_session.add(category)
    await async_session.commit()
    await async_session.refresh(category)
    return category


@pytest_asyncio.fixture
async def other_tenant_category(
    async_session: AsyncSession, other_tenant: Tenant
) -> Category:
    """Create an expense category belonging to the other tenant.

    Used in tenant isolation tests to verify categories from other
    tenants cannot be linked to budgets in the test tenant.
    """
    category = Category(
        tenant_id=other_tenant.id,
        name="Other Category",
        kind=CategoryKind.EXPENSE,
    )
    async_session.add(category)
    await async_session.commit()
    await async_session.refresh(category)
    return category


# ---------------------
# Account fixtures
# ---------------------

@pytest_asyncio.fixture
async def test_account(
    async_session: AsyncSession, test_user: User
) -> Account:
    """Create a test account owned by test_user.

    Used by test_accounts_endpoints for account-related tests.
    """
    account = Account(
        id=uuid4(),
        user_id=test_user.id,
        name="Test Checking Account",
        type=AccountType.DEBIT,
        currency=Currency.BRL,
        balance=Decimal("1000.00"),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)
    return account


@pytest_asyncio.fixture
async def test_account2(
    async_session: AsyncSession, test_user2: User
) -> Account:
    """Create a test account owned by test_user2.

    Used by test_accounts_endpoints for cross-user account sharing tests.
    """
    account = Account(
        id=uuid4(),
        user_id=test_user2.id,
        name="Test Cash Account",
        type=AccountType.CASH,
        currency=Currency.BRL,
        balance=Decimal("500.00"),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)
    return account


@pytest_asyncio.fixture
async def test_account_brl(
    async_session: AsyncSession, test_user: User
) -> Account:
    """Create a BRL debit account for the test user.

    Used when creating transactions that need an account reference.
    """
    account = Account(
        user_id=test_user.id,
        name="BRL Checking",
        type=AccountType.DEBIT,
        currency=Currency.BRL,
        balance=Decimal("5000.00"),
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)
    return account


@pytest_asyncio.fixture
async def test_account_usd(
    async_session: AsyncSession, test_user: User
) -> Account:
    """Create a USD debit account for the test user.

    Used for currency filtering tests to verify that only transactions
    matching the budget's currency are included in spent calculations.
    """
    account = Account(
        user_id=test_user.id,
        name="USD Checking",
        type=AccountType.DEBIT,
        currency=Currency.USD,
        balance=Decimal("2000.00"),
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)
    return account


# ---------------------
# Helper functions
# ---------------------

def authorization_header(token: str) -> dict:
    """Build an Authorization header dict for use with the test client.

    Args:
        token: JWT access token string.

    Returns:
        Dict with the Authorization header value.
    """
    return {"Authorization": f"Bearer {token}"}
