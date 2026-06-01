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
      deps.py        # get_current_user_context → ActiveContext
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

- **Every domain model includes `tenant_id`** (`Field(foreign_key="tenants.id", index=True)`).
- **Every tenant-scoped route uses** `context: ActiveContext = Depends(get_current_user_context)`. `context` exposes `user`, `tenant`, `membership` (role: owner/member/viewer).
- **Every query filters by tenant**: `.where(Model.tenant_id == context.tenant.id)`. Assign `tenant_id` from `context.tenant.id` on create — never trust a client-supplied tenant id in the body.

```python
@router.get("/transactions", response_model=list[TransactionOut])
async def list_transactions(
    context: ActiveContext = Depends(get_current_user_context),
    database_session: AsyncSession = Depends(get_db),
):
    """List transactions for the current tenant."""
    result = await database_session.execute(
        select(Transaction).where(Transaction.tenant_id == context.tenant.id)
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
- [ ] All models have `tenant_id`; all queries filter by it; routes use `get_current_user_context`
- [ ] Full type hints, docstrings, inline "why" comments, no abbreviations
- [ ] Error handling for 401/403/404 (+409 where relevant)
- [ ] Migration created/tested for any model change
- [ ] Multi-tenant isolation tests present for new/changed resource endpoints
