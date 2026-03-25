---
Overview: "Hardening Phase 3 focuses on code quality, type safety, and security hygiene: replacing deprecated datetime APIs, eliminating TypeScript `any` types, enforcing the project's no-abbreviation naming standard, removing dead infrastructure (Storybook, test routes), and fixing a tenant membership permission bug."
Date: 2026-03-25
branch: "`hardening` → `master`"
code_changed: 44 files changed (19 modified, 25 deleted), +327 insertions, -25802 deletions
commits: uncommitted working-tree changes
tags:
  - security
  - type-safety
  - code-quality
  - cleanup
  - bugfix
---

# Hardening Phase 3: Code Quality, Type Safety & Cleanup

## Overview

This release is a code-quality sweep across the full stack, addressing deprecation warnings, TypeScript type safety violations, naming convention enforcement, and dead code removal. No new features are introduced; the goal is to harden the codebase against subtle bugs and improve maintainability.

Key themes:
1. **Deprecated API migration** — All `datetime.utcnow()` calls replaced with timezone-aware `datetime.now(timezone.utc)` to prevent silent datetime comparison bugs in Python 3.12+.
2. **TypeScript type safety** — Every `any` type in the AG Grid integration and API client eliminated in favor of proper generics and typed parameters.
3. **Naming convention enforcement** — Abbreviated variables (`tx`, `res`, `ct`, `v`, `q`, `cat`, `e`) replaced with full descriptive names per project standards.
4. **Dead infrastructure removal** — Storybook configuration, stories, test auth routes, temporary scripts, and log files removed.
5. **Bug fix** — Tenant member listing endpoint was checking a class-level attribute instead of the membership instance, silently passing all requests.
6. **Security hardening** — Transaction creation error response no longer leaks internal error details to the client.

---

## Goals Achieved

- Replace all deprecated `datetime.utcnow()` with `datetime.now(timezone.utc)` across backend
- Eliminate all `any` types from `TransactionsGrid.tsx` AG Grid integration
- Eliminate `any` types from `apiClient.ts` (error body, response parsing)
- Rename all abbreviated variables to full names (frontend components + backend)
- Remove Storybook infrastructure (config, stories, dependencies)
- Remove test auth route (`/test-auth`) and associated `__test-auth__.tsx` file
- Remove temporary backend script (`query_accounts_temp.py`)
- Remove stale log file and VS Code settings from repo
- Fix tenant member listing permission check bug
- Stop leaking internal error messages in transaction creation endpoint
- Switch password hashing dependency from `passlib[bcrypt]` to `passlib[argon2]`
- Expand `.gitignore` with coverage, logs, and IDE patterns

---

## Architecture & Tech Stack Changes

> [!info] Related Concepts
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] — JWT token handling, HttpOnly cookies, datetime security
> - [[../knowledge/glossary/typescript|TypeScript]] — Generics, type safety, eliminating `any` types
> - [[../knowledge/glossary/api-communication|API Communication]] — `apiFetch` client, error handling patterns
> - [[../knowledge/glossary/testing|Testing]] — Test infrastructure cleanup, Vitest conventions
> - [[../knowledge/glossary/development-workflow|Development Workflow]] — Build configuration, Storybook removal
> - [[../knowledge/glossary/project-structure-concepts|Project Structure]] — File organization after cleanup

### Dependency Changes

| Change | Before | After | Why |
|--------|--------|-------|-----|
| Password hashing extra | `passlib[bcrypt]` | `passlib[argon2]` | Aligns declared dependency with the Argon2 hasher already in use |
| Storybook | 6 packages installed | Removed | Storybook was unused; stories were stale and unmaintained |

### Storybook Removal

Storybook and all 17 story files have been completely removed. The project relies on Vitest + React Testing Library for component validation. This removes ~1,900 lines of lock file churn and 6 dev dependencies.

---

## Directory Structure

### Backend

```
backend/api/app/
  ✏️ auth.py                         — datetime.utcnow() → datetime.now(timezone.utc)
  routers/
    ✏️ auth.py                       — datetime migration (12 call sites)
    ✏️ budgets.py                    — datetime migration (6 call sites)
    ✏️ tenants.py                    — Fix member listing permission check
    ✏️ transactions.py               — Secure error handling, add logging
backend/api/tests/
  ✏️ test_budget_endpoints.py        — datetime migration in test fixtures
✏️ backend/pyproject.toml            — passlib[bcrypt] → passlib[argon2]
✏️ backend/uv.lock                   — Lock file updated
❌ backend/api/query_accounts_temp.py — Temporary debug script removed
```

### Frontend

```
✏️ .gitignore                                    — Add coverage/, logs, IDE patterns
❌ .vscode/settings.json                          — IDE settings removed from repo
❌ frontend/.storybook/main.ts                    — Storybook config removed
❌ frontend/.storybook/preview.tsx                — Storybook config removed
✏️ frontend/package.json                          — Remove Storybook deps and scripts
✏️ frontend/package-lock.json                     — Lock file updated
frontend/src/
  components/
    domain/
      ✏️ CategorySelect.tsx                       — Rename `cat` → `category`
    modals/
      ✏️ TransactionDetailModal.tsx                — Rename `tx` → `transactionData`
    molecules/
      ✏️ TransactionListItem.tsx                   — Rename `tx` prop/var → `transaction`
      ✏️ TransactionsFilterBar.tsx                 — Rename `q` → `searchQuery`
    organisms/
      ✏️ TransactionsGrid.tsx                      — Remove all `any` types, add AG Grid generics
      ✏️ TransactionsList.tsx                      — Rename `tx` → `transaction`
  lib/
    ✏️ apiClient.ts                               — Replace `any` with `unknown`, rename vars
  router/
    ✏️ index.tsx                                  — Remove /test-auth route
❌ frontend/src/features/auth/__test-auth__.tsx   — Test auth page removed
❌ frontend/src/lib/__test-apiclient__.ts         — Test API client removed
❌ frontend/src/types/ag-grid.d.ts                — Unused type declarations removed
❌ frontend/src/stories/*.stories.tsx             — 17 story files removed
❌ remoteContainers-*.log                          — Stale log file removed
```

---

## Files Changed — Detailed Breakdown

### 1. Security: Deprecated Datetime Migration (Backend)

> See [[../knowledge/glossary/authentication-security|Authentication & Security]] for JWT token lifecycle and datetime handling in auth flows.

**Files**: `auth.py`, `routers/auth.py`, `routers/budgets.py`, `test_budget_endpoints.py`

Python's `datetime.utcnow()` is deprecated since Python 3.12 and returns a naive datetime object that can cause subtle comparison bugs with timezone-aware datetimes. All call sites (20+) migrated to `datetime.now(timezone.utc)` which returns a proper timezone-aware datetime.

**Pattern**:
```python
# Before (deprecated, returns naive datetime)
expiration_time = datetime.utcnow() + timedelta(minutes=15)

# After (timezone-aware, correct)
expiration_time = datetime.now(timezone.utc) + timedelta(minutes=15)
```

### 2. Bug Fix: Tenant Member Listing Permission Check

**File**: `routers/tenants.py`

The `list_members_for_tenant` endpoint had a critical logic bug: it was checking `Membership.status == MembershipStatus.ACTIVE` (a class-level comparison that always evaluates to a truthy SQLAlchemy expression) instead of checking the actual membership record. This meant the permission check never rejected anyone.

```python
# Before (always truthy — checks class attribute, not instance)
if Membership.status == MembershipStatus.ACTIVE:
    raise HTTPException(...)

# After (correctly checks the requesting user's membership instance)
if membership_record.status != MembershipStatus.ACTIVE:
    raise HTTPException(...)
```

The condition was also inverted — the original raised an error when status *was* active (the opposite of the intent).

### 3. Security: Error Message Leakage

**File**: `routers/transactions.py`

The transaction creation endpoint was leaking internal error details to the client via `f"Failed to create transaction: {str(error)}"`. This could expose database schema details, constraint names, or other sensitive information.

```python
# Before — leaks internal error details
detail=f"Failed to create transaction: {str(error)}"

# After — generic message + server-side logging
logger.exception("Failed to create transaction")
detail="Failed to create transaction"
```

### 4. TypeScript Type Safety: TransactionsGrid

> See [[../knowledge/glossary/typescript|TypeScript]] for generic type patterns and [[../knowledge/glossary/ui-components-design|UI Components & Design]] for AG Grid conventions.

**File**: `TransactionsGrid.tsx`

Every AG Grid callback and formatter used `any` types. Replaced with proper AG Grid generics (`ColDef<Transaction>`, `ValueFormatterParams<Transaction>`, `ICellRendererParams<Transaction>`, etc.). Also:
- Removed unused `ColumnApi` import and ref (deprecated in AG Grid 31+)
- Added null-safe access on `params.data?.` where AG Grid may pass undefined
- Typed event handlers (`RowClickedEvent<Transaction>`, `React.ChangeEvent<unknown>`)
- Renamed catch variables from `e` to descriptive names

### 5. TypeScript Type Safety: apiClient

> See [[../knowledge/glossary/api-communication|API Communication]] for `apiFetch` patterns and error handling conventions.

**File**: `apiClient.ts`

- `ApiError.body` changed from `any` to `unknown`
- Response `payload` typed as `unknown` instead of `any`
- Content-type variable renamed from `ct` to `contentType`
- Response variable renamed from `res` to `response`
- Error message extraction uses proper type narrowing with `Record<string, unknown>`

### 6. Naming Convention Enforcement (Frontend)

| File | Before | After |
|------|--------|-------|
| `TransactionDetailModal.tsx` | `tx` | `transactionData` |
| `TransactionListItem.tsx` | `tx` (prop + usage) | `transaction` |
| `TransactionsList.tsx` | `tx` | `transaction` |
| `TransactionsFilterBar.tsx` | `q` | `searchQuery` |
| `CategorySelect.tsx` | `cat` | `category` |
| `TransactionsGrid.tsx` | `v`, `e`, `val` | `numericValue`, `gridError`, `value` |
| `apiClient.ts` | `res`, `ct` | `response`, `contentType` |

### 7. Storybook Removal

**Deleted files**: `.storybook/main.ts`, `.storybook/preview.tsx`, 17 `*.stories.tsx` files

**Removed dependencies** (from `package.json`):
- `@chromatic-com/storybook`
- `@storybook/addon-essentials`
- `@storybook/react`
- `@storybook/react-vite`
- `storybook`

**Removed scripts**: `storybook`, `build-storybook`

### 8. Dependency Alignment

**File**: `backend/pyproject.toml`

Changed `passlib[bcrypt]==1.7.4` to `passlib[argon2]==1.7.4`. The codebase already uses Argon2 for password hashing (via `argon2-cffi`), but the passlib extra was still pulling in bcrypt. This aligns the declared dependency with actual usage.

### 9. Cleanup: Dead Code & Files

| Deleted File | Reason |
|-------------|--------|
| `__test-auth__.tsx` | Debug/test page, not needed in production |
| `__test-apiclient__.ts` | Test utility superseded by proper test infrastructure |
| `ag-grid.d.ts` | Unused custom type declarations (proper AG Grid types now imported directly) |
| `query_accounts_temp.py` | Temporary debug script |
| `.vscode/settings.json` | IDE-specific settings should not be in repo |
| `remoteContainers-*.log` | Stale log file accidentally committed |

### 10. .gitignore Improvements

Added patterns for:
- `frontend/coverage/` — Test coverage reports
- `*.log` — Log files
- `.vscode/settings.json` — IDE settings
- Removed duplicate `.claude/settings.local.json` entry
- Fixed comment formatting

---

## Testing Strategy

- Budget endpoint tests updated to use `datetime.now(timezone.utc)` matching production code
- No behavioral changes to existing tests — all changes are mechanical datetime API migrations
- The tenant member listing bug fix should be covered by existing or new tenant tests

---

## Migration Notes

- **No breaking API changes** — All changes are internal
- **No database migrations required** — No model changes
- **Frontend prop rename**: `TransactionListItem.tx` → `TransactionListItem.transaction` — any external consumers of this component need to update
- **Frontend callback rename**: `TransactionsFilterBar.onSearch` parameter renamed from `q` to `searchQuery` (type-only change, no runtime impact)
- **`npm install` required** — Storybook dependencies removed from `package.json`
- **`uv sync` required** — Backend lock file updated for passlib[argon2]

---

## Next Steps / Follow-up Work

- Add backend tests for the tenant member listing permission fix
- Consider adding a linting rule to prevent `datetime.utcnow()` usage
- Consider adding an ESLint rule or TypeScript strict mode to prevent `any` types
- Evaluate whether `ag-grid.d.ts` custom types are needed for any other grid instances

---

## Related Documentation

- [Hardening Release (Phase 1)](Hardening_Release.md) — Proxy, RBAC, modal navigation
- [Hardening Phase 2 Release](Hardening_Phase2_Release.md) — Previous hardening work
- [CLAUDE.md](../../CLAUDE.md) — Variable naming standards and coding conventions

### Technical Glossary

> [!info] Learning Resources
> New to the project? Start with the [[../knowledge/glossary/glossary|Technical Glossary]] for:
> - [[../knowledge/glossary/typescript|TypeScript]] — Generics, `unknown` vs `any`, type narrowing
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] — JWT, Argon2, timezone-aware datetimes
> - [[../knowledge/glossary/api-communication|API Communication]] — `apiFetch`, error handling, HTTP status codes
> - [[../knowledge/glossary/testing|Testing]] — Vitest, React Testing Library, MSW
> - [[../knowledge/glossary/development-workflow|Development Workflow]] — npm scripts, build configuration
> - [[../knowledge/glossary/ui-components-design|UI Components & Design]] — AG Grid, MUI, atomic design
> - [[../knowledge/glossary/project-structure-concepts|Project Structure]] — Feature-based organization, file conventions
> - [[../knowledge/glossary/concepts-to-learn-more|Concepts to Learn More]] — Advanced JWT security, TypeScript advanced types
