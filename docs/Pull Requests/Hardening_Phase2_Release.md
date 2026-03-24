---
Overview: "Hardening Phase 2 delivers three user-facing improvements — transaction creator visibility, modal safety against accidental dismissal, and automatic tenant seeding — plus a migration from pip/requirements.txt to uv for backend dependency management and local Linux development tooling."
Date: 2026-03-23
branch: "`hardening` → `development`"
code_changed: 46 files changed, +2,670 insertions, -242 deletions
commits: 14 commits (including 3 merge commits)
test_coverage: 447-line test file for seed defaults (integration tests)
tags:
  - release_notes
  - frontend
  - backend
  - ux
  - devops
---

# Hardening Phase 2: Creator Visibility, Modal Safety, Tenant Seeding & UV Migration

## Overview

This release builds on the original hardening work with three user-facing features and a significant backend tooling migration. New tenants now start with a working set of categories, a budget, and accounts instead of an empty dashboard. All modal dialogs are protected against accidental backdrop clicks (especially important on mobile). The transactions grid now shows who created each transaction. On the tooling side, backend dependency management moves from `requirements.txt` to **uv** with `pyproject.toml`.

## Goals Achieved

- **Transaction Creator Visibility**: Users can see who created each transaction in multi-family contexts, resolving ambiguity when multiple family members share accounts
- **Modal Backdrop Safety**: All 11+ dialog/modal components ignore backdrop clicks to prevent accidental data loss mid-edit, particularly on mobile
- **Automatic Tenant Seeding**: New tenants receive 12 expense categories, a Monthly Budget (R$1,000), and (on signup only) 3 starter accounts — no more empty dashboards
- **UV Package Management**: Backend migrated from `requirements.txt` to `uv` with `pyproject.toml` for faster, reproducible dependency resolution
- **Local Linux Development**: Docker Compose and Dockerfile updated for native Linux development without devcontainer dependency

---

## Architecture & Tech Stack Changes

### Backend Dependency Management: pip → uv

The backend now uses **uv** as its Python package manager:
- `backend/requirements.txt` deleted in favor of `backend/pyproject.toml`
- `backend/uv.lock` provides reproducible lockfile (1,500+ lines)
- `backend/.python-version` pins Python 3.13
- All `pip install` commands in Dockerfiles replaced with `uv sync`

### Tenant Seeding Architecture

A new module `seed_defaults.py` encapsulates all default data creation:
- Called atomically within the same DB transaction as tenant/membership creation
- Uses `flush()` instead of `commit()` so the caller controls transaction boundaries
- Two entry points: `auth.py` (signup, with accounts) and `tenants.py` (create tenant, without accounts)

### Transaction Query Enhancement

All transaction query locations now JOIN the `User` table to resolve `created_by_name`, following the existing Account/Category join pattern already in place.

---

## Directory Structure

```
backend/
  .python-version                          🆕 Pins Python 3.13 for uv
  pyproject.toml                           🆕 UV-compatible project definition with deps
  uv.lock                                  🆕 Reproducible dependency lockfile
  requirements.txt                         ❌ Replaced by pyproject.toml
  api/
    Dockerfile                             ✏️ pip → uv install commands
    app/
      seed_defaults.py                     🆕 Tenant seeding logic (categories, budget, accounts)
      schemas.py                           ✏️ Added created_by_name to TransactionRead
      routers/
        auth.py                            ✏️ Calls seed_tenant_defaults on signup
        tenants.py                         ✏️ Calls seed_tenant_defaults on tenant creation
        transactions.py                    ✏️ Joins User table for created_by_name
    tests/
      conftest.py                          ✏️ Updated test fixtures
      test_seed_defaults.py                🆕 447-line integration test suite
  scripts/
    backup_db_after_restart.sh             🆕 Production DB backup script
    seed_test_data.py                      ✏️ Updated for test environment

frontend/
  vite.config.ts                           ✏️ Minor config update
  src/
    components/
      atoms/Modal.tsx                      ✏️ Backdrop click guard (shared Modal atom)
      domain/ag/AgTransactionsGrid.tsx     ✏️ Added "Created By" column, reordered columns
      modals/TransactionDetailModal.tsx    ✏️ Backdrop click guard
      molecules/DeleteConfirmDialog.tsx    ✏️ Backdrop click guard
      ui/molecules/DeleteConfirmDialog.tsx ✏️ Backdrop click guard
    features/
      accounts/components/
        AccountShareList.tsx               ✏️ Backdrop click guard
        AddAccountModal.tsx                ✏️ Backdrop click guard
        EditShareDialog.tsx                ✏️ Backdrop click guard
        ShareAccountDialog.tsx             ✏️ Backdrop click guard
      budgets/components/
        BudgetForm.tsx                     ✏️ Backdrop click guard
        DeleteBudgetConfirm.tsx            ✏️ Backdrop click guard
      category/components/
        AddCategoryModal.tsx               ✏️ Backdrop click guard
        DeleteCategoryConfirm.tsx          ✏️ Backdrop click guard
        EditCategoryModal.tsx              ✏️ Backdrop click guard
      family/components/
        CreateFamilyModal.tsx              ✏️ Backdrop click guard
        FamilySettings.tsx                 ✏️ Backdrop click guard (2 dialogs)
        InviteMemberModal.tsx              ✏️ Backdrop click guard
        MembersList.tsx                    ✏️ Backdrop click guard
      transactions/
        components/AddTransactionModal.tsx ✏️ Backdrop click guard
        types/index.ts                     ✏️ Added created_by_name field

docker-compose.dev.yml                     ✏️ Updated for local Linux dev
Dockerfile.devcontainer                    ✏️ Updated base image / uv support
.gitignore                                 ✏️ Added uv/Python artifacts
.env.example                               ✏️ Updated example values
```

---

## Files Changed — Detailed Breakdown

### Feature 1: Transaction Creator Visibility

**PR #27 — `hardening_created-by-name`**

| File | Status | Purpose |
|------|--------|---------|
| `backend/api/app/schemas.py` | MODIFIED | Added `created_by_name: Optional[str]` to `TransactionRead` schema |
| `backend/api/app/routers/transactions.py` | MODIFIED | Added `User` JOIN in all transaction query locations to resolve creator display name |
| `frontend/src/features/transactions/types/index.ts` | MODIFIED | Added `created_by_name` field to `TransactionRead` TypeScript interface |
| `frontend/src/components/domain/ag/AgTransactionsGrid.tsx` | MODIFIED | Added "Created By" column and reordered grid: Date → Category → Amount → Description → Account → Type → Created By |

**Impact**: In multi-member families, users can now see who created each transaction directly in the grid without needing to check audit logs.

### Feature 2: Modal Backdrop Click Guard

**PR #28 — `hardening_disable-backdrop-close`**

All 11+ Dialog/Modal components were updated to ignore `backdropClick` as a close reason. ESC key and X button still close normally.

**Pattern applied** (shared Modal atom):
```typescript
const handleDialogClose = (_event: object, reason: string) => {
  if (reason === 'backdropClick') return;
  onClose();
};
```

**Components updated**: Modal (atom), TransactionDetailModal, DeleteConfirmDialog (2 locations), AccountShareList, AddAccountModal, EditShareDialog, ShareAccountDialog, BudgetForm, DeleteBudgetConfirm, AddCategoryModal, DeleteCategoryConfirm, EditCategoryModal, CreateFamilyModal, FamilySettings (2 dialogs), InviteMemberModal, MembersList, AddTransactionModal.

**Impact**: Prevents accidental data loss on mobile where stray touches easily dismiss forms mid-edit.

### Feature 3: Automatic Tenant Seeding

**PR #29 — `hardening_seed-tenant-defaults`**

| File | Status | Purpose |
|------|--------|---------|
| `backend/api/app/seed_defaults.py` | NEW | Core seeding logic — creates 12 categories (5 parents + 7 children), Monthly Budget at R$1,000, and optionally 3 accounts |
| `backend/api/app/routers/auth.py` | MODIFIED | Calls `seed_tenant_defaults(include_accounts=True)` during signup |
| `backend/api/app/routers/tenants.py` | MODIFIED | Changed `commit()` to `flush()` for atomicity; calls `seed_tenant_defaults(include_accounts=False)` on tenant creation |
| `backend/api/tests/test_seed_defaults.py` | NEW | 447-line integration test suite validating seeded data through API endpoints |

**Default categories seeded**:
- Bills
- Food → Eat Out, Groceries
- Leisure → Sports, Movies, Music
- Transport → Fuel, Taxi/Uber
- Other

**Impact**: New users see a working dashboard immediately after signup instead of empty pages requiring manual setup.

### DevOps: UV Migration & Local Development

| File | Status | Purpose |
|------|--------|---------|
| `backend/pyproject.toml` | NEW | UV-compatible project definition with all dependencies |
| `backend/uv.lock` | NEW | Reproducible lockfile (1,501 lines) |
| `backend/.python-version` | NEW | Pins Python 3.13 |
| `backend/requirements.txt` | DELETED | Replaced by pyproject.toml |
| `backend/api/Dockerfile` | MODIFIED | Uses `uv sync` instead of `pip install` |
| `docker-compose.dev.yml` | MODIFIED | Restructured for local Linux development |
| `Dockerfile.devcontainer` | MODIFIED | Updated for uv support |
| `backend/scripts/backup_db_after_restart.sh` | NEW | Shell script for production DB backup after container restart |
| `backend/scripts/seed_test_data.py` | MODIFIED | Points to test environment |

---

## Testing Strategy

### New Test Coverage

- **`test_seed_defaults.py`** (447 lines): Integration tests hitting actual API endpoints to verify:
  - 12 expense categories seeded with correct parent-child hierarchy on signup
  - Monthly Budget at R$1,000 linked to all 12 categories
  - 3 accounts (Cash, Debit, Credit) created and shared on signup
  - Tenant creation (non-signup) seeds categories and budget but NOT accounts
  - Display name derivation (user name → email prefix fallback)

### Test Approach

Tests use the standard `AsyncClient` + real database pattern (no mocks), calling `/auth/signup` and `/tenants` endpoints and then verifying seeded data through GET endpoints.

---

## Migration Notes

### Breaking Changes
- **Backend requires uv**: `pip install -r requirements.txt` no longer works. Use `uv sync` instead.
- **Python 3.13 required**: Pinned via `.python-version`

### Required Steps
1. Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. Run `cd backend && uv sync --all-extras` to install dependencies
3. Existing tenants are NOT retroactively seeded — only new tenants get defaults

---

## Next Steps / Follow-up Work

- Consider a one-time migration script to seed defaults for existing tenants
- Add user preference to customize default category sets
- Consider making the default budget amount configurable per locale
- Extend `created_by_name` to other entities (accounts, categories) if needed

---

## Related Documentation

- [Hardening Release (Phase 1)](Hardening_Release.md) — RBAC, reverse proxy, modal navigation
- [Sprint 7 Release](Sprint_7_Release.md) — Previous feature release
- [System Architecture](../SystemArchitecture.md) — Overall system design
- [North Star](../north_star.md) — Product vision and domain invariants
