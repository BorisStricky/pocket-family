---
Overview: "Hardening Phase 2 merges three user-facing features — transaction creator visibility, modal backdrop safety, and automatic tenant seeding — plus a full migration from pip/requirements.txt to uv, local Linux development tooling, and production DB backup scripting into master."
Date: 2026-03-24
branch: "`development` → `master`"
code_changed: 47 files changed, +2,903 insertions, -242 deletions
commits: 16 commits (including 3 merge commits)
test_coverage: 447-line integration test suite for seed defaults
tags:
  - release_notes
  - frontend
  - backend
  - ux
  - devops
---

# Hardening Phase 2 → Master: Creator Visibility, Modal Safety, Tenant Seeding & UV Migration

## Overview

This release promotes the Hardening Phase 2 work from `development` into `master`. It delivers three user-facing improvements — transaction creator visibility in the grid, modal safety against accidental backdrop clicks, and automatic tenant seeding with categories/budgets/accounts — alongside a significant backend tooling migration from `pip`/`requirements.txt` to **uv** with `pyproject.toml`, and infrastructure updates for local Linux development.

> [!info] Related Concepts
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] — Multi-tenant seeding, JWT token handling
> - [[../knowledge/glossary/ui-components-design|UI Components & Design]] — Modal/Dialog backdrop behavior
> - [[../knowledge/glossary/api-communication|API Communication]] — Transaction query JOIN enhancements
> - [[../knowledge/glossary/development-workflow|Development Workflow]] — uv migration, Docker Compose changes
> - [[../knowledge/glossary/testing|Testing]] — Integration test suite for seed defaults

## Goals Achieved

- **Transaction Creator Visibility**: Users see who created each transaction in multi-family contexts via a new "Created By" column in the AG Grid
- **Modal Backdrop Safety**: All 11+ dialog/modal components ignore backdrop clicks to prevent accidental data loss mid-edit, especially on mobile
- **Automatic Tenant Seeding**: New tenants receive 12 expense categories, a Monthly Budget (R$1,000), and (on signup only) 3 starter accounts — no more empty dashboards
- **UV Package Management**: Backend migrated from `requirements.txt` to `uv` with `pyproject.toml` for faster, reproducible dependency resolution
- **Local Linux Development**: Docker Compose restructured for native Linux development (DB container only, no devcontainer dependency)
- **Production DB Backup**: New shell script for backing up PostgreSQL after container restart

---

## Architecture & Tech Stack Changes

### Backend Dependency Management: pip → uv

The backend now uses **uv** as its Python package manager. See [[../knowledge/glossary/development-workflow|Development Workflow]] for background on package management tooling.

- `backend/requirements.txt` deleted in favor of `backend/pyproject.toml`
- `backend/uv.lock` provides reproducible lockfile (1,500+ lines)
- `backend/.python-version` pins Python 3.13
- All `pip install` commands in Dockerfiles replaced with `uv sync`

### Tenant Seeding Architecture

A new module `seed_defaults.py` encapsulates all default data creation. See [[../knowledge/glossary/authentication-security|Authentication & Security]] for how this integrates with the signup flow.

- Called atomically within the same DB transaction as tenant/membership creation
- Uses `flush()` instead of `commit()` so the caller controls transaction boundaries
- Two entry points: `auth.py` (signup, with accounts) and `tenants.py` (create tenant, without accounts)

### Transaction Query Enhancement

All transaction query locations now JOIN the `User` table to resolve `created_by_name`, following the existing Account/Category join pattern. See [[../knowledge/glossary/api-communication|API Communication]] for the query pattern.

### Docker Compose Restructure

- Devcontainer service commented out — local Linux dev runs backend/frontend natively
- Database service renamed `db` → `db-dev`, exposed on port 5433 to avoid conflicts
- Removed `pfin-net` custom network and `frontend_node_modules` volume

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
        tenants.py                         ✏️ Calls seed_tenant_defaults on tenant creation; flush() for atomicity
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

.claude/
  settings.local.json                      ❌ Removed from version control
  agents/documentation-writer.md           ✏️ Minor update
  skills/document-changes/SKILL.md         ✏️ Renamed from commands/
  skills/orchestrate/SKILL.md              ✏️ Renamed from commands/; updated content
  skills/add-to-glossary/SKILL.md          ✏️ Minor update

docker-compose.dev.yml                     ✏️ Restructured for local Linux dev (DB-only)
Dockerfile.devcontainer                    ✏️ Added uv support
.gitignore                                 ✏️ Added .venv/, .claude/settings.local.json, .claude/worktrees/
.env.example                               ✏️ Updated DB URL to localhost:5433
CLAUDE.md                                  ✏️ Updated workflow instructions
```

---

## Files Changed — Detailed Breakdown

### Feature 1: Transaction Creator Visibility

Resolves ambiguity in multi-member families by showing who created each transaction.

| File | Status | Purpose |
|------|--------|---------|
| `backend/api/app/schemas.py` | MODIFIED | Added `created_by_name: Optional[str]` to `TransactionRead` schema |
| `backend/api/app/routers/transactions.py` | MODIFIED | Added `User` JOIN in all transaction query locations (`_fetch_transaction_with_names`, `_rows_to_transaction_reads`, `list_transactions`) |
| `frontend/src/features/transactions/types/index.ts` | MODIFIED | Added `created_by_name` field to `TransactionRead` TypeScript interface |
| `frontend/src/components/domain/ag/AgTransactionsGrid.tsx` | MODIFIED | Added "Created By" column; reordered columns: Date → Category → Amount → Description → Account → Type → Created By |

**Impact**: In multi-member families, users see the creator's display name directly in the grid without checking audit logs.

### Feature 2: Modal Backdrop Click Guard

Prevents accidental data loss on mobile where stray touches easily dismiss forms mid-edit. See [[../knowledge/glossary/ui-components-design|UI Components & Design]] for MUI Dialog patterns.

**Pattern applied** (shared Modal atom):
```typescript
const handleDialogClose = (_event: object, reason: string) => {
  if (reason === 'backdropClick') return;
  onClose();
};
```

**Components updated** (18 dialog instances across 15 files):
- `Modal` (atom), `TransactionDetailModal`, `DeleteConfirmDialog` (2 locations)
- `AccountShareList`, `AddAccountModal`, `EditShareDialog`, `ShareAccountDialog`
- `BudgetForm`, `DeleteBudgetConfirm`
- `AddCategoryModal`, `DeleteCategoryConfirm`, `EditCategoryModal`
- `CreateFamilyModal`, `FamilySettings` (2 dialogs), `InviteMemberModal`, `MembersList`
- `AddTransactionModal`

**Impact**: ESC key and X button still close normally. Only backdrop clicks are suppressed.

### Feature 3: Automatic Tenant Seeding

New tenants start with a working set of data instead of empty dashboards. See [[../knowledge/glossary/authentication-security|Authentication & Security]] for how seeding integrates with the signup/tenant creation flow.

| File | Status | Purpose |
|------|--------|---------|
| `backend/api/app/seed_defaults.py` | NEW | Core seeding logic — creates 12 categories (5 parents + 7 children), Monthly Budget at R$1,000, and optionally 3 accounts |
| `backend/api/app/routers/auth.py` | MODIFIED | Calls `seed_tenant_defaults(include_accounts=True)` during signup |
| `backend/api/app/routers/tenants.py` | MODIFIED | Changed `commit()` → `flush()` for atomicity; calls `seed_tenant_defaults(include_accounts=False)` on tenant creation |
| `backend/api/tests/test_seed_defaults.py` | NEW | 447-line integration test suite validating seeded data through API endpoints |
| `backend/api/tests/conftest.py` | MODIFIED | Updated test fixtures for seed default tests |

**Default categories seeded**:
- Bills
- Food → Eat Out, Groceries
- Leisure → Sports, Movies, Music
- Transport → Fuel, Taxi/Uber
- Other

**Default budget**: "Monthly Budget" at R$1,000 (BRL), linked to all 12 categories.

**Signup-only extras**: 3 accounts (Cash, Debit, Credit) named after the user, shared with the new tenant.

### DevOps: UV Migration & Local Linux Development

See [[../knowledge/glossary/development-workflow|Development Workflow]] for background on package management and Docker tooling.

| File | Status | Purpose |
|------|--------|---------|
| `backend/pyproject.toml` | NEW | UV-compatible project definition with all production and dev dependencies |
| `backend/uv.lock` | NEW | Reproducible lockfile (1,501 lines) |
| `backend/.python-version` | NEW | Pins Python 3.13 |
| `backend/requirements.txt` | DELETED | Replaced by pyproject.toml |
| `backend/api/Dockerfile` | MODIFIED | Uses `uv sync` instead of `pip install`; copies uv binary from official image |
| `Dockerfile.devcontainer` | MODIFIED | Added uv binary, removed pip install step |
| `docker-compose.dev.yml` | MODIFIED | Devcontainer commented out; DB exposed on port 5433; removed custom network |
| `backend/scripts/backup_db_after_restart.sh` | NEW | Shell script for production DB backup after container restart |
| `backend/scripts/seed_test_data.py` | MODIFIED | Points to test environment |
| `.env.example` | MODIFIED | Updated DB URL to `localhost:5433/pfinancedb_dev` |
| `.gitignore` | MODIFIED | Added `.venv/`, `.claude/settings.local.json`, `.claude/worktrees/` |

### Tooling & Configuration

| File | Status | Purpose |
|------|--------|---------|
| `.claude/settings.local.json` | DELETED | Removed from version control (now gitignored) |
| `.claude/agents/documentation-writer.md` | MODIFIED | Minor update |
| `.claude/skills/document-changes/SKILL.md` | RENAMED | Moved from `.claude/commands/` to `.claude/skills/` |
| `.claude/skills/orchestrate/SKILL.md` | RENAMED | Moved from `.claude/commands/` to `.claude/skills/`; updated content |
| `.claude/skills/add-to-glossary/SKILL.md` | MODIFIED | Minor update |
| `CLAUDE.md` | MODIFIED | Updated workflow instructions |

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

Tests use the standard `AsyncClient` + real database pattern (no mocks), calling `/auth/signup` and `/tenants` endpoints and then verifying seeded data through GET endpoints. See [[../knowledge/glossary/testing|Testing]] for the project's integration-first test philosophy.

---

## Migration Notes

### Breaking Changes
- **Backend requires uv**: `pip install -r requirements.txt` no longer works. Use `uv sync` instead.
- **Python 3.13 required**: Pinned via `.python-version`
- **DB port changed**: Development database now on port **5433** (was 5432 inside container network)
- **DB name changed**: `pfinancedb` → `pfinancedb_dev` for the development database

### Required Steps
1. Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. Run `cd backend && uv sync --all-extras` to install dependencies
3. Update `.env` to point to `localhost:5433/pfinancedb_dev` (see `.env.example`)
4. Existing tenants are NOT retroactively seeded — only new tenants get defaults

---

## Performance Impact

- **Backend startup**: No change — seeding runs only during signup/tenant creation
- **Signup latency**: Minimal increase (~5-10ms) from additional flush/insert operations within the same transaction
- **Dependency install**: Significantly faster with uv compared to pip (cold install ~3-5x faster)

---

## Next Steps / Follow-up Work

- Consider a one-time migration script to seed defaults for existing tenants
- Add user preference to customize default category sets
- Consider making the default budget amount configurable per locale
- Extend `created_by_name` to other entities (accounts, categories) if needed
- Refactor backdrop click guard into a shared utility or HOC to reduce duplication across 15+ files

---

## Related Documentation

### Technical Glossary

> [!info] Learning Resources
> New to the project? Start with the [[../knowledge/glossary/glossary|Technical Glossary]] for:
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] — JWT, signup flow, multi-tenant seeding
> - [[../knowledge/glossary/ui-components-design|UI Components & Design]] — MUI Dialog, AG Grid, atomic design
> - [[../knowledge/glossary/api-communication|API Communication]] — REST endpoints, SQL joins, query patterns
> - [[../knowledge/glossary/development-workflow|Development Workflow]] — uv, Docker Compose, migrations
> - [[../knowledge/glossary/testing|Testing]] — pytest, integration tests, AsyncClient
> - [[../knowledge/glossary/typescript|TypeScript]] — Interface patterns, type alignment with backend schemas
> - [[../knowledge/glossary/project-structure-concepts|Project Structure]] — File organization conventions

### Related PRs & Docs

- [Hardening Phase 2 (hardening → development)](Hardening_Phase2_Release.md) — Detailed per-feature breakdown
- [Hardening Release (Phase 1)](Hardening_Release.md) — RBAC, reverse proxy, modal navigation
- [Sprint 7 Release](Sprint_7_Release.md) — Previous feature release
- [System Architecture](../SystemArchitecture.md) — Overall system design
- [North Star](../north_star.md) — Product vision and domain invariants
