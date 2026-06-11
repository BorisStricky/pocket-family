---
Overview: "Resolves both QCSD ship-blocking defects — cross-tenant account write (C-1) and balance drift on edit/delete (Blocker 2) — plus three high-priority follow-ups (IDOR on GET /accounts/{id}, refresh-token reuse detection, and unbounded transaction reads). 13 files, 611 net lines."
Date: 2026-06-10
branch: "`agentic-qe-hardening` → `development`"
code_changed: 13 files changed, +611 insertions, -30 deletions
commits: 1 commit (fix(security,perf): harden transactions/accounts/auth per QCSD findings)
test_coverage: 302 lines of new targeted tests across 3 new test files
tags:
  - security
  - backend
  - hardening
  - qcsd
---

# QCSD Security & Money-Correctness Hardening

## Overview

This branch closes every ship-blocking and high-priority item surfaced by the **QCSD Development Swarm** (see [`Agentic QCSD/development/01-executive-summary.md`](../../Agentic%20QCSD/development/01-executive-summary.md)). The two critical blockers — a cross-tenant write that let any authenticated member corrupt another user's balance, and a money-correctness defect where editing or deleting a transaction left account balances permanently wrong — are both fixed and covered by new failing-first tests. Three high-priority follow-ups (IDOR on account reads, refresh-token theft via reuse, unbounded transaction reads) are resolved in the same commit. No pre-existing test was removed; all 225 backend functions continue to pass.

---

## Goals Achieved

- **Blocker 1 (Security C-1) closed**: `create_transaction` now enforces the same account-ownership/share guard already present in the import path — any attempt to write against an arbitrary account UUID is rejected 403.
- **Blocker 2 (money-correctness) closed**: `update_transaction` and `delete_transaction` now reverse-then-re-apply the account balance delta in the same DB transaction; balance is always correct after any mutation.
- **H-1 (IDOR on `GET /accounts/{id}`) closed**: The endpoint returns 404 (not the account body) for any UUID the requestor neither owns nor shares.
- **H-2 (refresh-token reuse) closed**: A replayed already-rotated refresh token immediately revokes the entire token family, forcing re-login for both the attacker and the legitimate holder.
- **P-1 (unbounded transaction reads) addressed**: `GET /transactions` gains `limit`/`offset` query params; server enforces a hard ceiling of 500 rows so no single request can trigger an unbounded scan.
- **P-2 (missing composite indexes) addressed**: Two composite indexes — `(tenant_id, transaction_date)` and `(tenant_id, account_id, transaction_date)` — added via Alembic to serve the hot list/report/per-account read paths.
- **I-1 (mandatory cross-tenant isolation tests) closed**: New test file exercises list isolation and cross-tenant write denial for transactions.
- **Frontend pagination wired up**: `AgTransactionsGrid`, `transactionsApi`, and `TransactionFilters` updated to surface `limit`/`offset`/`paginationPageSize` to callers.

---

## Architecture & Tech Stack Changes

### New shared authorization helper — `_authorize_account_for_tenant`

Added to `routers/transactions.py`. Mirrors the guard already in `imports.py:435-446` exactly: the active user must own the account, or the account must have an `AccountShare` row pointing to the active tenant. All three mutation endpoints (`create`, `update`, `delete`) now call this helper rather than doing a bare `db.get(Account, id)`.

### New balance-delta helper — `_balance_delta`

A pure function in `routers/transactions.py` that converts `(transaction_type, amount)` → signed `Decimal`. All balance mutations now call this helper, making the arithmetic explicit and testable in isolation. Reversing an effect is `account.balance -= _balance_delta(...)` throughout.

### Refresh-token family revocation

`RefreshToken` model gains a `family_id: UUID` column (indexed). On login, a new UUID is minted as the family root; on rotation, the child token inherits the parent's `family_id`. On reuse detection, a single `UPDATE … WHERE family_id = ?` revokes the entire chain. The migration backfills existing rows (each token becomes its own single-member family).

### `GET /transactions` — bounded reads

`MAX_TRANSACTIONS_PAGE_SIZE = 500` is the server-enforced ceiling. `limit` and `offset` Query params are added. The `ORDER BY transaction_date DESC` precedes the `LIMIT` so the most-recent rows are always visible even when the set is truncated. Pydantic v2 compatibility: `regex=` → `pattern=` in the `scope` Query field.

---

## Directory Structure

```
backend/
  api/
    app/
      models.py                          ✏️ MODIFIED — adds family_id to RefreshToken, composite indexes to Transaction
      routers/
        transactions.py                  ✏️ MODIFIED — blocker 1+2 fixes, pagination, shared helpers
        accounts.py                      ✏️ MODIFIED — IDOR fix on GET /{account_id}
        auth.py                          ✏️ MODIFIED — reuse detection, family_id propagation
    alembic/versions/
      aa11bb22cc33_add_refresh_token_family_id.py  🆕 NEW — migration for family_id column + index
      bb22cc33dd44_add_transaction_composite_indexes.py  🆕 NEW — migration for composite transaction indexes
    tests/
      test_transaction_hardening.py      🆕 NEW — Blocker 1, Blocker 2, I-1 isolation tests (9 scenarios)
      test_account_idor.py               🆕 NEW — H-1 IDOR access-control tests (2 scenarios)
      test_refresh_token_reuse.py        🆕 NEW — H-2 reuse detection tests (2 scenarios)
frontend/
  src/
    components/domain/ag/
      AgTransactionsGrid.tsx             ✏️ MODIFIED — pagination prop, paginationPageSize, page-size selector
    features/transactions/
      api/transactionsApi.ts             ✏️ MODIFIED — forwards limit/offset to backend
      types/index.ts                     ✏️ MODIFIED — adds limit/offset to TransactionFilters
    features/dashboard/components/
      RecentTransactionsWidget.tsx       ✏️ MODIFIED — minor display tweak
```

---

## Files Changed — Detailed Breakdown

### Backend Security & Correctness Fixes

**`backend/api/app/routers/transactions.py`**
- **Status**: MODIFIED (+148 lines, -10 lines net significant change)
- **Purpose**: Core transactions router — handles create/list/update/delete for the most-sensitive financial data.
- **Key Changes**:
  - `_authorize_account_for_tenant()`: new async helper that enforces owner-or-share access, mirrors `imports.py`. Used by `create_transaction`, `update_transaction`, and (implicitly, via the pre-validation) `delete_transaction`.
  - `_balance_delta()`: pure helper computing signed balance impact from `(type, amount)`. Replaces inline if/elif and centralizes the arithmetic for testing.
  - `create_transaction`: bare `db.get(Account, ...)` replaced with `_authorize_account_for_tenant(...)` — closes Blocker 1.
  - `update_transaction`: captures `previous_account_id` + `previous_delta` before mutating, then re-applies net difference (same account) or full reverse+apply (account change) — closes Blocker 2.
  - `delete_transaction`: reverses balance before DELETE — closes Blocker 2.
  - `list_transactions`: adds `limit`/`offset` params, `MAX_TRANSACTIONS_PAGE_SIZE = 500` ceiling, `query.offset().limit()` applied after `ORDER BY` — closes P-1.
- **Impact**: All transaction mutations are now correct and access-controlled. Read path is bounded.

**`backend/api/app/routers/accounts.py`**
- **Status**: MODIFIED (+41 lines, -0 lines)
- **Purpose**: Account CRUD router.
- **Key Changes**: New `_requestor_can_access_account()` helper checks owner-or-share via `Membership` + `AccountShare` joins. `get_account` now returns 404 (not account body) for unauthorized UUIDs — closes H-1. Returns 404 rather than 403 so the endpoint does not confirm UUID existence to an attacker.
- **Impact**: Account metadata (type, currency, owner PII) is no longer readable by arbitrary authenticated users.

**`backend/api/app/routers/auth.py`**
- **Status**: MODIFIED (+31 lines, -7 lines)
- **Purpose**: Authentication endpoints including refresh-token rotation.
- **Key Changes**: `/auth/refresh` now fetches the token regardless of `revoked` state. If it's already revoked, an `UPDATE … WHERE family_id = ?` revokes every descendant before returning 401. New tokens inherit `family_id` from the rotated token. Closes H-2.
- **Impact**: A stolen refresh token, if replayed after the victim already rotated, invalidates every session in the chain — both attacker and victim must re-authenticate.

**`backend/api/app/models.py`**
- **Status**: MODIFIED (+15 lines, -1 line)
- **Purpose**: SQLModel database models.
- **Key Changes**: `RefreshToken` gains `family_id: UUID` (default `uuid4`, indexed). `Transaction.__table_args__` adds two composite indexes: `ix_transaction_tenant_date` and `ix_transaction_tenant_account_date`.
- **Impact**: Schema changes require the two new migrations below; backfill is handled in the migration itself.

### Database Migrations

**`backend/api/alembic/versions/aa11bb22cc33_add_refresh_token_family_id.py`**
- **Status**: NEW
- **Purpose**: Adds `family_id` column to `refreshtoken` table. Backfills existing rows (each gets its own UUID as family, using `id` to keep them distinct). Enforces NOT NULL and creates index.

**`backend/api/alembic/versions/bb22cc33dd44_add_transaction_composite_indexes.py`**
- **Status**: NEW
- **Purpose**: Creates `ix_transaction_tenant_date` and `ix_transaction_tenant_account_date` composite indexes on the `transaction` table. Both downgrade paths drop the indexes cleanly.

### New Tests (3 files, 302 lines, 13 scenarios)

**`backend/api/tests/test_transaction_hardening.py`** (211 lines, 9 scenarios)
- **Status**: NEW
- **Covers**:
  - Blocker 1: attacker POSTing against owner's account UUID → 403, owner balance unchanged.
  - Blocker 1: owner POSTing against own account → 200, balance correct.
  - Blocker 2: edit amount → balance re-calculated correctly.
  - Blocker 2: edit type expense→income → balance direction flips.
  - Blocker 2: reassign account → source restored, target debited.
  - Blocker 2: delete transaction → balance restored to pre-creation value.
  - I-1: list transactions returns only active tenant's rows.
  - I-1: cross-tenant transaction read returns 404.
  - I-1: cross-tenant transaction delete returns 403/404.

**`backend/api/tests/test_account_idor.py`** (43 lines, 2 scenarios)
- **Status**: NEW
- **Covers**: Stranger accessing owner's account UUID → 404. Owner reading own account → 200 with correct id.

**`backend/api/tests/test_refresh_token_reuse.py`** (48 lines, 2 scenarios)
- **Status**: NEW
- **Covers**: Normal rotation yields different token. Reusing an already-rotated token → 401, AND the legitimate successor token is also revoked (whole family killed).

### Frontend — Pagination Support

**`frontend/src/components/domain/ag/AgTransactionsGrid.tsx`**
- **Status**: MODIFIED
- **Key Changes**: New optional `pagination` (default `true`) and `paginationPageSize` (default `25`) props. `PAGINATION_PAGE_SIZE_OPTIONS = [25, 50, 100]` enables AG Grid's page-size selector. The grid now paginates client-side over whatever the backend delivers in one bounded response.

**`frontend/src/features/transactions/api/transactionsApi.ts`**
- **Status**: MODIFIED
- **Key Changes**: `fetchTransactions` forwards `filters.limit` and `filters.offset` to the backend when present. Existing callers that don't pass these params are unaffected (server applies its bounded default).

**`frontend/src/features/transactions/types/index.ts`**
- **Status**: MODIFIED
- **Key Changes**: `TransactionFilters` interface gains optional `limit?: number` and `offset?: number` fields. Both are typed `number` to match FastAPI's Query param types.

---

## Testing Strategy

| Test File | Scenarios | What it Kills |
|-----------|-----------|---------------|
| `test_transaction_hardening.py` | 9 | Blocker 1 mutants (cross-tenant write), Blocker 2 mutants (balance drift), I-1 isolation gap |
| `test_account_idor.py` | 2 | H-1 IDOR survivors |
| `test_refresh_token_reuse.py` | 2 | H-2 reuse survivors |

All tests read `account.balance` directly after every mutation — the failing-first approach the QCSD mutation analysis recommended. The prior mutation effectiveness on the edit/delete path was estimated ~0–10%; these tests are designed to kill every surviving mutant on that path.

---

## Migration Notes

Two migrations must be applied in order (they chain: `bb22…` depends on `aa11…`):

```bash
cd backend/api
alembic upgrade head
```

**Downgrade**: both migrations implement `downgrade()` — `drop_column` / `drop_index` respectively — so rollback is safe.

**Existing refresh tokens**: each existing `RefreshToken` row is backfilled with `family_id = id`. This is safe; single-token families do not participate in reuse detection unless a token in the family is replayed.

---

## Performance Impact

- Two new composite indexes speed up `GET /transactions` list/date-range/per-account queries at the cost of slightly larger write overhead — acceptable given the read-heavy access pattern.
- `GET /transactions` now returns at most 500 rows per request. Clients that previously received unbounded results will see a bounded response; the frontend grid paginates over it client-side.

---

## Next Steps / Follow-up Work

From the QCSD executive summary, the remaining CONDITIONAL items not addressed in this PR:

| ID | Item | Suggested Follow-up |
|----|------|---------------------|
| F-2 | Last-owner guard on `PATCH /tenants/{id}/members` | Add before owner count drops to zero |
| F-4 | Grantor membership check on `POST /accounts/{id}/shares` | Requires verifying grantor is active member of the target tenant |
| P-2 (budget) | `extract()`-based budget queries are non-sargable | Refactor to date-range predicate |
| F-6 | Role checks duplicated across routers | Centralize into `require_role` dependency |
| Coverage | No verified coverage baseline exists | Run `pytest --cov=app --cov-report=xml` in CI and pin the artifact |

---

## Related Documentation

- [`Agentic QCSD/development/01-executive-summary.md`](../../Agentic%20QCSD/development/01-executive-summary.md) — Root QCSD report that motivated all changes
- [`Agentic QCSD/development/05-security-scan.md`](../../Agentic%20QCSD/development/05-security-scan.md) — Security scan detail (C-1, H-1, H-2)
- [`Agentic QCSD/development/07-mutation-testing.md`](../../Agentic%20QCSD/development/07-mutation-testing.md) — Mutation analysis (Blocker 2 near-zero effectiveness)
- [`docs/SystemArchitecture.md`](../SystemArchitecture.md) — Multi-tenant design and auth flow
- [`docs/Pull Requests/Hardening_Phase2_Master_Release.md`](Hardening_Phase2_Master_Release.md) — Prior hardening release for style reference
