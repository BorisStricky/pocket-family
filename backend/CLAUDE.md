# Backend — CLAUDE.md

Module guidance for the FastAPI + SQLModel backend. This file auto-loads when you work under `backend/`. It is the source of truth for backend implementation **and** test conventions (these used to live in the `backend-dev` / `backend-test` agents). The root [CLAUDE.md](../CLAUDE.md) holds project-wide context.

## Scope & Setup

```bash
cd backend
uv sync --all-extras                       # install prod + dev deps

cd backend/api
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
uv run pytest -v                           # run tests
uv run pytest --cov=app                     # with coverage
```

### Layout

```
backend/
  api/
    app/
      main.py        # FastAPI app entry, CORS, startup hooks
      models.py      # SQLModel database models
      schemas.py     # Pydantic request/response schemas
      auth.py        # JWT utilities, password hashing, is_demo_mode()
      db.py          # async engine / session, get_db
      deps.py        # get_active_context → ActiveContext; get_current_user; require_role/require_owner/require_writer
      services/      # framework-agnostic domain logic (DB queries, business rules); see "Service layer" below
      routers/       # auth, tenants, accounts, categories, transactions, budgets
    alembic/         # migrations
    tests/           # pytest suite (see "Testing" below)
  scripts/           # recreate_db, seed_test_data, ensure_demo_user, seed_demo_data
  pyproject.toml     # uv-managed deps
```

Tech stack: FastAPI · SQLModel + SQLAlchemy (async, asyncpg) · PostgreSQL · JWT (access + refresh) · Alembic · pytest.

---

## Implementation Conventions

### Multi-tenant safety (CRITICAL — #1 security concern)

- **Every domain model includes `tenant_id`** (`Field(foreign_key="tenants.id", index=True)`). The one deliberate exception is `Account`, which is **user-scoped** (`user_id`, no `tenant_id`) — see the user-scoped-account invariant in [docs/north_star.md](../docs/north_star.md) §9.
- **Every tenant-scoped route resolves context via a dependency** — never re-implement auth inline:
  - `active_context: ActiveContext = Depends(get_active_context)` for reads (no role gate). `ActiveContext` exposes `active_user`, `active_tenant`, `active_membership` (the membership carries `role`: owner/member/viewer).
  - `Depends(require_writer)` / `Depends(require_owner)` for role-gated **writes** — these return the same `ActiveContext` but 403 first if the caller's active-tenant role is too low. Prefer these over reading `active_context.active_membership.role` in the handler. See **Service layer & authorization conventions** below.
  - `Depends(get_current_user)` for **user-scoped** routes (e.g. `accounts.py`) that need only the `User`, not a tenant.
- **Every query filters by tenant**: `.where(Model.tenant_id == active_context.active_tenant.id)`. Assign `tenant_id` from `active_context.active_tenant.id` on create — never trust a client-supplied tenant id in the body.
- **The query itself lives in a service**, not the handler (see the layering rule below). The router resolves context and delegates.

```python
# Router: thin — resolve context, delegate, return. No raw SQL here.
@router.get("/transactions", response_model=list[TransactionOut])
async def list_transactions(
    active_context: ActiveContext = Depends(get_active_context),
    database_session: AsyncSession = Depends(get_db),
):
    """List transactions for the active tenant."""
    return await transaction_service.list_for_tenant(
        database_session, active_context.active_tenant.id
    )

# Mutation: gate on role via the dependency, derive tenant_id from context.
@router.post("/transactions", response_model=TransactionOut)
async def create_transaction(
    payload: TransactionCreate,
    active_context: ActiveContext = Depends(require_writer),  # 403s viewers
    database_session: AsyncSession = Depends(get_db),
):
    """Create a transaction for the active tenant (owner/member only)."""
    return await transaction_service.create_for_tenant(
        database_session, active_context.active_tenant.id, payload
    )

# services/transactions.py — the tenant filter lives here.
async def list_for_tenant(session: AsyncSession, tenant_id: UUID) -> list[Transaction]:
    result = await session.execute(
        select(Transaction).where(Transaction.tenant_id == tenant_id)
    )
    return result.scalars().all()
```

Omitting the `tenant_id` filter is a **data leak** and an automatic review failure.

### Models vs schemas

SQLModel `table=True` classes live in `models.py`; Pydantic request/response contracts (`*Create`, `*Update`, `*Out`) live in `schemas.py`. `*Create` schemas must **not** include `tenant_id` — it comes from the JWT context. Use `class Config: from_attributes = True` on `*Out` schemas.

### Type hints, comments, naming

- Full type hints on every function signature and return.
- Docstrings on every endpoint/function; inline comments explain the **why** (learning project).
- **No abbreviations**: `transaction` not `tx`, `account` not `acc`, `database_session` not `db`, `request_data` not `req`, `response` not `res`.

### Error handling

Use the right status code via `HTTPException`: `400` bad input, `401` unauthenticated, `403` no permission / wrong tenant, `404` not found, `409` constraint/duplicate (`422` is automatic from Pydantic). Use `scalar_one_or_none()` + a 404 check rather than `scalar_one()`. Wrap commits that can violate constraints in `try/except IntegrityError` with `await database_session.rollback()`.

### Async discipline

Always `await` DB operations. After create/update: `await session.commit()` **and** `await session.refresh(model)` before returning.

### Demo mode

`is_demo_mode()` in `app/auth.py` reads `DEMO_MODE`. When enabled, mutating/admin endpoints (signup, tenant delete, member management, invites) return `403`. See [../infrastructure/CLAUDE.md](../infrastructure/CLAUDE.md) for the full demo-mode picture.

### Service layer & authorization conventions

Slices 1–3 of the QCSD hardening refactor extracted a `app/services/` layer and introduced centralized role dependencies. Follow these conventions when adding or modifying backend logic.

#### Layering

`app/services/<domain>.py` holds all DB-interacting and business logic. Service modules are **framework-agnostic**: they must not import FastAPI (`HTTPException` is the narrow permitted exception, because it is a plain Python exception class) and must never import from `..routers`. Service functions receive the SQLAlchemy session as a plain first parameter `session: AsyncSession`.

Routers are the HTTP boundary. Their only responsibilities are: routing, dependency injection (`Depends`), HTTP status codes, and orchestration — resolving dependencies at the boundary and passing concrete objects into service functions. No business logic, no raw SQL queries.

```
router handler
  → resolves deps (get_current_user, require_writer, etc.)
  → calls service.authorize_something(session, ...)  # raises HTTPException on failure
  → calls service.build_something_read(session, ...)  # returns DTO
  → commits
```

#### Naming conventions

| Pattern | Purpose | Example from codebase |
|---|---|---|
| `build_<entity>_read(session, ...)` | Assemble the API response DTO (joins, enrichment, balance-visibility masking) | `services/accounts.py::build_account_read` |
| `can_<verb>_<entity>(session, ...) -> bool` | Authorization predicate — returns bool, never raises | `services/accounts.py::can_access_account` |
| `authorize_<thing>(session, ...)` | Validate and **raise** `HTTPException` on failure; return the validated object on success | `services/accounts.py::authorize_share_target`, `services/transactions.py::authorize_account_for_tenant` |
| plain descriptive names | Pure helpers with no side-effects | `services/transactions.py::balance_delta`, `rows_to_transaction_reads` |

#### Role authorization

Use `require_role(*roles)` from `deps.py` — and its intent-revealing aliases `require_owner` and `require_writer` — to gate endpoints on the caller's **active-tenant** membership role instead of writing inline role checks in handlers.

```python
# Allows only OWNER or MEMBER (blocks VIEWERs)
@router.post("/categories", response_model=CategoryRead)
async def create_category(
    payload: CategoryCreate,
    active_context: ActiveContext = Depends(require_writer),
    database_session: AsyncSession = Depends(get_db),
):
    ...
```

**Exception**: endpoints that authorize against a **path-parameter `tenant_id`** that may differ from the caller's active tenant (e.g. member-management endpoints in `routers/tenants.py`) cannot use `require_role` because it always gates on the active-tenant membership. These handlers must perform their own membership lookup against the path tenant.

`require_role` is a FastAPI dependency — wire it in routers only; never call it from a service function.

#### Transaction ownership (atomicity invariant)

The request-scoped `AsyncSession` flows from the router into every service it calls within a single request. Services and dependencies may read, `session.add()`, and `await session.flush()`, but **only the handler commits** (`await session.commit()`). This single-commit discipline is what keeps multi-step handlers — such as `create_account` (account creation + optional AccountShare) or transaction creation (insert row + update account balance) — atomic. Never call `session.commit()` inside a service function.

---

## Migrations (Alembic)

```bash
cd backend/api
alembic revision --autogenerate -m "Description"   # after any model change
alembic upgrade head
alembic downgrade -1
```

- **Every model change requires a migration.** Test both upgrade and downgrade.
- **Never edit a migration after it is committed.**
- `AUTO_CREATE_SCHEMA=1` lets models auto-create tables (local dev only). In every shared/prod environment it is `0` — **Alembic owns the schema**.

---

## Testing Conventions

Tests live in `backend/api/tests/` (pytest + `pytest-asyncio`, in-memory SQLite for isolation). All new behavior requires tests; behavior changes require test updates.

- **`TEST_MODE=1`** is required (set via an autouse session fixture in `conftest.py`) — it makes auth endpoints return raw refresh tokens.
- **Fixtures in `conftest.py`**, function-scoped for isolation: `async_session` (fresh in-memory DB per test), `async_client` (TestClient with `get_db` overridden), `test_user`, `test_tenant`, `test_user_with_tenant`, `access_token`, `other_tenant`. Never use `scope="session"` for the database.
- **Multi-tenant isolation tests are mandatory for every resource endpoint**: (1) list filters by `tenant_id`, (2) cross-tenant access returns 403/404, (3) create derives tenant from context.
- **Cover** happy paths, auth flows, and error cases (401/403/404/422). Coverage targets: ~85% statements/lines, ~80% branches.
- **Naming**: `test_<action>_<expected_outcome>_<condition>`; module/class/method docstrings explain what is validated. No abbreviations.
- `@pytest.mark.asyncio` on async tests; `await` every async call; `await session.refresh(model)` after commit.

```python
@pytest.mark.asyncio
async def test_list_transactions_filters_by_tenant(
    async_client, test_user_with_tenant, other_tenant, access_token
):
    """Listing only returns the current tenant's transactions (isolation)."""
    ...
```

---

## Pre-completion checklist

- [ ] `uv run pytest -v` passes; coverage targets met
- [ ] Tenant-scoped models have `tenant_id` (`Account` is user-scoped); all queries filter by it; routes resolve context via `get_active_context` / `require_writer` / `require_owner` (no inline auth), and DB queries live in `services/`, not handlers
- [ ] Full type hints, docstrings, inline "why" comments, no abbreviations
- [ ] Error handling for 401/403/404 (+409 where relevant)
- [ ] Migration created/tested for any model change
- [ ] Multi-tenant isolation tests present for new/changed resource endpoints
