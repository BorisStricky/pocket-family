---
Overview: "QCSD security hardening + services-layer extraction + N+1 elimination + import resilience + coverage gap closure. 53 files, 9 commits. Routers fully thinned; 2,929 lines of framework-agnostic domain logic live in app/services/; 286 backend tests at 88% statement coverage."
Date: 2026-06-16
branch: "`agentic-qe-hardening` → `development`"
code_changed: 53 files changed, +5,859 insertions, -2,041 deletions
commits: 9 commits
test_coverage: "Backend 88% statements (286 tests); frontend apiClient 96.6%, jwtUtils ~98%"
tags:
  - security
  - backend
  - refactor
  - performance
  - hardening
  - qcsd
  - services-layer
  - import-service
---

# QCSD Hardening, Services Layer, and Import Resilience

## Overview

This branch closes every item from the **QCSD Development Swarm** — two critical blockers and all HIGH findings — then follows up with a structural refactor that was identified as the root cause: inline authorization and DB logic scattered across all seven routers. A new `app/services/` layer extracts all DB queries and business rules into framework-agnostic domain modules; routers become a thin HTTP boundary. List-endpoint N+1s found during the services extraction are folded into the same PR. The self-hosted import path gains broker-down resilience and bounded Celery retry. Coverage is measured accurately for the first time (async routes were under-reporting by ~40 points) and gap-filling tests close every high-risk uncovered branch.

The previous `QCSD_Security_Hardening_Release.md` documents the initial two commits (security/money-correctness fixes); this document covers the full branch including the subsequent refactor, N+1 elimination, import hardening, and coverage work.

---

## Goals Achieved

- **Two blockers closed** (cross-tenant account write, balance drift on edit/delete) — covered by 9 new failing-first tests.
- **Three QCSD HIGH findings addressed**: Finding 1 (share-target guard gap — real, fixed), Finding 2 (account role guard — false positive, documented), Finding 3 (AccountShare write scope — real, centralized + follow-up flagged).
- **`require_role` dependency** replaces ~15 inline per-handler role checks across five routers; fixes a string-vs-enum latent bug in `auth.py`.
- **`app/services/` layer** introduced: 9 modules (~2,929 lines) covering all seven router domains. Zero raw DB operations remain in any router handler (verified by sweep).
- **N+1 queries eliminated** on three list paths (accounts, budgets, account-shares).
- **Two bug fixes**: `create_account` no longer swallows `HTTPException` as 500; `apply_membership_update` returns 404 instead of 500 on a missing membership.
- **Import broker-down resilience**: dispatch failure now sets job FAILED + returns 503 (retryable) instead of a bare 500 that left the frontend polling forever.
- **Celery task retry binding**: bounded `autoretry_for` (max 3, backoff+jitter) scoped to transient infra errors only; deterministic errors fail fast.
- **Real coverage measurement**: `pytest-cov` with greenlet+thread-aware concurrency traces async routes correctly. Backend at 88% (286 tests).
- **Coverage gaps closed**: `deps.py` auth-context error branches, rate-limit 429 cap, S3 storage adapter, imports error branches, `apiClient.ts` token-refresh edge cases, `jwtUtils.ts` edge cases.
- **Frontend flaky test stabilized**: CPU-contention timeout on the heavy nested-dialog test fixed by capping Vitest workers and adding a per-test budget.

---

## Architecture Changes

### `app/services/` — new domain layer

A new `backend/api/app/services/` package holds all DB-interacting and business logic previously inlined in routers. The layer is **framework-agnostic**: functions take a plain `AsyncSession` as their first parameter and never import FastAPI or use `Depends`, making them reusable and unit-testable outside the request cycle.

The atomicity invariant that accompanies this: **services stage and prepare** (`add`, `delete`, `flush` for internal write ordering); **the router handler owns the unit-of-work boundary** (`commit` / `rollback` / `refresh`). A service may `flush` only for its own FK-ordering needs; it never commits. This keeps multi-step handlers (e.g. `create_account` = account insert + optional `AccountShare`) atomic with a single commit point.

**Naming conventions** established (documented in `backend/CLAUDE.md`):

| Pattern | Purpose |
|---|---|
| `build_<entity>_read(session, ...)` | Assemble the API response DTO (joins, enrichment, balance-visibility masking) |
| `can_<verb>_<entity>(session, ...) -> bool` | Authorization predicate — returns bool, never raises |
| `authorize_<thing>(session, ...)` | Validate and **raise** `HTTPException` on failure; return the validated object on success |
| plain descriptive names | Pure helpers with no side-effects (`balance_delta`, `rows_to_transaction_reads`) |

### `require_role` — centralized role dependency

`deps.py` gains `require_role(*allowed_roles)` plus two intent-revealing aliases:

```python
require_owner = require_role(MembershipRole.OWNER)
require_writer = require_role(MembershipRole.OWNER, MembershipRole.MEMBER)  # blocks VIEWERs
```

Routes swap `Depends(get_active_context)` → `Depends(require_owner)` or `Depends(require_writer)` and delete the now-redundant inline `if role != ...: raise 403` block. The dependency returns the same `ActiveContext` so handlers are otherwise unchanged.

**Not applied to `tenants.py` path-tenant endpoints**: those authorize against a path-parameter `tenant_id` that can differ from the active tenant; `require_role` keys off the active-tenant membership and would be incorrect there.

### N+1 elimination on list paths

| Endpoint | Before | After |
|---|---|---|
| `GET /accounts` (owned) | N+1: per-row owner-name lookup | Single join via `select(Account, User)` |
| `GET /accounts` (shared) | N+1: per-row balance-visibility check | Single join via `select(Account, AccountShare, Membership)` |
| `GET /budgets` | 2N+1: per-budget category fetch + spent calc | ~3 queries via `fetch_categories_for_budgets` + `calculate_spent_for_budgets` |
| `GET /accounts/{id}/shares` | N per share: tenant-name lookup | One join via `list_share_reads_for_account` |

Shared balance-masking logic consolidated into `_resolve_visible_balance` / `_account_read_dict` to keep the policy in one place; `build_account_read` remains for single-account reads.

### Import broker-down resilience

`routers/imports.py` now wraps `celery_client.send_task(...)` in `try/except`. On dispatch failure:

1. Calls `services/imports.py::mark_import_job_failed()` to flip the already-committed `ImportJob` to `FAILED` in its own transaction.
2. Returns `HTTP 503` (retryable) instead of a bare `500` that left the frontend polling a `PENDING` job forever.

### Celery task bounded retry

`import-service/app/tasks/celery_tasks.py` adds `autoretry_for` scoped to transient infra errors only (`OperationalError`, `InterfaceError`, `ConnectionError`), with `max_retries=3`, `retry_backoff=True`, `retry_jitter=True`. Deterministic errors (`ValueError` from bad CSV data) are not retried and fail fast to a `FAILED` row — the self-host DLQ equivalent. The `!= 'DONE'` idempotency guard in `process_import` means retried tasks are safe.

---

## Directory Structure

```
backend/api/
  app/
    deps.py                              ✏️ MODIFIED — adds require_role + require_owner/require_writer aliases
    models.py                            ✏️ MODIFIED — RefreshToken.family_id, Transaction composite indexes
    services/                            🆕 NEW PACKAGE — framework-agnostic domain layer
      __init__.py                        🆕 NEW — package docstring + layering contract
      accounts.py                        🆕 NEW — build_account_read, build_account_share_read, can_access_account,
                                                    authorize_share_target, mark_import_job_failed (468 lines)
      auth.py                            🆕 NEW — resolve_membership_for_user + token/session helpers (344 lines)
      budgets.py                         🆕 NEW — build_budget_read, validate_category_ids_belong_to_tenant,
                                                    sync_budget_categories, batch list helpers (608 lines)
      categories.py                      🆕 NEW — build_category_read + list helpers (274 lines)
      imports.py                         🆕 NEW — decode_csv_bytes, parse_csv, parse_amount, normalize_type,
                                                    validate_file_key_ownership, mark_import_job_failed (348 lines)
      tenants.py                         🆕 NEW — all tenant CRUD and member-management services (364 lines)
      transactions.py                    🆕 NEW — authorize_account_for_tenant, balance_delta,
                                                    build_transaction_read, rows_to_transaction_reads (463 lines)
      users.py                           🆕 NEW — user profile services (41 lines)
    routers/
      accounts.py                        ✏️ MODIFIED — thinned; N+1 list queries fixed; authorize_share_target wired
      auth.py                            ✏️ MODIFIED — thinned; require_owner replaces string "owner" comparison
      budgets.py                         ✏️ MODIFIED — thinned; require_owner on writes; N+1 list fixed
      categories.py                      ✏️ MODIFIED — thinned; require_owner on writes
      imports.py                         ✏️ MODIFIED — thinned; require_writer on writes; broker-down 503 guard
      tenants.py                         ✏️ MODIFIED — thinned (path-tenant auth preserved as-is)
      transactions.py                    ✏️ MODIFIED — thinned; require_writer on writes; balance fixes
      users.py                           ✏️ MODIFIED — thinned
  alembic/versions/
    aa11bb22cc33_add_refresh_token_family_id.py  🆕 NEW — family_id column + backfill + index
    bb22cc33dd44_add_transaction_composite_indexes.py  🆕 NEW — two composite transaction indexes
  tests/
    test_account_idor.py                 🆕 NEW — H-1 IDOR access-control (2 scenarios)
    test_refresh_token_reuse.py          🆕 NEW — H-2 token family revocation (2 scenarios)
    test_transaction_hardening.py        🆕 NEW — Blockers 1+2 + I-1 isolation (9 scenarios)
    test_deps_context.py                 🆕 NEW — get_active_context error branch coverage (125 lines, 7+ scenarios)
    test_rate_limit.py                   🆕 NEW — 429 brute-force cap regression guard (37 lines)
    test_imports_storage_s3.py           🆕 NEW — S3 storage adapter delegation + failure paths (153 lines)
    test_account_share_crud.py           ✏️ MODIFIED — +220 lines; authorize_share_target guard scenarios
    test_accounts_endpoints.py           ✏️ MODIFIED — +56 lines; per-row masking, atomic account+share
    test_budget_endpoints.py             ✏️ MODIFIED — +78 lines; mixed category+universal budget list
    test_imports_endpoints.py            ✏️ MODIFIED — +197 lines; 503/FAILED regression, error branches
    test_membership_crud.py              ✏️ MODIFIED — +22 lines; membership-update 404 fix scenario
import-service/
  app/tasks/
    celery_tasks.py                      ✏️ MODIFIED — bounded autoretry with backoff+jitter
  tests/
    test_celery_task_retry_config.py     🆕 NEW — retry config guards (39 lines, 4 scenarios)
frontend/src/
  components/domain/ag/
    AgTransactionsGrid.tsx               ✏️ MODIFIED — pagination prop + paginationPageSize
  features/transactions/api/
    transactionsApi.ts                   ✏️ MODIFIED — forwards limit/offset to backend
  features/transactions/types/
    index.ts                             ✏️ MODIFIED — limit/offset on TransactionFilters
  features/dashboard/components/
    RecentTransactionsWidget.tsx         ✏️ MODIFIED — minor display tweak
  lib/__tests__/
    apiClient.test.ts                    ✏️ MODIFIED — 401→refresh→retry, concurrent dedup, edge cases
    jwtUtils.test.ts                     ✏️ MODIFIED — no-exp, undecodable payload, null user edge cases
  vitest.config.ts                       ✏️ MODIFIED — maxWorkers:3, 60s per-test budget for heavy tests
docs/
  north_star.md                          ✏️ MODIFIED — §9 account user-scoped invariant + AccountShare write scope note
  plans/
    hardening-refactor-13-06.md          🆕 NEW — implementation plan for services layer + QCSD HIGH findings
  Pull Requests/
    QCSD_Security_Hardening_Release.md   🆕 NEW — PR summary for the initial security/money-correctness commits
backend/CLAUDE.md                        ✏️ MODIFIED — service layer conventions, authorization conventions,
                                                         atomicity invariant, corrected deps references
```

---

## Files Changed — Detailed Breakdown

### New Services Package (9 modules, 2,929 lines)

**`backend/api/app/services/__init__.py`**
- **Status**: NEW
- **Purpose**: Package entry point establishing the layering contract: functions take a plain `AsyncSession`, are framework-agnostic, may import from `models`/`schemas`/`db`, must never import from `routers`.

**`backend/api/app/services/accounts.py`** (468 lines)
- **Status**: NEW
- **Key functions**:
  - `build_account_read` (was `_serialize_account`): joins owner name, applies balance-visibility policy, assembles `AccountRead` DTO.
  - `build_account_share_read` (was `_serialize_account_share`): joins human-readable tenant name into `AccountShareRead`.
  - `can_access_account`: auth predicate — checks owner or active `AccountShare`.
  - `authorize_share_target`: validates a share-creation request against the target tenant (target exists, requestor is active member, requestor is not viewer). **This is the Finding 1 fix** — now guards both `create_account` and `create_account_share`, closing the gap where the dedicated share endpoint lacked this check.
  - List-optimized `_account_read_dict` / `_resolve_visible_balance` for N+1-free list responses.

**`backend/api/app/services/transactions.py`** (463 lines)
- **Status**: NEW
- **Key functions**:
  - `authorize_account_for_tenant`: the single enforcement point for cross-tenant write guard (Finding 3 centralized). Any future `SharePermission` scope will only need to be enforced here.
  - `balance_delta`: pure function converting `(type, amount)` → signed `Decimal`. All balance mutations call this one place.
  - `build_transaction_read`: joins account/category/icon names for the `TransactionRead` DTO.
  - `rows_to_transaction_reads`: batch-converts list query rows; keeps the hot list path in one query.

**`backend/api/app/services/budgets.py`** (608 lines)
- **Status**: NEW
- **Key functions**: `build_budget_read`, `validate_category_ids_belong_to_tenant`, `sync_budget_categories` (individual-budget service functions) + `fetch_categories_for_budgets` / `calculate_spent_for_budgets` (batch functions for N+1-free list path). Universal-budget spent rule preserved exactly.

**`backend/api/app/services/auth.py`** (344 lines)
- **Status**: NEW
- **Key function**: `resolve_membership_for_user` (was `get_membership_for_user`): three-tier resolution (preferred tenant → first active → 403) abstracted from the login handler.

**`backend/api/app/services/categories.py`** (274 lines), **`imports.py`** (348 lines), **`tenants.py`** (364 lines), **`users.py`** (41 lines)
- **Status**: NEW
- **Purpose**: Remaining routers' logic relocated. `tenants.py` preserves path-tenant auth semantics byte-for-byte (no `require_role` applied here). `imports.py` gains `mark_import_job_failed()` — pure staging helper for the broker-down path.

---

### `deps.py` — `require_role` and Aliases

**`backend/api/app/deps.py`**
- **Status**: MODIFIED
- **Key Changes**: `require_role(*allowed_roles)` dependency factory added — gates on `active_context.active_membership.role`, returns `ActiveContext` on success, raises 403 on failure. `require_owner` and `require_writer` aliases wired beside it.
- **Impact**: All five routers now use `Depends(require_owner)` or `Depends(require_writer)` instead of inline `if role != ...: raise HTTPException(403)`. The `auth.py` comparison against the string `"owner"` (instead of `MembershipRole.OWNER`) is also corrected.

---

### Router Thinning (7 routers)

Each router was reduced to: route decorator, dependency injection via `Depends`, `await session.commit()` / `await session.refresh()`, and orchestration calls into services. No business logic, no raw SQL. Spot-checks:

**`backend/api/app/routers/accounts.py`**
- **Key Changes**: `authorize_share_target` now called from `create_account_share` (was missing — Finding 1 fix). The `create_account` HTTPException re-raise bug fixed: errors from `authorize_share_target` were caught and re-raised as a generic 500; now re-raised as-is. List path queries are N+1-free via services.

**`backend/api/app/routers/auth.py`**
- **Key Changes**: `require_owner` replaces the inline string comparison at `create_invite`. Refresh-token rotation retains family-chain revocation from the prior hardening commit.

**`backend/api/app/routers/imports.py`**
- **Key Changes**: `send_task` wrapped in `try/except`; on failure calls `mark_import_job_failed` and returns 503. `require_writer` on all five write endpoints (was inline role checks).

**`backend/api/app/routers/tenants.py`**
- **Key Changes**: DB logic extracted; path-tenant authorization preserved (not replaced by `require_role`). `apply_membership_update` now returns 404 (was 500 via `AttributeError`) for a missing membership row.

---

### Import Service Hardening

**`import-service/app/tasks/celery_tasks.py`**
- **Status**: MODIFIED (+30 lines)
- **Key Changes**:
  - `autoretry_for=(OperationalError, InterfaceError, ConnectionError)` — transient DB/broker blips retried automatically.
  - `max_retries=3`, `retry_backoff=True`, `retry_jitter=True` — bounded with exponential backoff.
  - `ValueError` (deterministic data errors) is not in `autoretry_for` — fails fast to avoid burning retries on bad CSV data.
- **Why**: Self-host Redis path had no SQS-style DLQ and no retry binding; a transient broker hiccup lost the task permanently.

---

### New Test Files (7 files, ~992 lines, 25+ new scenarios)

**`test_deps_context.py`** (125 lines)
- **Status**: NEW
- **Covers**: Each guard inside `get_active_context`: malformed JWT claims, missing user UUID, unknown tenant UUID, revoked membership, missing preferred tenant. Previously only hit indirectly; now each path asserts the exact HTTP status so a regression that weakens the gate fails loudly.

**`test_rate_limit.py`** (37 lines)
- **Status**: NEW
- **Covers**: POST `/auth/login` 429 cap — re-enables the limiter for one focused test (it is disabled in `TEST_MODE`), proves the cap triggers, and restores `limiter.enabled=False` afterwards so no other test is affected.

**`test_imports_storage_s3.py`** (153 lines)
- **Status**: NEW
- **Covers**: S3 storage adapter method delegation (`upload`, `download`, `delete`), proper exception wrapping on `ClientError`, and `get_storage()` factory selecting S3 vs local by env var.

**`test_celery_task_retry_config.py`** (39 lines, 4 scenarios)
- **Status**: NEW (import-service)
- **Covers**: `max_retries == 3`, `autoretry_for` includes transient errors, `ValueError` is excluded, backoff+jitter flags are set. Config-level assertions require no live broker.

**`test_account_idor.py`**, **`test_refresh_token_reuse.py`**, **`test_transaction_hardening.py`**
- **Status**: NEW (from initial hardening commits, documented in `QCSD_Security_Hardening_Release.md`)
- **Covers**: H-1 IDOR (2 scenarios), H-2 token-family revocation (2 scenarios), Blockers 1+2 + I-1 isolation (9 scenarios). Total: 13 scenarios, 302 lines.

---

### Coverage Improvements

`pytest-cov` added with `--cov-config` specifying `concurrency = greenlet,thread` so it correctly traces `asyncpg` greenlets and `TestClient`'s portal thread. Without this, well-tested async routers under-reported by ~40 percentage points.

| Area | Before | After |
|---|---|---|
| Backend overall | (unmeasured accurately) | 88% statements (286 tests) |
| `deps.py` auth-context branches | 83% | 90% |
| `storage/__init__.py` | 36% | 100% |
| `storage/s3.py` | 43% | 100% |
| `imports.py` error branches | 90% | 92% |
| `apiClient.ts` | ~60% | 96.6% statements |
| `jwtUtils.ts` | ~70% | ~98% |

Frontend coverage focused on error/edge paths that don't exercise in happy-path integration tests: 401→refresh→retry loop, concurrent request deduplication, logout-on-refresh-fail, credential-endpoint guard, JWT no-exp and undecodable-payload handling.

---

### Frontend — Stability and Pagination

**`frontend/vitest.config.ts`**
- **Status**: MODIFIED
- **Key Changes**: `maxWorkers: 3` to prevent CPU-starvation across parallel workers; `testTimeout: 60000` for the heavy nested-dialog test (drives MUI Autocomplete + nested dialogs, takes ~14s in isolation). Root cause was contention, not state leakage.

**`frontend/src/components/domain/ag/AgTransactionsGrid.tsx`**
- **Status**: MODIFIED
- **Key Changes**: `pagination` (default `true`) and `paginationPageSize` (default `25`) props; `PAGINATION_PAGE_SIZE_OPTIONS = [25, 50, 100]` for the AG Grid page-size selector.

---

## Testing Strategy

| Category | Files | Scenarios | What it Guards |
|---|---|---|---|
| Security / money-correctness | `test_transaction_hardening.py`, `test_account_idor.py`, `test_refresh_token_reuse.py` | 13 | Blockers 1+2, H-1, H-2, I-1 |
| Share-target guard (Finding 1) | `test_account_share_crud.py` | 4 | Non-member/viewer can't create share via either endpoint |
| `get_active_context` error branches | `test_deps_context.py` | 7+ | Malformed claims, unknown user/tenant, revoked membership |
| Rate limiting | `test_rate_limit.py` | 1 | 429 cap on `/auth/login` |
| S3 storage adapter | `test_imports_storage_s3.py` | ~10 | Delegation, ClientError wrapping, factory selection |
| Celery retry config | `test_celery_task_retry_config.py` | 4 | Bounded retries, transient-only scope, backoff |
| N+1 regressions | `test_accounts_endpoints.py`, `test_budget_endpoints.py`, `test_account_share_crud.py` | 5 | Per-row masking, mixed-category budget list, tenant-name join |
| Import resilience | `test_imports_endpoints.py` | +8 | 503/FAILED on broker-down, error branches |

---

## Migration Notes

Two Alembic migrations (from initial hardening commits) must be applied:

```bash
cd backend/api
alembic upgrade head
```

| Migration | Change | Downgrade |
|---|---|---|
| `aa11bb22cc33` | Adds `family_id UUID` to `refreshtoken` table; backfills existing rows (each gets its `id` as a single-member family); creates index. | `drop_column`, `drop_index` |
| `bb22cc33dd44` | Adds composite indexes `ix_transaction_tenant_date` and `ix_transaction_tenant_account_date`. | `drop_index` × 2 |

No migration is required for the services layer or N+1 fixes — schema is unchanged.

---

## Performance Impact

- Two composite indexes speed up `GET /transactions` list/date-range/per-account queries.
- N+1 → join rewrites on the three list paths reduce round-trips from O(n) to O(1).
- `GET /transactions` hard-capped at 500 rows per request (P-1 from QCSD); AG Grid paginates client-side.
- Vitest maxWorkers cap reduces test-suite wall-clock time on CPU-constrained machines by preventing worker starvation.

---

## Next Steps / Follow-up Work

| ID | Item | Status |
|---|---|---|
| F-3 | AccountShare `SharePermission(READ\|READ_WRITE)` field + Alembic migration + enforcement in `authorize_account_for_tenant` | Follow-up PR — enforcement point already centralized (Finding 3 architecture complete) |
| F-5 | Last-owner guard on `PATCH /tenants/{id}/members` (prevent downgrading sole owner) | Not yet addressed |
| P-2 (budget) | `extract()`-based budget queries are non-sargable; refactor to date-range predicates | Performance follow-up |
| Tenants | Path-tenant endpoints lack a reusable `resolve_path_membership` service helper | Optional cleanup; `services/tenants.py` is the right home |
| CI | Wire `pytest --cov=app --cov-report=xml` as a CI artifact and pin the 88% baseline | Coverage regression prevention |

---

## Related Documentation

- [`docs/plans/hardening-refactor-13-06.md`](../plans/hardening-refactor-13-06.md) — Implementation plan for the services layer and QCSD HIGH findings (Parts A, B, C)
- [`docs/Pull Requests/QCSD_Security_Hardening_Release.md`](QCSD_Security_Hardening_Release.md) — Detailed breakdown of the initial security/money-correctness commits (Blockers 1+2, H-1, H-2, P-1, P-2, I-1)
- [`Agentic QCSD/development/01-executive-summary.md`](../../Agentic%20QCSD/development/01-executive-summary.md) — Root QCSD report driving all changes
- [`backend/CLAUDE.md`](../../backend/CLAUDE.md) — Service layer conventions, authorization conventions, and atomicity invariant (authoritative source of truth for these patterns)
- [`docs/north_star.md`](../north_star.md) — §9 account user-scoped invariant + AccountShare write scope note (Findings 2 & 3 documentation)
- [`docs/SystemArchitecture.md`](../SystemArchitecture.md) — Multi-tenant design and auth flow
