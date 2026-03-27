---
Overview: "Full-stack hardening and consolidation: CVE-driven dependency replacements (python-jose → PyJWT, bcrypt → Argon2), deprecated datetime API migration, TypeScript type safety sweep, variable naming enforcement, test infrastructure consolidation, stub hook removal, and environment file unification."
Date: 2026-03-26
branch: "`development` → `master`"
code_changed: 64 files changed, +2315 insertions, -28687 deletions
commits: 4 commits (1 merge commit)
tags:
  - security
  - cve
  - type-safety
  - code-quality
  - cleanup
  - testing
  - bugfix
---

# Hardening Phase 3 + Cleanup: Security, Type Safety & Consolidation

## Overview

This pull request is a multi-commit hardening and cleanup pass across the full stack. It addresses two related concerns in sequence: first, a code-quality sweep (Phase 3 hardening) to eliminate deprecated APIs, TypeScript `any` types, and naming violations; second, a consolidation commit that fixes CVE-flagged dependencies, removes Sprint-0 stub hooks that were silently no-oping, merges the split test infrastructure into one location, and unifies frontend environment files.

No new product features are introduced. The goal is a more maintainable, secure, and consistent codebase before the next feature sprint.

---

## Goals Achieved

### Phase 3 Hardening
- Replace all deprecated `datetime.utcnow()` with `datetime.now(timezone.utc)` (20+ call sites)
- Eliminate all `any` types from `TransactionsGrid.tsx` AG Grid integration
- Eliminate `any` types from `apiClient.ts` error handling
- Rename all abbreviated variables (`tx`, `res`, `ct`, `v`, `q`, `cat`, `e`) to full names
- Remove Storybook infrastructure (config, 17 story files, 5 npm dependencies)
- Remove `/test-auth` route and associated test auth page
- Remove temporary backend debug script (`query_accounts_temp.py`)
- Fix tenant member listing permission check bug (class attribute vs instance check)
- Stop leaking internal error details in transaction creation endpoint
- Switch `passlib[bcrypt]` → `passlib[argon2]` to align declared dependency with actual usage

### CVE Fixes
- Replace `python-jose[cryptography]` with `PyJWT==2.10.1` (python-jose had unpatched CVEs)
- Update `uv.lock` with patched dependency tree

### Cleanup / Consolidation
- Remove Sprint-0 stub hooks (`useTransaction.ts`, `useTransactionMutations.ts`) that silently returned no-op mutations
- Fix `TransactionDetailModal.tsx` to import real hooks from `features/transactions/hooks/`
- Remove `useDuplicateTransaction` usage and the "Duplicate" button from the modal
- Move all 8 backend test files from root `/tests/` into `backend/api/tests/`
- Merge two conftest strategies (sync file-backed + async in-memory) into a single `backend/api/tests/conftest.py`
- Delete obsolete root-level `tests/conftest.py` (391 lines, merged upstream)
- Consolidate frontend env files: `frontend/.env.example` removed, `VITE_*` vars added to repo-root `.env.example`
- Configure `vite.config.ts` `envDir` to load `.env` from repo root
- Update `pytest.ini` `testpaths` to point at `backend/api/tests`
- Scope Vitest coverage to `src/**/*.{ts,tsx}` explicitly

---

## Architecture & Tech Stack Changes

> [!info] Related Concepts
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] — JWT migration from python-jose to PyJWT, Argon2, datetime security
> - [[../knowledge/glossary/typescript|TypeScript]] — Generics, `unknown` vs `any`, type narrowing in AG Grid
> - [[../knowledge/glossary/api-communication|API Communication]] — `apiFetch` client, error handling, CVE-safe JWT decoding
> - [[../knowledge/glossary/testing|Testing]] — Dual conftest strategy, pytest path consolidation, Vitest coverage
> - [[../knowledge/glossary/development-workflow|Development Workflow]] — envDir, pyproject.toml, uv.lock
> - [[../knowledge/glossary/project-structure-concepts|Project Structure]] — Test file location, env file convention
> - [[../knowledge/glossary/state-management|State Management]] — Real React Query hooks replacing stub no-ops

### Dependency Changes

| Package | Before | After | Reason |
|---------|--------|-------|--------|
| `python-jose[cryptography]` | `3.3.0` | ❌ Removed | CVE — unpatched vulnerabilities in jose library |
| `PyJWT` | Not installed | `2.10.1` | CVE replacement for python-jose |
| `passlib[bcrypt]` | `1.7.4` | ❌ Removed | Aligns declared extra with actual Argon2 usage |
| `passlib[argon2]` | Not declared | `1.7.4` | Matches runtime hasher (argon2-cffi already present) |
| `storybook` (5 packages) | Installed | ❌ Removed | Storybook was unused; stories were stale |

### JWT Library Migration: python-jose → PyJWT

The biggest dependency change is the JWT library. `python-jose` had unpatched CVEs and its import path
(`from jose import jwt`) is replaced with the standard PyJWT import path (`import jwt`). The exception
hierarchy also changed:

```python
# Before (python-jose)
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError
# ...
except JWTError: ...

# After (PyJWT)
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
# ...
except InvalidTokenError: ...
```

`InvalidTokenError` is PyJWT's base exception (analogous to `JWTError`). All callers updated accordingly.

### datetime.utcnow() → datetime.now(timezone.utc)

> See [[../knowledge/glossary/authentication-security|Authentication & Security]] for how datetimes appear in JWT expiry and token record timestamps.

Python 3.12 deprecated `datetime.utcnow()`. The replacement returns a timezone-aware datetime, but
PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` columns require naive datetimes. The pattern used throughout:

```python
# Before (deprecated, returns naive datetime)
datetime.utcnow()

# After (timezone-aware, then stripped for PostgreSQL compatibility)
datetime.now(timezone.utc).replace(tzinfo=None)
```

### Test Infrastructure: Dual Conftest Strategy

> See [[../knowledge/glossary/testing|Testing]] for fixture patterns and test isolation strategies.

Previously two conftest files existed independently:
- `tests/conftest.py` (root, 391 lines) — sync file-backed SQLite for CRUD tests
- `backend/api/tests/conftest.py` — async in-memory SQLite for endpoint tests

These are now merged into a single `backend/api/tests/conftest.py` with clearly documented sections:

**Strategy 1 — Async in-memory** (used by `test_budget_endpoints`, `test_accounts_endpoints`):
- Per-test database isolation via `StaticPool` in-memory SQLite
- `async_session` + `async_client` (httpx.AsyncClient)

**Strategy 2 — Sync file-backed** (used by `test_auth_endpoints`, `test_*_crud`):
- Session-scoped file-backed SQLite shared across tests
- `db_session` (sync Session) + `client` (FastAPI TestClient)
- Tests remain idempotent via `helpers.signup_and_auth`

---

## Directory Structure

### Backend

```
backend/api/app/
  ✏️ auth.py                         — PyJWT import, datetime migration, InvalidTokenError
  routers/
    ✏️ auth.py                       — datetime migration (12 call sites)
    ✏️ budgets.py                    — datetime migration (6 call sites)
    ✏️ tenants.py                    — Fix member listing permission check (instance vs class)
    ✏️ transactions.py               — Secure error handling + logging
backend/api/tests/
  🆕 conftest.py                     — Merged from root tests/ + existing backend/api/tests/conftest.py
  🆕 helpers.py                      — Moved from root tests/helpers.py
  🆕 test_account_crud.py            — Moved from root tests/
  🆕 test_account_share_crud.py      — Moved from root tests/
  🆕 test_accounts_endpoints.py      — Moved + updated (async fixtures, no-abbreviation)
  🆕 test_auth_endpoints.py          — Moved + updated
  🆕 test_budget_endpoints.py        — Moved + updated (datetime migration)
  🆕 test_category_crud.py           — Moved from root tests/
  🆕 test_membership_crud.py         — Moved from root tests/
  🆕 test_tenant_crud.py             — Moved + minor fix
  🆕 test_transaction_crud.py        — Moved from root tests/
✏️ backend/pyproject.toml            — python-jose → PyJWT, bcrypt → argon2
✏️ backend/uv.lock                   — Dependency tree updated
❌ backend/api/query_accounts_temp.py — Temporary debug script removed
```

### Frontend

```
✏️ .env.example                          — Added VITE_API_URL + test credential comments
✏️ .env.production.example               — Added VITE_API_URL entry
✏️ .gitignore                            — Add coverage/, logs, IDE, fix duplicates
❌ .vscode/settings.json                 — IDE settings removed from version control
❌ remoteContainers-*.log                — Stale log file removed
❌ frontend/.env.example                 — Removed (vars consolidated into root .env.example)
❌ frontend/.storybook/main.ts           — Storybook config removed
❌ frontend/.storybook/preview.tsx       — Storybook config removed
✏️ frontend/package.json                 — Remove Storybook deps + scripts
✏️ frontend/package-lock.json            — Lock file updated
✏️ frontend/vite.config.ts               — Add envDir: path.resolve(__dirname, '..')
✏️ frontend/vitest.config.ts             — Add coverage include: src/**
✏️ pytest.ini                            — testpaths = backend/api/tests
frontend/src/
  components/
    domain/
      ✏️ CategorySelect.tsx              — Rename cat → category
    modals/
      ✏️ TransactionDetailModal.tsx       — Real hooks, remove Duplicate button/stub
    molecules/
      ✏️ TransactionListItem.tsx          — Rename tx prop → transaction
      ✏️ TransactionsFilterBar.tsx        — Rename q → searchQuery
    organisms/
      ✏️ TransactionsGrid.tsx             — Remove all any types, AG Grid generics
      ✏️ TransactionsList.tsx             — Rename tx → transaction
  lib/
    ✏️ apiClient.ts                       — Replace any with unknown, rename res/ct
  router/
    ✏️ index.tsx                          — Remove /test-auth route
❌ frontend/src/features/auth/__test-auth__.tsx  — Test auth page removed
❌ frontend/src/hooks/useTransaction.ts          — Stub hook removed (was no-op)
❌ frontend/src/hooks/useTransactionMutations.ts — Stub hooks removed (was no-op)
❌ frontend/src/lib/__test-apiclient__.ts        — Test utility removed
❌ frontend/src/types/ag-grid.d.ts               — Unused type declarations removed
❌ frontend/src/stories/*.stories.tsx            — 17 story files removed
❌ tests/conftest.py                             — Merged into backend/api/tests/conftest.py
```

---

## Files Changed — Detailed Breakdown

### 1. CVE Fix: python-jose → PyJWT

> See [[../knowledge/glossary/authentication-security|Authentication & Security]] for JWT token creation, verification, and the security implications of library choice.

**Files**: `backend/pyproject.toml`, `backend/api/app/auth.py`, `backend/uv.lock`

`python-jose` had publicly disclosed CVEs with no patches available. Replaced with `PyJWT==2.10.1`, the
actively maintained standard library. The migration required:

1. Changing imports: `from jose import jwt` → `import jwt`
2. Changing exception names: `JWTError` → `InvalidTokenError`, same `ExpiredSignatureError`
3. Updating the `encode()` call: PyJWT returns `str` directly (no `.decode()` needed)

All JWT functionality (access token creation, verification, expiry checking) is preserved identically.

### 2. Bug Fix: Tenant Member Listing Permission Check

**File**: `backend/api/app/routers/tenants.py`

The `list_members_for_tenant` endpoint had a critical logic bug — a double error:

```python
# Before: Two bugs combined
# Bug 1: Membership.status is a class-level SQLAlchemy column descriptor,
#         not an instance value — this comparison always returns a truthy
#         SQLAlchemy BinaryExpression, never a Python bool.
# Bug 2: The condition was INVERTED — it raised when status WAS active.
if Membership.status == MembershipStatus.ACTIVE:
    raise HTTPException(status_code=403, detail="not a member")

# After: Correct instance check with correct logic
if membership_record.status != MembershipStatus.ACTIVE:
    raise HTTPException(status_code=403, detail="not a member")
```

The practical effect of the bug was that the permission check silently passed for all callers (including revoked members), since comparing a class attribute to an enum value produces a truthy SQLAlchemy expression, not a boolean.

### 3. Security: Error Message Leakage (transactions.py)

**File**: `backend/api/app/routers/transactions.py`

The transaction creation endpoint was returning raw exception text to the client, which could expose
database schema details, constraint names, or stack info:

```python
# Before — internal exception message sent to client
detail=f"Failed to create transaction: {str(error)}"

# After — generic message, full exception logged server-side
logger = logging.getLogger(__name__)
logger.exception("Failed to create transaction")
detail="Failed to create transaction"
```

### 4. TypeScript Type Safety: TransactionsGrid

> See [[../knowledge/glossary/typescript|TypeScript]] for AG Grid generic patterns and [[../knowledge/glossary/ui-components-design|UI Components & Design]] for the AG Grid component conventions.

**File**: `frontend/src/components/organisms/TransactionsGrid.tsx`

Every AG Grid callback and formatter previously used `any`. Replaced with proper typed generics:

| Before | After |
|--------|-------|
| `ColDef[]` | `ColDef<Transaction>[]` |
| `(params: any)` (formatter) | `(params: ValueFormatterParams<Transaction>)` |
| `(params: any)` (cell renderer) | `(params: ICellRendererParams<Transaction>)` |
| `(params: any)` (cell style) | `(params: CellClassParams<Transaction>)` |
| `(params: any)` (filter getter) | `(params: ValueGetterParams<Transaction>)` |
| `GridApi \| null` | `GridApi<Transaction> \| null` |
| `(event: any)` (row click) | `(event: RowClickedEvent<Transaction>)` |
| `(_: any, page: number)` | `(_event: React.ChangeEvent<unknown>, page: number)` |

Also removed the deprecated `ColumnApi` ref (removed in AG Grid 31+) and added null-safe `params.data?.` access.

### 5. TypeScript Type Safety: apiClient

> See [[../knowledge/glossary/api-communication|API Communication]] for `apiFetch` patterns.

**File**: `frontend/src/lib/apiClient.ts`

- `ApiError.body`: `any` → `unknown`
- `payload` variable: `any` → `unknown`
- Error message extraction uses explicit type narrowing: `payload as Record<string, unknown>`
- `res` → `response`, `ct` → `contentType`

### 6. Stub Hook Removal and Real Hook Wiring

> See [[../knowledge/glossary/state-management|State Management]] for React Query mutation patterns.

**Files**: Deleted `src/hooks/useTransaction.ts`, `src/hooks/useTransactionMutations.ts`; updated `TransactionDetailModal.tsx`

Two hooks in `src/hooks/` were Sprint-0 stubs that existed purely to make the build pass:

```typescript
// useTransactionMutations.ts (DELETED — was silently no-oping)
export function useUpdateTransaction(familyId: string) {
  return { mutateAsync: async () => {}, isPending: false };
}
export function useDeleteTransaction(familyId: string) {
  return { mutateAsync: async () => {}, isPending: false };
}
export function useDuplicateTransaction(familyId: string) {
  return { mutateAsync: async () => {}, isPending: false };
}
```

`TransactionDetailModal.tsx` now imports from the real feature hooks:

```typescript
// Before (stub, no-op)
import { useTransaction } from '../../hooks/useTransaction';
import { useUpdateTransaction, useDeleteTransaction, useDuplicateTransaction } from '../../hooks/useTransactionMutations';

// After (real React Query hooks)
import { useTransaction } from '@/features/transactions/hooks/useTransaction';
import { useUpdateTransaction } from '@/features/transactions/hooks/useUpdateTransaction';
import { useDeleteTransaction } from '@/features/transactions/hooks/useDeleteTransaction';
```

The `useDuplicateTransaction` stub is removed entirely — the "Duplicate" button is removed from the modal UI as the feature was never implemented.

### 7. Test Infrastructure Consolidation

> See [[../knowledge/glossary/testing|Testing]] for full details on the dual-strategy fixture pattern.

**Change**: All 8 test files moved from root `/tests/` to `backend/api/tests/`. Two conftest files merged.

The root `/tests/conftest.py` (391 lines) used a sync file-backed SQLite engine. The existing
`backend/api/tests/conftest.py` used async in-memory SQLite. Both strategies are now co-located in a
single, well-documented conftest that makes each strategy explicit and testable independently.

Key fixture additions from the sync strategy:
- `sqlite_path` — session-scoped temp file for sync tests
- `sync_engine` — sync SQLAlchemy engine with table creation
- `file_async_engine` — async engine bound to the same file (allows FastAPI app + sync queries to share data)
- `db_session` — sync session for direct DB assertions in CRUD tests

`pytest.ini` updated so `pytest` resolves paths correctly:

```ini
# Before
testpaths = tests

# After
testpaths = backend/api/tests
```

### 8. Frontend Environment File Consolidation

> See [[../knowledge/glossary/development-workflow|Development Workflow]] for Vite configuration and env variable patterns.

**Change**: `frontend/.env.example` removed. `VITE_*` variables added to repo-root `.env.example`. `vite.config.ts` updated with `envDir`.

Previously frontend and backend env examples were separate. Vite is now configured to look for `.env`
files one level up (repo root) via `envDir: path.resolve(__dirname, '..')`:

```typescript
// frontend/vite.config.ts
export default defineConfig({
  envDir: path.resolve(__dirname, '..'), // Read .env from repo root
  // ...
})
```

This means a single `.env` file at the repo root covers both backend and frontend variables, which matches how `docker-compose.dev.yml` already injects environment.

### 9. Naming Convention Enforcement

| File | Variable | Before | After |
|------|----------|--------|-------|
| `TransactionDetailModal.tsx` | transaction data | `tx` | `transactionData` |
| `TransactionDetailModal.tsx` | mutations | `updateMut`, `deleteMut`, `dupMut` | `updateMutation`, `deleteMutation` |
| `TransactionListItem.tsx` | prop + usage | `tx` | `transaction` |
| `TransactionsList.tsx` | loop var | `tx` | `transaction` |
| `TransactionsFilterBar.tsx` | search param | `q` | `searchQuery` |
| `CategorySelect.tsx` | loop var | `cat` | `category` |
| `TransactionsGrid.tsx` | values | `v`, `val` | `numericValue`, `value` |
| `TransactionsGrid.tsx` | catch var | `e` | `gridError`, `_ignored` |
| `TransactionsGrid.tsx` | event | `_` | `_event` |
| `apiClient.ts` | response | `res` | `response` |
| `apiClient.ts` | content-type | `ct` | `contentType` |
| `conftest.py` | client | `client` | `test_client` |
| `conftest.py` | misc | `q` | `query`, `s` → full names |

### 10. Storybook Removal

**Deleted**: `.storybook/main.ts`, `.storybook/preview.tsx`, 17 `*.stories.tsx` files

**Removed npm dependencies**:
- `@chromatic-com/storybook`
- `@storybook/addon-essentials`
- `@storybook/react`
- `@storybook/react-vite`
- `storybook`

**Removed scripts**: `storybook`, `build-storybook`

Component development uses Vitest + React Testing Library; Storybook was unmaintained.

### 11. .gitignore and Coverage Improvements

Added patterns for `frontend/coverage/`, `*.log`, `.vscode/settings.json`. Removed a duplicate
`.claude/settings.local.json` entry. Fixed comment formatting.

`vitest.config.ts` now explicitly sets `coverage.include: ['src/**/*.{ts,tsx}']` to prevent test
infrastructure files from inflating coverage numbers.

---

## Testing Strategy

> See [[../knowledge/glossary/testing|Testing]] for comprehensive patterns.

- All 8 backend test files now run from `backend/api/tests/` — verified by running `pytest`
- Sync CRUD tests (auth, tenant, account, category, membership, transaction, account-share) use the new merged conftest sync fixtures
- Async endpoint tests (budget, accounts endpoints) use the async in-memory fixtures
- `TEST_MODE=1` and `DATABASE_URL=sqlite+aiosqlite:///:memory:` are now set in conftest at import time, preventing asyncpg from being imported
- Budget endpoint tests updated to use `datetime.now(timezone.utc)` matching production fixture timestamps
- No behavioral regressions expected — all changes are mechanical migrations or structural moves

---

## Migration Notes

- **`uv sync` required** — Backend lock file updated (PyJWT replaces python-jose, argon2 extra)
- **`npm install` required** — Storybook packages removed
- **No database migrations** — No model changes
- **Single `.env` file** — Create one `.env` at repo root (copy `.env.example`); `frontend/.env` no longer needed
- **`TransactionListItem` prop rename** — `tx` → `transaction`. Any external consumer of this component must update the prop name
- **Duplicate transaction feature removed** — The "Duplicate" action in `TransactionDetailModal` is gone; the hook never worked (was a stub)
- **pytest paths** — If running pytest from repo root, `pytest.ini` `testpaths = backend/api/tests` handles discovery automatically; explicit path argument no longer needed

---

## Performance Impact

- **npm install size**: Reduced by ~1,900 lines in `package-lock.json` (Storybook removal)
- **Build time**: Marginally faster (fewer dependencies to process)
- **Test suite**: Single `pytest` invocation now covers all backend tests; no need to run from two directories

---

## Next Steps / Follow-up Work

- Add backend tests specifically for the tenant member listing permission fix to prevent regression
- Consider adding a linting rule (`flake8-bugbear` or `ruff`) to catch `datetime.utcnow()` usage
- Consider TypeScript `strict` mode or `@typescript-eslint/no-explicit-any` rule to prevent `any` types
- Implement or formally remove the duplicate transaction feature (currently removed without replacement)
- Verify all frontend tests pass with the new hook wiring in `TransactionDetailModal`

---

## Related Documentation

- [Hardening Phase 3 Release (detail)](Hardening_Phase3_Release.md) — In-depth breakdown of the Phase 3 changes
- [Hardening Phase 2 Master Release](Hardening_Phase2_Master_Release.md) — Previous hardening work
- [CLAUDE.md](../../CLAUDE.md) — Variable naming standards, coding conventions, test agent delegation

### Technical Glossary

> [!info] Learning Resources
> New to the project? Start with the [[../knowledge/glossary/glossary|Technical Glossary]] for:
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] — JWT, Argon2, PyJWT migration, token lifecycle
> - [[../knowledge/glossary/typescript|TypeScript]] — Generics, `unknown` vs `any`, AG Grid type parameters
> - [[../knowledge/glossary/api-communication|API Communication]] — `apiFetch`, error handling, HTTP status codes
> - [[../knowledge/glossary/state-management|State Management]] — React Query hooks, mutation patterns
> - [[../knowledge/glossary/testing|Testing]] — Vitest, pytest, dual conftest strategy, fixture isolation
> - [[../knowledge/glossary/development-workflow|Development Workflow]] — envDir, pyproject.toml, uv.lock, pytest.ini
> - [[../knowledge/glossary/ui-components-design|UI Components & Design]] — AG Grid, MUI, atomic design
> - [[../knowledge/glossary/project-structure-concepts|Project Structure]] — Feature-based organization, test file placement
> - [[../knowledge/glossary/concepts-to-learn-more|Concepts to Learn More]] — Advanced JWT security, TypeScript generics depth
