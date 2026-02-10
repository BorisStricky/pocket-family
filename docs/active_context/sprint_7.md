# Sprint 7: Budgets — Full-Stack CRUD (1 week)

## Goal
Implement full budget management: backend model, API endpoints, and frontend UI. Users can create, view, edit, and delete monthly budgets per category, and see how much they've spent against each budget.

**Budgets are always monthly** — no period selection needed. Each budget tracks a spending limit for one category for the current month.

## Success Criteria
- [ ] Budget model exists in the database with Alembic migration
- [ ] Full CRUD API endpoints for budgets (create, list, get, update, delete)
- [ ] Multi-tenant isolation enforced on all budget operations
- [ ] Frontend page to view budgets with progress bars (spent vs limit)
- [ ] Users can create, edit, and delete budgets via modal forms
- [ ] Backend tests cover CRUD + tenant isolation
- [ ] Frontend tests cover budget page workflows

---

## How to Calculate "Spent" Amounts

### Phase 1 - On-Read (query when budget is loaded)
- When fetching budgets, join/aggregate transactions for that category in the current month
- **Pros:** Always accurate, no sync issues, simpler model (no `spent` column)
- **Cons:** Heavier read queries, may be slow with many transactions

### Phase 2 - Background jobs to check status
A [[Celery_Deep_Dive|Celery]] worker runs on a schedule (Interval tbd maybe daily at 8am, or every 6 hours) and checks all active budgets across all families. When it finds budgets crossing thresholds, it creates alert records that appear as badges or notifications in the UI.

**Important** only phase 1 is part of sprint 7, background jobs will be implemented later

---

## Components Checklist

### Backend — Model & Migration
#todo A budget can hold more than one category, need to expand the models to reflect this

| Done | Item | File Path | Notes |
|------|------|-----------|-------|
| [ ] | Budget model | `backend/api/app/models.py` | Fields: `id`, `tenant_id`, `category_id`, `amount` (Decimal/Numeric(18,2)), `created_at`, `updated_at`. Always monthly — no period field. |
| [ ] | Alembic migration | `backend/api/alembic/versions/` | Create `budget` table with FK to `category` and `tenant` |
| [ ] | BudgetCreate schema | `backend/api/app/schemas.py` | Fields: `category_id` (int), `amount` (Decimal) |
| [ ] | BudgetRead schema | `backend/api/app/schemas.py` | Fields: `id`, `tenant_id`, `category_id`, `category_name`, `amount`, `spent` (calculated), `created_at`, `updated_at` |
| [ ] | BudgetUpdate schema | `backend/api/app/schemas.py` | Fields: `amount` (optional Decimal) |

### Backend — Router & Endpoints

| Done | Endpoint | Method | File Path | Notes |
|------|----------|--------|-----------|-------|
| [ ] | `/budgets` | GET | `backend/api/app/routers/budgets.py` | List all budgets for tenant. Include `spent` (sum of transactions for category in current month). |
| [ ] | `/budgets/{id}` | GET | `backend/api/app/routers/budgets.py` | Single budget with `spent` amount |
| [ ] | `/budgets` | POST | `backend/api/app/routers/budgets.py` | Create budget. Validate category belongs to tenant. OWNER-only. |
| [ ] | `/budgets/{id}` | PATCH | `backend/api/app/routers/budgets.py` | Update budget amount. OWNER-only. |
| [ ] | `/budgets/{id}` | DELETE | `backend/api/app/routers/budgets.py` | Delete budget. OWNER-only. |
| [ ] | Register router | - | `backend/api/app/main.py` | Add budgets router to app |

### Backend — Tests

| Done | Test | File Path | Notes |
|------|------|-----------|-------|
| [ ] | Budget CRUD tests | `backend/api/tests/test_budget_endpoints.py` | Create, read, update, delete |
| [ ] | Tenant isolation tests | `backend/api/tests/test_budget_endpoints.py` | Verify budgets from other tenants are inaccessible |
| [ ] | Validation tests | `backend/api/tests/test_budget_endpoints.py` | Invalid category, duplicate budget per category, etc. |

### Frontend — API & Hooks

| Done | Item | File Path | Notes |
|------|------|-----------|-------|
| [ ] | getBudgets | `src/features/budgets/api/budgetsApi.ts` | GET `/budgets` |
| [ ] | createBudget | `src/features/budgets/api/budgetsApi.ts` | POST `/budgets` |
| [ ] | updateBudget | `src/features/budgets/api/budgetsApi.ts` | PATCH `/budgets/{id}` |
| [ ] | deleteBudget | `src/features/budgets/api/budgetsApi.ts` | DELETE `/budgets/{id}` |
| [ ] | useBudgets | `src/features/budgets/hooks/useBudgets.ts` | Query key: `['budgets', familyId]` |
| [ ] | useCreateBudget | `src/features/budgets/hooks/useCreateBudget.ts` | Invalidates `['budgets', familyId]` on success |
| [ ] | useUpdateBudget | `src/features/budgets/hooks/useUpdateBudget.ts` | Invalidates `['budgets', familyId]` on success |
| [ ] | useDeleteBudget | `src/features/budgets/hooks/useDeleteBudget.ts` | Invalidates `['budgets', familyId]` on success |

### Frontend — Components

| Done | Component           | File Path                                                 | Notes                                                                                                                             |
| ---- | ------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [ ]  | BudgetsList         | `src/features/budgets/components/BudgetsList.tsx`         | List of budgets with progress bars showing spent/limit. Color-coded: green (under), yellow (near), red (over budget). Use AG grid |
| [ ]  | BudgetForm          | `src/features/budgets/components/BudgetForm.tsx`          | Modal form for create/edit. Fields: category (dropdown), amount (number input).                                                   |
| [ ]  | DeleteBudgetConfirm | `src/features/budgets/components/DeleteBudgetConfirm.tsx` | Confirmation dialog before deleting a budget                                                                                      |

### Frontend — Pages & Routes

| Done | Page | File Path | Route | Notes |
|------|------|-----------|-------|-------|
| [ ] | BudgetsPage | `src/features/budgets/pages/BudgetsPage.tsx` | `/app/:familyId/budgets` | Main budgets page with list + add/edit/delete modals |
| [ ] | Add route | `src/router/index.tsx` | - | Add budgets route under familyId layout |
| [ ] | Add nav link | SideNav component | - | Add "Budgets" link to sidebar navigation |

### Frontend — Tests

| Done | Test | File Path | Notes |
|------|------|-----------|-------|
| [ ] | BudgetsPage tests | `src/features/budgets/__tests__/BudgetsPage.test.tsx` | Test list, create, edit, delete flows |
| [ ] | BudgetForm tests | `src/features/budgets/__tests__/BudgetForm.test.tsx` | Test validation, submit |

---

## Implementation Steps

### Step 1: Backend — Model & Migration
- [ ] Add `Budget` model to `models.py` (id, tenant_id, category_id, amount, created_at, updated_at)
- [ ] Create Alembic migration
- [ ] Add schemas to `schemas.py` (BudgetCreate, BudgetRead, BudgetUpdate)

### Step 2: Backend — Router & Endpoints
- [ ] Create `routers/budgets.py` with full CRUD
- [ ] Implement `spent` calculation: aggregate transactions for category in current month (1st to last day)
- [ ] Follow existing patterns: `get_active_context` dependency, tenant filtering, OWNER-only mutations
- [ ] Register router in `main.py`

### Step 3: Backend — Tests
- [ ] Write tests for all CRUD operations
- [ ] Test tenant isolation (cannot access other tenant's budgets)
- [ ] Test authorization (only OWNER can create/update/delete)
- [ ] Test edge cases (duplicate category budget, invalid category)

### Step 4: Frontend — API & Hooks
- [ ] Implement `budgetsApi.ts` with all CRUD functions
- [ ] Create React Query hooks with proper query key invalidation

### Step 5: Frontend — Components & Page
- [ ] Build BudgetsList with progress bars
- [ ] Build BudgetForm modal (category dropdown + amount input)
- [ ] Build DeleteBudgetConfirm dialog
- [ ] Create BudgetsPage composing all components
- [ ] Add route and nav link

### Step 6: Frontend — Tests
- [ ] Test budget list rendering with progress bars
- [ ] Test create/edit/delete workflows
- [ ] Test empty state

### Step 7: Polish
- [ ] Loading states and skeletons
- [ ] Success/error toasts
- [ ] Over-budget visual warnings

---

## API Endpoints Reference

| Endpoint | Method | Request | Response | Notes |
|----------|--------|---------|----------|-------|
| `/budgets` | GET | - | `BudgetRead[]` (with `spent` field) | List all budgets for current tenant |
| `/budgets/{id}` | GET | - | `BudgetRead` (with `spent` field) | Single budget |
| `/budgets` | POST | `{ category_id, amount }` | `BudgetRead` | Create budget. One per category. |
| `/budgets/{id}` | PATCH | `{ amount? }` | `BudgetRead` | Update budget amount |
| `/budgets/{id}` | DELETE | - | `{ ok: true }` | Delete budget |

---

## Notes & Assumptions
- **Monthly only:** All budgets are monthly. No period selection. Budget tracks current calendar month (1st to last day).
- **One budget can have one or more categories** and one category can be in more than one budget.
- **Spent calculation:** Calculated on-read by aggregating expense transactions for the category within the current month. See discussion section above.
- **Authorization:** Only OWNER role can create/update/delete budgets. All members can view.
- **No alerts yet:** Budget alerts/notifications are a future enhancement.
