# Sprint 7: Budgets — Full-Stack CRUD (1 week)

## Goal

Implement full budget management: backend model, API endpoints, and frontend UI. Users can create, view, edit, and delete monthly budgets that can track one or more categories, and see how much they've spent against each budget.

**Budgets are always monthly** — no period selection needed. Each budget tracks a spending limit for the current month. A budget can hold **multiple categories** (many-to-many), and a category can belong to multiple budgets. A budget with no categories tracks ALL tenant spending (universal budget).

## Success Criteria

- [ ] Budget and BudgetCategory models exist in the database with Alembic migration
- [ ] Full CRUD API endpoints for budgets (create, list, get, update, delete)
- [ ] Multi-tenant isolation enforced on all budget operations
- [ ] Frontend page to view budgets with progress bars (spent vs limit)
- [ ] Users can create, edit, and delete budgets via modal forms
- [ ] Multi-category selection works in budget create/edit forms
- [ ] Backend tests cover CRUD + tenant isolation + multi-category spent calculation
- [ ] Frontend tests cover budget page workflows

---

## Data Model: Many-to-Many (Budget ↔ Category)

Two tables implement the relationship using a join table pattern (same pattern as `AccountShare`):

**`budget` table:**
- `id` (UUID PK)
- `tenant_id` (UUID FK → tenant, CASCADE)
- `name` (VARCHAR 255, required) — e.g., "Monthly Entertainment"
- `amount` (Numeric(18,2), required, must be > 0)
- `currency` (VARCHAR 3, required) — ISO 4217 code (e.g., "BRL", "USD"). Must match transaction currencies for accurate spent calculation.
- `created_at`, `updated_at` (timestamps)

**`budget_category` join table:**
- `id` (UUID PK)
- `tenant_id` (UUID FK → tenant, CASCADE) — Required per north_star.md invariant: every domain record must include tenant_id
- `budget_id` (UUID FK → budget, CASCADE)
- `category_id` (UUID FK → category, CASCADE)
- `added_at` (timestamp)
- Unique constraint on `(budget_id, category_id)` — prevents duplicates
- **Tenant validation**: Backend must verify budget.tenant_id == category.tenant_id == budget_category.tenant_id on create/update

**Key behaviors:**
- One budget can have many categories (e.g., "Entertainment" covers Movies, Games, Streaming)
- One category can belong to many budgets (e.g., "Groceries" in "Food Budget" and "Weekly Essentials")
- Budget with zero categories = universal budget (tracks ALL tenant spending)
- CASCADE delete on budget → removes all associations
- CASCADE delete on category → removes all associations (budget remains valid)

---

## How to Calculate "Spent" Amounts

### Phase 1 - On-Read (query when budget is loaded)

- When fetching budgets, aggregate expense transactions across **all categories in the budget** for the requested month
- If budget has **no categories**, sum **ALL** tenant expense transactions for that month
- GET endpoints accept optional `?month=N&year=YYYY` query params (defaults to current month)
- **Pros:** Always accurate, no sync issues, simpler model (no `spent` column)
- **Cons:** Heavier read queries, may be slow with many transactions

### Phase 2 - Background jobs to check status

A Celery worker runs on a schedule and checks all active budgets across all families. When it finds budgets crossing thresholds, it creates alert records that appear as badges or notifications in the UI.

**Important** only phase 1 is part of sprint 7, background jobs will be implemented later

---

## Components Checklist

### Backend — Model & Migration

| Done | Item                     | File Path                       | Notes                                                                                                                                                         |
| ---- | ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ]  | Budget model             | `backend/api/app/models.py`     | Fields: `id`, `tenant_id`, `name`, `amount` (Numeric(18,2)), `created_at`, `updated_at`. No `category_id` — categories linked via join table.                 |
| [ ]  | BudgetCategory model     | `backend/api/app/models.py`     | Join table: `id`, `budget_id` (FK CASCADE), `category_id` (FK CASCADE), `added_at`. Unique constraint on `(budget_id, category_id)`.                         |
| [ ]  | Alembic migration        | `backend/api/alembic/versions/` | Create `budget` table and `budget_category` join table with CASCADE FKs, unique constraint, and indexes                                                       |
| [ ]  | BudgetCreate schema      | `backend/api/app/schemas.py`    | Fields: `name` (str), `amount` (Decimal > 0), `currency` (str, default "BRL"), `category_ids` (optional List[UUID])                                           |
| [ ]  | BudgetRead schema        | `backend/api/app/schemas.py`    | Fields: `id`, `tenant_id`, `name`, `amount`, `currency`, `categories` (List[CategoryRead]), `spent` (calculated Decimal), `month`, `year`, `created_at`, `updated_at` |
| [ ]  | BudgetUpdate schema      | `backend/api/app/schemas.py`    | Fields: `name` (optional str), `amount` (optional Decimal > 0), `currency` (optional str), `category_ids` (optional List[UUID] — full replacement of category set when provided) |

### Backend — Router & Endpoints

| Done | Endpoint                                      | Method | File Path                            | Notes                                                                                                   |
| ---- | --------------------------------------------- | ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| [ ]  | `/app/{tenant_id}/budgets?month=N&year=YYYY`  | GET    | `backend/api/app/routers/budgets.py` | List all budgets for tenant. Spent = sum of transactions (matching budget.currency) across budget's categories for specified month. |
| [ ]  | `/app/{tenant_id}/budgets/{id}?month=N&year=YYYY` | GET    | `backend/api/app/routers/budgets.py` | Single budget with categories and spent amount for specified month (currency-filtered)                   |
| [ ]  | `/app/{tenant_id}/budgets`                    | POST   | `backend/api/app/routers/budgets.py` | Create budget with optional categories. **Validate**: categories belong to tenant, budget.tenant_id matches context. OWNER-only. |
| [ ]  | `/app/{tenant_id}/budgets/{id}`               | PATCH  | `backend/api/app/routers/budgets.py` | Update name, amount, currency, and/or category list (full replacement). **Validate**: new categories belong to tenant. OWNER-only. |
| [ ]  | `/app/{tenant_id}/budgets/{id}`               | DELETE | `backend/api/app/routers/budgets.py` | Delete budget. CASCADE removes budget_category rows. OWNER-only.                                        |
| [ ]  | Register router                               | -      | `backend/api/app/main.py`            | Add budgets router to app with `/app/{tenant_id}` prefix                                                |

### Backend — Tests

| Done | Test                          | File Path                                    | Notes                                                                          |
| ---- | ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| [ ]  | Budget CRUD tests             | `backend/api/tests/test_budget_endpoints.py` | Create, read, update, delete with multi-category and currency field            |
| [ ]  | Multi-category spent tests    | `backend/api/tests/test_budget_endpoints.py` | Spent sums across all categories; no categories = all transactions; **currency-filtered** (only sum transactions matching budget.currency) |
| [ ]  | Category update via PATCH     | `backend/api/tests/test_budget_endpoints.py` | PATCH with category_ids replaces entire set; omitting leaves unchanged         |
| [ ]  | Historical month query tests  | `backend/api/tests/test_budget_endpoints.py` | GET with ?month=1&year=2025 returns correct spent                              |
| [ ]  | Tenant isolation tests        | `backend/api/tests/test_budget_endpoints.py` | Cannot access other tenant's budgets; cannot add other tenant's categories; **budget_category.tenant_id validated** |
| [ ]  | Authorization tests           | `backend/api/tests/test_budget_endpoints.py` | Only OWNER can create/update/delete; all roles can read                        |
| [ ]  | Validation tests              | `backend/api/tests/test_budget_endpoints.py` | Invalid category, negative amount, empty name, non-existent category, **invalid currency**, **tenant mismatch** |
| [ ]  | CASCADE delete tests          | `backend/api/tests/test_budget_endpoints.py` | Deleting category removes budget_category rows; budget remains valid           |
| [ ]  | Currency filtering tests      | `backend/api/tests/test_budget_endpoints.py` | Spent calculation only includes transactions matching budget.currency; mixed-currency transactions ignored |

### Frontend — API & Hooks

| Done | Item            | File Path                                       | Notes                                                          |
| ---- | --------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| [ ]  | getBudgets      | `src/features/budgets/api/budgetsApi.ts`        | GET `/app/{tenant_id}/budgets?month=N&year=YYYY` (defaults to current month) |
| [ ]  | createBudget    | `src/features/budgets/api/budgetsApi.ts`        | POST `/app/{tenant_id}/budgets` with name, amount, **currency (default "BRL")**, category_ids |
| [ ]  | updateBudget    | `src/features/budgets/api/budgetsApi.ts`        | PATCH `/app/{tenant_id}/budgets/{id}` with name, amount, **currency**, category_ids |
| [ ]  | deleteBudget    | `src/features/budgets/api/budgetsApi.ts`        | DELETE `/app/{tenant_id}/budgets/{id}`                         |
| [ ]  | useBudgets      | `src/features/budgets/hooks/useBudgets.ts`      | Query key: `['budgets', familyId, month, year]`                |
| [ ]  | useCreateBudget | `src/features/budgets/hooks/useCreateBudget.ts` | Invalidates `['budgets', familyId]` on success                 |
| [ ]  | useUpdateBudget | `src/features/budgets/hooks/useUpdateBudget.ts` | Invalidates `['budgets', familyId]` on success                 |
| [ ]  | useDeleteBudget | `src/features/budgets/hooks/useDeleteBudget.ts` | Invalidates `['budgets', familyId]` on success                 |

### Frontend — Components

| Done | Component           | File Path                                                 | Notes                                                                                                                                                                |
| ---- | ------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ]  | BudgetsList         | `src/features/budgets/components/BudgetsList.tsx`         | AG Grid with columns: name, amount, **currency**, spent, progress bar, categories (chips). Color-coded: green (< 80%), yellow (80-99%), red (>= 100%).              |
| [ ]  | BudgetForm          | `src/features/budgets/components/BudgetForm.tsx`          | Modal form for create/edit. Fields: name (text), amount (number), **currency (dropdown, default "BRL", BRL-only for now)**, categories (MUI Autocomplete multi-select). On edit, pre-populates from BudgetRead. |
| [ ]  | DeleteBudgetConfirm | `src/features/budgets/components/DeleteBudgetConfirm.tsx` | Confirmation dialog before deleting a budget                                                                                                                          |

### Frontend — Pages & Routes

| Done | Page         | File Path                                    | Route                    | Notes                                                              |
| ---- | ------------ | -------------------------------------------- | ------------------------ | ------------------------------------------------------------------ |
| [ ]  | BudgetsPage  | `src/features/budgets/pages/BudgetsPage.tsx` | `/app/:familyId/budgets` | Main budgets page with list + add/edit/delete modals + month selector |
| [ ]  | Add route    | `src/router/index.tsx`                       | -                        | Add budgets route under familyId layout                            |
| [ ]  | Add nav link | SideNav component                            | -                        | Add "Budgets" link to sidebar navigation                           |

### Frontend — Tests

| Done | Test              | File Path                                             | Notes                                                        |
| ---- | ----------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| [ ]  | BudgetsPage tests | `src/features/budgets/__tests__/BudgetsPage.test.tsx` | Test list, create, edit, delete flows with multi-category    |
| [ ]  | BudgetForm tests  | `src/features/budgets/__tests__/BudgetForm.test.tsx`  | Test multi-select category, validation, submit               |

---

## Implementation Steps

### Step 1: Backend — Model & Migration

- [ ] Add `Budget` model to `models.py` (id, tenant_id, name, amount, **currency**, created_at, updated_at)
- [ ] Add `BudgetCategory` join model to `models.py` (id, **tenant_id**, budget_id, category_id, added_at + unique constraint)
- [ ] Create Alembic migration for both tables with currency and tenant_id fields
- [ ] Add schemas to `schemas.py` (BudgetCreate with currency default "BRL", BudgetRead, BudgetUpdate)

### Step 2: Backend — Router & Endpoints

- [ ] Create `routers/budgets.py` with 5 endpoints (GET list, GET single, POST, PATCH, DELETE)
- [ ] Implement spent calculation: aggregate transactions across all budget categories for specified month, **filtered by budget.currency** (only sum transactions where transaction.currency == budget.currency)
- [ ] Handle no-category case: sum ALL tenant expense transactions **matching budget.currency**
- [ ] PATCH replaces category list when `category_ids` provided, leaves unchanged when omitted
- [ ] **Add tenant validation**: On create/update, verify all category_ids belong to the same tenant as the budget; set budget_category.tenant_id = context.tenant.id
- [ ] Follow existing patterns: `get_active_context` dependency, tenant filtering, OWNER-only mutations
- [ ] Register router in `main.py`

### Step 3: Backend — Tests

- [ ] Write tests for all CRUD operations with multi-category budgets (including currency field)
- [ ] Test spent calculation across multiple categories **with currency filtering** (only transactions matching budget.currency)
- [ ] Test universal budget (no categories = all transactions **matching budget.currency**)
- [ ] Test historical month queries (?month=1&year=2025)
- [ ] Test tenant isolation (cannot access other tenant's budgets or categories; **budget_category.tenant_id enforced**)
- [ ] Test authorization (only OWNER can create/update/delete)
- [ ] Test CASCADE delete (category deletion removes budget_category rows)
- [ ] Test category replacement via PATCH (full replacement, not additive)
- [ ] **Test currency validation** (invalid currency codes rejected)
- [ ] **Test tenant_id validation** (cannot add categories from different tenant; budget_category.tenant_id matches budget and category)
- [ ] **Test mixed-currency spent** (BRL budget ignores USD transactions even in same categories)

### Step 4: Frontend — API & Hooks

- [ ] Implement `budgetsApi.ts` with all CRUD functions (month/year params on GET)
- [ ] Create React Query hooks with proper query key invalidation

### Step 5: Frontend — Components & Page

- [ ] Build BudgetsList with AG Grid, progress bars, **currency column**, and category chips
- [ ] Build BudgetForm modal with multi-select category (MUI Autocomplete) + name + amount + **currency dropdown (default "BRL", BRL-only for now)**
- [ ] Build DeleteBudgetConfirm dialog
- [ ] Create BudgetsPage composing all components + optional month selector
- [ ] Add route and nav link

### Step 6: Frontend — Tests

- [ ] Test budget list rendering with progress bars and category chips
- [ ] Test create/edit/delete workflows with multi-category selection
- [ ] Test empty state
- [ ] Test universal budget display (no categories)

### Step 7: Polish

- [ ] Loading states and skeletons
- [ ] Success/error toasts
- [ ] Over-budget visual warnings

---

## API Endpoints Reference

| Endpoint                                      | Method | Request                                          | Response                            | Notes                                                                     |
| --------------------------------------------- | ------ | ------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------- |
| `/app/{tenant_id}/budgets?month=N&year=YYYY`  | GET    | -                                                | `BudgetRead[]` (with `spent` field) | List all budgets for tenant. Month/year default to current. Spent filtered by budget.currency. |
| `/app/{tenant_id}/budgets/{id}?month=N&year=YYYY` | GET    | -                                            | `BudgetRead` (with `spent` field)   | Single budget with categories and spent (currency-filtered)               |
| `/app/{tenant_id}/budgets`                    | POST   | `{ name, amount, currency?, category_ids? }`     | `BudgetRead`                        | Create budget. Optional category list. currency defaults to "BRL".        |
| `/app/{tenant_id}/budgets/{id}`               | PATCH  | `{ name?, amount?, currency?, category_ids? }`   | `BudgetRead`                        | Update budget. category_ids replaces entire set when provided.            |
| `/app/{tenant_id}/budgets/{id}`               | DELETE | -                                                | 204 No Content                      | Delete budget. CASCADE removes budget_category rows.                      |

---

## Notes & Assumptions

- **Monthly only:** All budgets are monthly. No period selection. Spent is calculated for a specific calendar month (1st to last day), defaulting to current month.
- **Many-to-many:** One budget can have one or more categories and one category can be in more than one budget. Implemented via `budget_category` join table.
- **Universal budget:** A budget with no categories tracks ALL tenant expense transactions for the month (filtered by currency).
- **Category update via PATCH:** Sending `category_ids` in PATCH replaces the entire category set. Omitting the field leaves categories unchanged.
- **Spent calculation:** Calculated on-read by aggregating expense transactions across all budget categories for the requested month, **filtered by budget.currency** (only transactions where transaction.currency == budget.currency are summed).
- **Currency safety:** Each budget has a `currency` field (ISO 4217 code). Frontend defaults to "BRL" and only offers BRL option for now. Backend accepts any valid currency code, but spent calculation only counts matching transactions. This prevents mixing BRL and USD amounts.
- **Tenant_id on join table:** The `budget_category` join table includes `tenant_id` per north_star.md invariant (every domain record must include valid tenant_id). Backend validates budget.tenant_id == category.tenant_id == budget_category.tenant_id on create/update.
- **BudgetRead includes categories:** The response returns full `CategoryRead` objects so the frontend can display whatever fields it needs.
- **BudgetRead includes month/year:** So the client knows which month the spent calculation covers.
- **Authorization:** Only OWNER role can create/update/delete budgets. All members can view.
- **No alerts yet:** Budget alerts/notifications are a future enhancement (Celery background jobs).
