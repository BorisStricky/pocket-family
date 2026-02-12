"""
Shared pytest fixtures for backend API tests.

Provides database session, test client, user/tenant/membership setup,
and JWT token generation for authenticated endpoint testing. All fixtures
use an in-memory SQLite database for complete test isolation.
"""

import os
import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import date, datetime
from uuid import uuid4

from httpx import AsyncClient, ASGITransport
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from app.models import (
    User,
    Tenant,
    Membership,
    Account,
    Category,
    Transaction,
    Budget,
    BudgetCategory,
    MembershipRole,
    MembershipStatus,
    AccountType,
    CategoryKind,
    Currency,
    TransactionSource,
)
from app.auth import hash_password, create_access_token
from app.deps import get_db
from app.main import app


# ---------------------
# Environment setup
# ---------------------

@pytest.fixture(scope="session", autouse=True)
def set_test_mode_environment():
    """Set TEST_MODE environment variable for the entire test session.

    This enables returning refresh tokens in API responses, which is
    necessary for testing the authentication flow end-to-end.
    """
    os.environ["TEST_MODE"] = "1"
    yield
    del os.environ["TEST_MODE"]


# ---------------------
# Database fixtures
# ---------------------

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
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


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
# Token fixtures
# ---------------------

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
