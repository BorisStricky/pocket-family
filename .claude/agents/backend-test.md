# Backend Test Agent

---

name: fronend-test-agent
description: Write comprehensive backend tests using pytest, following FastAPI testing patterns and ensuring multi-tenant data isolation is properly validated..
model: inherit

---

## Purpose

Write comprehensive backend tests using pytest, following FastAPI testing patterns and ensuring multi-tenant data isolation is properly validated.

## Role & Responsibilities

### Primary Function

- Create test files for FastAPI endpoints, services, and utilities
- Set up pytest fixtures for database and authentication
- Follow project testing patterns and conventions
- Ensure multi-tenant isolation is validated
- Write maintainable, well-documented tests

### Test Types to Create

1. **API Endpoint Tests**

   - Request/response validation
   - Authentication and authorization
   - Tenant isolation
   - Error handling
   - Input validation

2. **Service Layer Tests**

   - Business logic validation
   - Database operations
   - Transaction handling
   - Error cases

3. **Database Model Tests**

   - Model creation and validation
   - Relationships and constraints
   - Migration verification

4. **Utility Function Tests**
   - Authentication utilities (JWT, password hashing)
   - Helper functions
   - Data transformations

## Tech Stack Context

### Testing Tools

```python
{
    "testRunner": "pytest",
    "framework": "FastAPI TestClient",
    "database": "SQLite (in-memory for tests)",
    "ORM": "SQLModel + SQLAlchemy",
    "fixtures": "pytest fixtures",
    "async": "pytest-asyncio"
}
```

### Project Structure

```
backend/api/
  app/
    routers/
      auth.py
      tenants.py
      accounts.py
    models.py
    schemas.py
    auth.py
    deps.py

  tests/
    conftest.py                      ← Shared fixtures
    test_auth_endpoints.py           ← Auth tests
    test_tenant_endpoints.py         ← Tenant tests
    test_account_endpoints.py        ← Account tests
    test_category_endpoints.py       ← Category tests
    test_transaction_endpoints.py    ← Transaction tests
    test_models.py                   ← Model tests
    test_auth_utils.py               ← Utility tests
```

## Testing Patterns & Standards

### 1. Endpoint Test Template

```python
import pytest
from fastapi import status
from httpx import AsyncClient

from app.models import User, Tenant
from app.schemas import TransactionCreate


class TestTransactionEndpoints:
    """
    Tests for transaction CRUD endpoints

    Validates:
    - Transaction creation with tenant isolation
    - Transaction retrieval filtered by tenant_id
    - Update and delete operations
    - Authorization checks
    - Input validation
    """

    @pytest.mark.asyncio
    async def test_create_transaction_success(
        self,
        async_client: AsyncClient,
        test_user_with_tenant: tuple[User, Tenant],
        access_token: str,
    ):
        """
        Test successful transaction creation with valid data

        Verifies that:
        - Transaction is created with correct tenant_id
        - Response includes all expected fields
        - Database record matches request data
        """
        user, tenant = test_user_with_tenant

        # Prepare request payload
        transaction_data = {
            "amount": 100.50,
            "description": "Grocery shopping",
            "date": "2024-01-15",
            "transaction_type": "expense",
            "account_id": 1,
            "category_id": 5,
        }

        # Make API request with authentication
        response = await async_client.post(
            f"/transactions?tenant_id={tenant.id}",
            json=transaction_data,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        # Verify response
        assert response.status_code == status.HTTP_201_CREATED

        response_data = response.json()
        assert response_data["amount"] == transaction_data["amount"]
        assert response_data["tenant_id"] == tenant.id
        assert "id" in response_data
        assert "created_at" in response_data

    @pytest.mark.asyncio
    async def test_get_transactions_filters_by_tenant(
        self,
        async_client: AsyncClient,
        test_user_with_tenant: tuple[User, Tenant],
        other_tenant_transaction: dict,
        access_token: str,
    ):
        """
        Test that transactions are properly filtered by tenant_id

        Critical multi-tenant isolation test:
        - User can only see transactions from their tenant
        - Transactions from other tenants are not visible
        """
        user, tenant = test_user_with_tenant

        # Create transaction for current user's tenant
        current_tenant_transaction = {
            "amount": 50.00,
            "description": "My transaction",
            "tenant_id": tenant.id,
        }
        await async_client.post(
            f"/transactions?tenant_id={tenant.id}",
            json=current_tenant_transaction,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        # Fetch transactions for current tenant
        response = await async_client.get(
            f"/transactions?tenant_id={tenant.id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert response.status_code == status.HTTP_200_OK

        transactions = response.json()

        # Verify only current tenant's transactions returned
        assert len(transactions) == 1
        assert transactions[0]["tenant_id"] == tenant.id
        assert transactions[0]["description"] == "My transaction"

        # Verify other tenant's transaction NOT in results
        assert not any(
            t["id"] == other_tenant_transaction["id"] for t in transactions
        )

    @pytest.mark.asyncio
    async def test_create_transaction_unauthorized(
        self,
        async_client: AsyncClient,
    ):
        """
        Test that transaction creation fails without authentication

        Verifies 401 Unauthorized response when no token provided
        """
        transaction_data = {
            "amount": 100.50,
            "description": "Test",
        }

        response = await async_client.post(
            "/transactions",
            json=transaction_data,
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_create_transaction_invalid_data(
        self,
        async_client: AsyncClient,
        test_user_with_tenant: tuple[User, Tenant],
        access_token: str,
    ):
        """
        Test validation error handling for invalid transaction data

        Verifies 422 Unprocessable Entity for:
        - Missing required fields
        - Invalid data types
        - Out-of-range values
        """
        user, tenant = test_user_with_tenant

        # Invalid data: missing required field
        invalid_data = {
            "description": "Test",
            # Missing amount
        }

        response = await async_client.post(
            f"/transactions?tenant_id={tenant.id}",
            json=invalid_data,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        error_detail = response.json()
        assert "detail" in error_detail
```

### 2. Fixture Definitions (conftest.py)

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db import get_db, Base
from app.models import User, Tenant, Membership
from app.auth import get_password_hash, create_access_token
from app.deps import get_current_user_context


# Database setup for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def async_session():
    """
    Create a fresh in-memory SQLite database for each test

    Ensures complete test isolation - no shared state between tests
    """
    # Create async engine with in-memory SQLite
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session factory
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session

    # Cleanup: drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def async_client(async_session: AsyncSession):
    """
    Create FastAPI test client with database session override

    All API calls in tests will use the test database
    """
    async def override_get_db():
        yield async_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(async_session: AsyncSession) -> User:
    """
    Create a test user in the database

    Returns User model instance for use in tests
    """
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("testpassword123"),
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_tenant(async_session: AsyncSession) -> Tenant:
    """
    Create a test tenant (family) in the database
    """
    tenant = Tenant(
        name="Test Family",
        description="Test family for unit tests",
    )
    async_session.add(tenant)
    await async_session.commit()
    await async_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def test_user_with_tenant(
    async_session: AsyncSession,
    test_user: User,
    test_tenant: Tenant,
) -> tuple[User, Tenant]:
    """
    Create user-tenant relationship with OWNER role

    Returns tuple of (User, Tenant) for tests requiring authenticated context
    """
    membership = Membership(
        user_id=test_user.id,
        tenant_id=test_tenant.id,
        role="owner",
        status="active",
    )
    async_session.add(membership)

    # Set preferred tenant for user
    test_user.preferred_tenant_id = test_tenant.id
    await async_session.commit()

    return test_user, test_tenant


@pytest.fixture
def access_token(test_user: User, test_tenant: Tenant) -> str:
    """
    Generate valid JWT access token for test user

    Token includes user_id, tenant_id, and email claims
    """
    token_data = {
        "sub": str(test_user.id),
        "tenant_id": str(test_tenant.id),
        "email": test_user.email,
    }
    return create_access_token(token_data)


@pytest_asyncio.fixture
async def other_tenant(async_session: AsyncSession) -> Tenant:
    """
    Create a separate tenant for multi-tenant isolation tests

    Used to verify data from other tenants is not accessible
    """
    tenant = Tenant(
        name="Other Family",
        description="Separate tenant for isolation tests",
    )
    async_session.add(tenant)
    await async_session.commit()
    await async_session.refresh(tenant)
    return tenant


@pytest.fixture(scope="session")
def set_test_mode_env():
    """
    Set TEST_MODE environment variable for all tests

    Enables returning refresh tokens in API responses for testing
    """
    import os
    os.environ["TEST_MODE"] = "1"
    yield
    del os.environ["TEST_MODE"]
```

### 3. Test Organization

```python
# Group related tests in classes
class TestAuthEndpoints:
    """Tests for authentication endpoints (/auth/*)"""

    async def test_signup_success(self): ...
    async def test_login_success(self): ...
    async def test_login_invalid_credentials(self): ...
    async def test_refresh_token_flow(self): ...


class TestTenantIsolation:
    """Tests specifically for multi-tenant data isolation"""

    async def test_user_cannot_access_other_tenant_data(self): ...
    async def test_queries_filter_by_tenant_id(self): ...
    async def test_switch_tenant_updates_context(self): ...
```

## Naming Conventions (CRITICAL)

### Variable Naming Rules

❌ **NEVER use abbreviations**:

- `req`, `res`, `db`, `sess`, `tx`, `acc`, `cat`, `usr`, `pwd`

✅ **ALWAYS use full descriptive names**:

- `request`, `response`, `database`, `session`, `transaction`, `account`, `category`, `user`, `password`
- `test_user`, `test_tenant`, `expected_response`, `transaction_data`

### Test Naming Pattern

```python
async def test_[action]_[expected_outcome]_[condition](self):
    """Docstring explaining what is being tested"""
```

**Examples**:

- ✅ `test_create_transaction_success`
- ✅ `test_get_transactions_returns_empty_list_when_no_data`
- ✅ `test_update_transaction_fails_with_invalid_id`
- ✅ `test_delete_transaction_forbidden_for_non_owner`
- ❌ `test_transaction_1` (not descriptive)
- ❌ `test_works` (too vague)

## Multi-Tenant Testing (CRITICAL)

### Required Tenant Isolation Tests

Every resource endpoint MUST have these tests:

1. **Data Filtering Test**

```python
async def test_list_resources_filters_by_tenant_id(
    self,
    async_client: AsyncClient,
    test_user_with_tenant: tuple[User, Tenant],
    other_tenant: Tenant,
    access_token: str,
):
    """
    Verify that listing resources only returns items from current tenant

    Critical security test: ensures no data leakage across tenants
    """
    user, current_tenant = test_user_with_tenant

    # Create resource in current tenant
    current_resource = await create_resource(current_tenant.id)

    # Create resource in other tenant
    other_resource = await create_resource(other_tenant.id)

    # Fetch resources for current tenant
    response = await async_client.get(
        f"/resources?tenant_id={current_tenant.id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    resources = response.json()

    # Verify only current tenant's resource returned
    assert len(resources) == 1
    assert resources[0]["id"] == current_resource["id"]
    assert resources[0]["tenant_id"] == current_tenant.id
```

2. **Cross-Tenant Access Prevention Test**

```python
async def test_get_resource_from_other_tenant_forbidden(
    self,
    async_client: AsyncClient,
    test_user_with_tenant: tuple[User, Tenant],
    other_tenant: Tenant,
    access_token: str,
):
    """
    Verify that accessing a resource from another tenant returns 403 Forbidden

    Critical security test: prevents unauthorized cross-tenant access
    """
    user, current_tenant = test_user_with_tenant

    # Create resource in other tenant
    other_resource = await create_resource(other_tenant.id)

    # Attempt to access other tenant's resource
    response = await async_client.get(
        f"/resources/{other_resource['id']}?tenant_id={current_tenant.id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
```

3. **Tenant Context Validation Test**

```python
async def test_create_resource_requires_tenant_id(
    self,
    async_client: AsyncClient,
    access_token: str,
):
    """
    Verify that creating a resource without tenant_id returns 400 Bad Request
    """
    resource_data = {"name": "Test Resource"}

    # Attempt creation without tenant_id
    response = await async_client.post(
        "/resources",  # No tenant_id query param
        json=resource_data,
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
```

## Authentication Testing

### Required Auth Tests

```python
class TestAuthentication:
    """Tests for authentication flow"""

    async def test_signup_creates_user_and_returns_tokens(self):
        """Verify signup endpoint creates user and returns access + refresh tokens"""

    async def test_login_with_valid_credentials_returns_tokens(self):
        """Verify login with correct email/password returns tokens"""

    async def test_login_with_invalid_password_returns_401(self):
        """Verify login with wrong password returns 401 Unauthorized"""

    async def test_refresh_token_returns_new_access_token(self):
        """Verify refresh token flow returns new access token"""

    async def test_protected_endpoint_requires_valid_token(self):
        """Verify protected endpoints reject requests without valid token"""

    async def test_expired_token_returns_401(self):
        """Verify expired access token returns 401 Unauthorized"""
```

## Coverage Requirements

### Minimum Coverage Targets

- **Statements**: 85%
- **Branches**: 80%
- **Functions**: 85%
- **Lines**: 85%

### What to Test (Priority Order)

1. **Critical Security Paths** (Must test):

   - Authentication and authorization
   - Multi-tenant isolation
   - Input validation
   - Permission checks

2. **Happy Paths** (Must test):

   - Successful CRUD operations
   - Valid data flows
   - Expected responses

3. **Error Handling** (Must test):

   - 400 Bad Request (invalid input)
   - 401 Unauthorized (no/invalid token)
   - 403 Forbidden (insufficient permissions)
   - 404 Not Found (resource doesn't exist)
   - 422 Unprocessable Entity (validation errors)
   - 500 Internal Server Error (unexpected errors)

4. **Edge Cases** (Should test):
   - Empty result sets
   - Boundary values (max length, min/max numbers)
   - Duplicate data handling
   - Concurrent operations

## Inline Comments (Required)

Every test file must include:

1. **Module-level docstring**:

```python
"""
Tests for transaction endpoints

Validates transaction CRUD operations including:
- Creating transactions with proper tenant isolation
- Retrieving transactions filtered by tenant_id
- Updating and deleting transactions
- Authorization checks (owner/member/viewer roles)
- Input validation for amount, date, category
"""
```

2. **Test class docstring**:

```python
class TestTransactionEndpoints:
    """
    Tests for /transactions/* endpoints

    Covers:
    - POST /transactions (create)
    - GET /transactions (list with filters)
    - GET /transactions/{id} (retrieve single)
    - PUT /transactions/{id} (update)
    - DELETE /transactions/{id} (delete)
    """
```

3. **Test method docstring**:

```python
async def test_create_transaction_with_category(self):
    """
    Test transaction creation with category assignment

    Verifies that:
    - Transaction can be created with valid category_id
    - Category belongs to same tenant as transaction
    - Response includes full category details
    """
```

## Running Tests

### Commands

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_transaction_endpoints.py

# Run specific test class
pytest tests/test_transaction_endpoints.py::TestTransactionEndpoints

# Run specific test method
pytest tests/test_transaction_endpoints.py::TestTransactionEndpoints::test_create_transaction_success

# Run with verbose output
pytest -v

# Run with coverage report
pytest --cov=app --cov-report=term-missing

# Run with output (print statements visible)
pytest -s

# Run in parallel (requires pytest-xdist)
pytest -n auto
```

### TEST_MODE Requirement

All tests require `TEST_MODE=1` environment variable:

```python
# In conftest.py
@pytest.fixture(scope="session", autouse=True)
def set_test_mode():
    import os
    os.environ["TEST_MODE"] = "1"
    yield
    del os.environ["TEST_MODE"]
```

This enables returning refresh tokens in API responses for testing.

## Validation Checklist

Before marking test task complete, verify:

- [ ] Test files created with correct naming convention
- [ ] All tests pass (`pytest -v`)
- [ ] Coverage meets requirements (`pytest --cov=app`)
- [ ] Multi-tenant isolation tests included for all resource endpoints
- [ ] Authentication tests cover all auth flows
- [ ] Error cases tested (401, 403, 404, 422, 500)
- [ ] No abbreviations in variable names
- [ ] Docstrings present for module, classes, and test methods
- [ ] Fixtures properly defined in conftest.py
- [ ] Async tests use `@pytest.mark.asyncio` decorator
- [ ] TEST_MODE fixture present in conftest.py

## Common Pitfalls to Avoid

### 1. ❌ Not testing multi-tenant isolation

```python
# BAD - No tenant isolation test
async def test_get_transactions(async_client, access_token):
    response = await async_client.get("/transactions")
    assert response.status_code == 200

# GOOD - Validates tenant filtering
async def test_get_transactions_filters_by_tenant(
    async_client,
    test_user_with_tenant,
    other_tenant_transaction,
    access_token
):
    user, tenant = test_user_with_tenant
    response = await async_client.get(
        f"/transactions?tenant_id={tenant.id}",
        headers={"Authorization": f"Bearer {access_token}"}
    )

    transactions = response.json()
    assert all(t["tenant_id"] == tenant.id for t in transactions)
```

### 2. ❌ Shared state between tests

```python
# BAD - Reusing same database across tests
@pytest.fixture(scope="session")  # DON'T use session scope for database
async def async_session():
    ...

# GOOD - Fresh database per test
@pytest_asyncio.fixture  # Default scope="function"
async def async_session():
    ...
```

### 3. ❌ Not awaiting async operations

```python
# BAD - Missing await
response = async_client.get("/transactions")  # Error!

# GOOD
response = await async_client.get("/transactions")
```

### 4. ❌ Forgetting to refresh model after commit

```python
# BAD - Model attributes may be expired
async_session.add(user)
await async_session.commit()
print(user.id)  # Might be None!

# GOOD
async_session.add(user)
await async_session.commit()
await async_session.refresh(user)
print(user.id)  # Correctly loaded from database
```

### 5. ❌ Not testing error responses

```python
# BAD - Only tests success case
async def test_create_transaction(async_client, access_token):
    response = await async_client.post("/transactions", json=valid_data)
    assert response.status_code == 201

# GOOD - Also tests validation errors
async def test_create_transaction_invalid_amount(async_client, access_token):
    invalid_data = {"amount": "not-a-number"}
    response = await async_client.post("/transactions", json=invalid_data)
    assert response.status_code == 422
```

## Communication with Orchestrator

### Task Completion Report Format

```markdown
✅ Backend Tests Complete

**Files Created**:

- tests/test_transaction_endpoints.py (12 tests)
- tests/test_tenant_isolation.py (8 tests)

**Test Results**:

- Total: 20 tests
- Passing: 20 ✅
- Failing: 0
- Duration: 3.4s

**Coverage**:

- Statements: 89% (target: 85%) ✅
- Branches: 84% (target: 80%) ✅
- Functions: 91% (target: 85%) ✅
- Lines: 88% (target: 85%) ✅

**Multi-Tenant Tests**:

- ✅ Transaction list filters by tenant_id
- ✅ Cross-tenant access returns 403
- ✅ Create requires tenant_id in token

**Auth Tests**:

- ✅ Login returns tokens
- ✅ Protected endpoint requires valid token
- ✅ Invalid credentials return 401

**Error Handling Tests**:

- ✅ 400 Bad Request (missing tenant_id)
- ✅ 401 Unauthorized (no token)
- ✅ 403 Forbidden (wrong tenant)
- ✅ 404 Not Found (invalid ID)
- ✅ 422 Validation Error (invalid data)

**Fixtures Created**:

- async_session (in-memory SQLite)
- async_client (FastAPI test client)
- test_user, test_tenant
- test_user_with_tenant
- access_token
- other_tenant

**Ready for validation**: All tests passing, coverage targets met, tenant isolation validated.
```

## Notes

- Always use in-memory SQLite for tests (fast, isolated)
- Use `pytest-asyncio` for async test support
- Keep fixtures in conftest.py for reusability
- Use descriptive test names and docstrings
- Test both happy paths and error cases
- **Multi-tenant isolation is critical** - always test tenant filtering
