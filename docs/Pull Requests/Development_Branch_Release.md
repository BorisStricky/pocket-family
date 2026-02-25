# Development Branch: Multi-Sprint Release Summary

**Branch:** `development` → `master`
**Last Updated:** 2026-02-24
**Sprints Covered:** Sprint 5 (Dashboard), Sprint 7 (Budgets), Mobile-Ready Polish + Infrastructure

---

## Overview

This release accumulates three major sprints of feature work from the `development` branch. It delivers a complete financial dashboard with interactive charts, a full-stack budgets management module with multi-category support and real-time spent tracking, a responsive mobile-ready layout with hamburger navigation, BRL (Brazilian Real) localization across the entire application, and a consolidated Docker development environment.

The scope represents a significant step toward a production-ready MVP: users can now see their financial health at a glance on the dashboard, set and track spending budgets by category, and navigate the application comfortably on a mobile device. All three feature areas include comprehensive automated test coverage and are fully integrated with the existing multi-tenant authentication and data isolation architecture.

**Note:** The file `remoteContainers-2026-02-10T18-03-54.211Z.log` (a 23,000+ line VS Code Remote Containers log file) was accidentally committed during development. It should be noted as technical debt and removed in a follow-up commit to keep the repository clean.

---

## Goals Achieved

### Sprint 5: Dashboard Feature
- Replaced the placeholder WelcomePage with a functional financial dashboard as the default landing page
- Delivered three KPI OverviewCards (Total Expenses, Total Income, Net Balance) with dynamic date range filtering
- Implemented interactive Recharts visualizations: SpendingByCategory PieChart and IncomeVsExpenses LineChart
- Built a RecentTransactionsWidget using AG Grid for in-dashboard transaction review
- Added QuickActions navigation shortcuts for high-frequency user tasks
- Established client-side data aggregation pattern via `useDashboardSummary` hook with no backend changes required
- 16 tests covering rendering, loading, error, empty states, and user interactions

### Sprint 7: Budgets Feature (Full-Stack)
- Designed and implemented Budget and BudgetCategory database models with many-to-many category relationships
- Delivered Alembic migration and five RESTful CRUD endpoints with multi-tenant isolation and role-based authorization
- Built complete frontend budgets module: types, API client, four React Query hooks, AG Grid list with progress bars, BudgetForm with multi-category Autocomplete, and DeleteBudgetConfirm dialog
- Implemented currency-aware spent calculation (on-read aggregation) ensuring BRL budgets ignore USD transactions
- Supported universal budgets (no categories assigned) tracking all tenant expenses filtered by currency
- Created comprehensive DB seed script for consistent manual QA with deterministic data
- 3,267 total test lines: 2,518 backend (pytest) + 749 frontend (Vitest + React Testing Library)

### Mobile-Ready: Responsive Layout Polish
- AppShell now owns drawer open/close state and isMobileViewport detection via MUI `useMediaQuery`
- SideNav switches between persistent (desktop >= 900px) and temporary (mobile) MUI Drawer variants
- TopNav gains a hamburger MenuIcon button visible only on mobile
- Centralized LAYOUT.DRAWER_WIDTH constant to avoid magic numbers
- SideNav auto-closes after navigation on mobile to avoid obscuring content
- FamilySwitcherMini text truncation prevents overflow on narrow screens
- App title hidden on mobile to free header space
- FamilyList cards converted from MUI Grid to flexbox Box for equal-width responsive layout
- SpendingByCategory chart legend hidden on mobile to save vertical space

### BRL Localization
- Currency changed from USD to BRL (R$) across all components displaying monetary amounts
- Date format changed from MM/DD/YYYY to DD/MM/YYYY (Brazilian standard) throughout the UI
- New `dateUtils.ts` module centralizes date formatting functions for consistency

### Infrastructure: Docker Consolidation
- Replaced two separate `Dockerfile.frontend.dev` and `Dockerfile.backend.dev` with a single unified `Dockerfile.devcontainer`
- Replaced separate `.devcontainer/frontend/devcontainer.json` and `.devcontainer/backend/devcontainer.json` with one `.devcontainer/devcontainer.json` running both servers
- Faster dev container startup; production Dockerfiles remain independent

---

## Architecture & Tech Stack Changes

> [!info] Related Concepts
> For background on the technologies and patterns used across these sprints:
> - [[../knowledge/glossary/state-management|State Management]] - React Query caching, mutations, and query invalidation (central to all three features)
> - [[../knowledge/glossary/api-communication|API Communication]] - REST API patterns, apiFetch wrapper, endpoint organization
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] - Multi-tenant isolation, JWT tokens, role-based authorization
> - [[../knowledge/glossary/react-patterns-hooks|React Patterns & Hooks]] - Custom hooks, useMemo, React Hook Form, composition patterns
> - [[../knowledge/glossary/ui-components-design|UI Components & Design]] - MUI Drawer variants, AG Grid, Recharts, responsive design
> - [[../knowledge/glossary/routing-navigation|Routing & Navigation]] - React Router patterns, family-scoped routes
> - [[../knowledge/glossary/project-structure-concepts|Project Structure Concepts]] - Feature module organization, backend architecture
> - [[../knowledge/glossary/testing|Testing]] - Vitest, React Testing Library, pytest, MSW patterns

### New Dependencies

**Recharts v3.7.0** - Charting library for dashboard visualizations
- React-first declarative API with full TypeScript support
- ResponsiveContainer handles automatic sizing without manual resize listeners
- Provides PieChart, LineChart, BarChart with composable sub-components

### New Architectural Patterns Introduced

**Client-Side Data Aggregation (Dashboard):**
- `useDashboardSummary` hook fetches raw data via existing hooks and performs memoized aggregation
- No dedicated backend summary endpoint required; leverages React Query caching of existing endpoint responses
- Date range filtering converts preset strings ('7d', '30d', 'month') into ISO date boundary strings passed as query params

**Many-to-Many Relationship via Join Table (Budgets):**
- Pattern: `Budget ↔ BudgetCategory ↔ Category`
- Join table (`budget_category`) includes `tenant_id` per north_star.md invariant requiring every domain record to carry valid tenant context
- Unique constraint on `(budget_id, category_id)` prevents duplicate associations
- CASCADE delete maintains referential integrity

**Currency-Aware Aggregation (Budgets):**
- Spent calculations filter transactions by matching `budget.currency == transaction.currency`
- Prevents mixing BRL and USD amounts in spent totals
- Backend accepts any ISO 4217 currency code; frontend defaults to "BRL"

**On-Read Calculation Pattern (Budgets):**
- Spent amounts calculated dynamically on GET requests rather than stored in the database
- Aggregates expense transactions for the specified month/year (defaults to current month)
- Pros: Always accurate, no synchronization issues, simpler data model
- Cons: Heavier read queries (acceptable at MVP scale)

**Universal Budget Concept (Budgets):**
- Budget with zero category associations tracks ALL tenant expense transactions (filtered by currency)
- Backend query uses LEFT JOIN to handle both specific-category and all-category budgets
- Frontend displays "All Categories" chip for universal budgets

**Responsive Drawer Architecture (Mobile-Ready):**
- AppShell acts as the single source of truth for `sideNavigationOpen` state and `isMobileViewport`
- Passes `onMenuToggle` and `onNavigate` callbacks down to TopNav and SideNav
- SideNav renders as `persistent` Drawer on desktop (pushes content) or `temporary` Drawer on mobile (overlays content)

### Test Infrastructure Evolution

**Backend Testing - New conftest.py:**
- Comprehensive pytest fixtures for test isolation with in-memory SQLite database
- Reusable fixtures for users, tenants, memberships, accounts, categories, and transactions
- `authorization_header()` helper for authenticated requests in every test

**Frontend Testing - QueryClient Stability Fix:**
- `QueryClient` in test render wrapper stabilized using `useState` to prevent re-creation across renders
- Prevents React Query cache from being dropped mid-test, eliminating flaky test failures

**MSW Handler Fixes:**
- Transaction handler query param keys corrected to match actual frontend request format
- Budget handlers added with in-memory store supporting full CRUD simulation including spent calculation

---

## Directory Structure

```
.
├── .claude/
│   ├── commands/
│   │   └── orchestrate.md                             ✏️ Updated orchestration workflow
│   ├── instructions.md                                ✏️ Updated coding standards
│   └── settings.local.json                            ✏️ Updated project preferences
├── .devcontainer/
│   ├── backend/
│   │   └── devcontainer.json                          ❌ DELETED (replaced by unified container)
│   ├── frontend/
│   │   └── devcontainer.json                          ❌ DELETED (replaced by unified container)
│   └── devcontainer.json                              🆕 Unified single-container devcontainer config
├── .env.production.example                            🆕 Production environment variable template
├── .memory_bank/
│   └── components_used.md                             ✏️ Tracked dashboard + budget components
├── Dockerfile.backend.dev                             ❌ DELETED (replaced by Dockerfile.devcontainer)
├── Dockerfile.devcontainer                            🆕 Unified dev container Dockerfile
├── Dockerfile.frontend.dev                            ❌ DELETED (replaced by Dockerfile.devcontainer)
├── CLAUDE.md                                          ✏️ Updated project guidance
├── backend/
│   ├── api/
│   │   ├── Dockerfile                                 ✏️ Updated production build
│   │   ├── alembic/versions/
│   │   │   └── a1b2c3d4e5f6_add_budget_and_budget_category_tables.py  🆕 Budget migration
│   │   ├── app/
│   │   │   ├── main.py                                ✏️ Registered budgets router
│   │   │   ├── models.py                              ✏️ Added Budget + BudgetCategory models
│   │   │   ├── schemas.py                             ✏️ Added Budget schemas
│   │   │   └── routers/
│   │   │       └── budgets.py                         🆕 Budget CRUD endpoints (573 lines)
│   │   └── tests/
│   │       ├── __init__.py                            🆕 Test package marker
│   │       ├── conftest.py                            🆕 Pytest fixtures and utilities (516 lines)
│   │       └── test_budget_endpoints.py               🆕 Comprehensive budget tests (2,518 lines)
│   ├── requirements.txt                               ✏️ Updated dependencies
│   └── scripts/
│       └── seed_test_data.py                          🆕 DB seed script for QA (434 lines)
├── docker-compose.dev.yml                             ✏️ Consolidated dev services
├── docker-compose.yaml                                ✏️ Updated production compose
├── docs/
│   ├── active_context/
│   │   ├── sprint_4_milestone_1_summary.md            ❌ DELETED (archived)
│   │   ├── sprint_4_p2_feedback.md                    ❌ DELETED (archived)
│   │   ├── sprint_5.md                                ✏️ Marked all tasks complete
│   │   ├── sprint_6.md                                ❌ DELETED (sprint 6 skipped/merged into 7)
│   │   ├── sprint_7.md                                ✏️ Marked all tasks complete
│   │   ├── sprint_8.md                                🆕 Next sprint planning
│   │   └── frontend_roadmap.md                        ✏️ Updated with sprint progress
│   ├── Inbox/
│   │   ├── Celery.md                                  🆕 Celery learning notes
│   │   ├── Celery_Deep_Dive.md                        🆕 Deep dive notes
│   │   ├── Quick fixes.md                             🆕 Quick reference notes
│   │   ├── Recharts.md                                🆕 Recharts learning notes
│   │   ├── Redis.md                                   🆕 Redis learning notes
│   │   ├── redis_deep_dive.md                         🆕 Redis deep dive notes
│   │   └── redis_quick_reference.md                   🆕 Redis quick reference
│   ├── Pull Requests/
│   │   ├── Mobile_Ready_Release.md                    🆕 Mobile sprint PR doc
│   │   ├── Sprint_5_Dashboard_Release.md              🆕 Sprint 5 PR doc
│   │   └── Sprint_7_Release.md                        🆕 Sprint 7 PR doc
│   ├── knowledge/glossary/
│   │   └── state-management.md                        ✏️ Added React Query notes
│   ├── roadmap/
│   │   └── import_flow.md                             🆕 CSV import flow roadmap item
│   ├── openAPI_spec.json                              ✏️ Regenerated with budget endpoints
│   └── SystemArchitecture.md                          ✏️ Updated architecture docs
└── frontend/
    ├── Dockerfile                                     ✏️ Updated production build
    ├── package.json                                   ✏️ Added Recharts dependency
    ├── package-lock.json                              ✏️ Updated lockfile
    ├── vitest.config.ts                               ✏️ Extended test timeout to 10s
    └── src/
        ├── __tests__/
        │   ├── dashboard.integration.test.tsx         🆕 Dashboard integration tests (16 tests)
        │   └── transactions.integration.test.tsx      ✏️ Updated MSW handler key fixes
        ├── components/
        │   ├── domain/ag/
        │   │   └── AgTransactionsGrid.tsx             ✏️ BRL currency formatting
        │   ├── molecules/
        │   │   ├── DateRangePicker.tsx                ✏️ DD/MM/YYYY date format
        │   │   └── TransactionListItem.tsx            ✏️ BRL currency formatting
        │   ├── organisms/
        │   │   └── TransactionsGrid.tsx               ✏️ BRL currency formatting
        │   └── ui/
        │       ├── molecules/
        │       │   └── FamilySwitcherMini.tsx         ✏️ Text truncation for mobile
        │       └── organisms/
        │           ├── AppShell.tsx                   ✏️ Responsive drawer state + LAYOUT constants
        │           ├── OverviewCard.tsx               🆕 KPI card component
        │           ├── SideNav.tsx                    ✏️ Persistent/temporary drawer variants
        │           └── TopNav.tsx                     ✏️ Hamburger menu button
        ├── features/
        │   ├── accounts/components/
        │   │   ├── AccountShareList.tsx               ✏️ BRL currency formatting
        │   │   └── AccountSummary.tsx                 ✏️ BRL currency formatting
        │   ├── app/pages/
        │   │   ├── AppRoot.tsx                        ✏️ Updated default route to dashboard
        │   │   └── WelcomePage.tsx                    ❌ DELETED (replaced by dashboard)
        │   ├── budgets/                               🆕 Complete budgets feature module
        │   │   ├── __tests__/
        │   │   │   ├── BudgetForm.test.tsx            🆕 Form tests (298 lines)
        │   │   │   └── BudgetsPage.test.tsx           🆕 Page integration tests (451 lines)
        │   │   ├── api/
        │   │   │   └── budgetsApi.ts                  🆕 API client functions (185 lines)
        │   │   ├── components/
        │   │   │   ├── BudgetForm.tsx                 🆕 Create/edit modal form (294 lines)
        │   │   │   ├── BudgetsList.tsx                🆕 AG Grid display (265 lines)
        │   │   │   └── DeleteBudgetConfirm.tsx        🆕 Delete confirmation dialog (73 lines)
        │   │   ├── hooks/
        │   │   │   ├── useBudgets.ts                  🆕 Query hook for budgets list
        │   │   │   ├── useCreateBudget.ts             🆕 Create mutation hook
        │   │   │   ├── useDeleteBudget.ts             🆕 Delete mutation hook
        │   │   │   └── useUpdateBudget.ts             🆕 Update mutation hook
        │   │   ├── pages/
        │   │   │   ├── BudgetsPage.tsx                🆕 Main budgets page (220 lines)
        │   │   │   └── index.ts                       🆕 Page barrel exports
        │   │   └── types.ts                           🆕 TypeScript interfaces (53 lines)
        │   ├── dashboard/                             🆕 Complete dashboard feature module
        │   │   ├── components/
        │   │   │   ├── IncomeVsExpenses.tsx           🆕 Recharts LineChart widget
        │   │   │   ├── QuickActions.tsx               🆕 Navigation shortcut buttons
        │   │   │   ├── RecentTransactionsWidget.tsx   🆕 AG Grid recent transactions
        │   │   │   └── SpendingByCategory.tsx         🆕 Recharts PieChart widget
        │   │   ├── hooks/
        │   │   │   └── useDashboardSummary.ts         🆕 Client-side aggregation hook
        │   │   └── pages/
        │   │       └── DashboardPage.tsx              🆕 Main dashboard layout
        │   ├── family/
        │   │   ├── components/
        │   │   │   ├── FamilyList.tsx                 ✏️ Flexbox layout for responsive cards
        │   │   │   └── FamilySettings.tsx             ✏️ BRL formatting
        │   │   └── hooks/
        │   │       └── useSwitchFamily.ts             ✏️ Updated family switching
        │   └── transactions/
        │       ├── components/
        │       │   └── TransactionForm.tsx            ✏️ BRL default currency + DD/MM/YYYY
        │       └── pages/
        │           └── TransactionsPage.tsx           ✏️ Updated for BRL context
        ├── lib/
        │   ├── constants.ts                           ✏️ Added LAYOUT.DRAWER_WIDTH + budget endpoints
        │   └── dateUtils.ts                           🆕 Centralized date formatting (39 lines)
        ├── router/
        │   └── index.tsx                              ✏️ Added /dashboard + /budgets routes
        └── test/
            ├── mocks/
            │   ├── handlers/
            │   │   ├── budgets.ts                     🆕 MSW budget handlers (287 lines)
            │   │   ├── index.ts                       ✏️ Imported budget handlers
            │   │   └── transactions.ts                ✏️ Fixed query param keys
            │   └── server.ts                          ✏️ Exported resetBudgetStore
            └── utils.tsx                              ✏️ Stabilized QueryClient with useState

Legend:
🆕 NEW file
✏️ MODIFIED file
❌ DELETED file
```

---

## Files Changed - Detailed Breakdown

### Sprint 5: Dashboard Feature

#### 🆕 **frontend/src/features/dashboard/pages/DashboardPage.tsx**
**Status:** NEW
**Purpose:** Main dashboard page composing all dashboard widgets in a responsive grid layout.
Uses [[../knowledge/glossary/state-management|State Management]] with React Query for server data and local state for date range selection.

**Key Features:**
- Date range toggle: 7 days, 30 days, or current month via MUI ToggleButtonGroup
- Passes selected date range down to `useDashboardSummary` hook which passes to API hooks
- Responsive MUI Grid layout: 3 columns on desktop, stacked on mobile
- Loading skeleton state from `useDashboardSummary.isLoading`
- Error state with MUI Alert if any underlying query fails

**Integration:**
- Consumes `useDashboardSummary(familyId, dateRange)` hook
- Composes `OverviewCard`, `SpendingByCategory`, `IncomeVsExpenses`, `RecentTransactionsWidget`, `QuickActions`
- Registered at `/app/:familyId/dashboard` route; becomes default landing page replacing WelcomePage

---

#### 🆕 **frontend/src/components/ui/organisms/OverviewCard.tsx**
**Status:** NEW
**Purpose:** Reusable KPI card component used three times on the dashboard (Total Expenses, Total Income, Net Balance).
See [[../knowledge/glossary/ui-components-design|UI Components & Design]] for atomic design placement.

**Key Features:**
- Props: `title`, `value` (formatted string), `color` (MUI color token), `icon`
- MUI Card with subtle colored left border for visual differentiation
- Net Balance card uses green for positive, red for negative values
- Placed in `components/ui/organisms/` because it is a shared card used across features

---

#### 🆕 **frontend/src/features/dashboard/hooks/useDashboardSummary.ts**
**Status:** NEW
**Purpose:** Client-side data aggregation hook that derives dashboard metrics from raw API data.
Implements [[../knowledge/glossary/react-patterns-hooks|React Patterns & Hooks]] with `useMemo` for performance.

**Key Features:**
- Calls existing `useTransactions`, `useAccounts`, and `useCategories` hooks internally
- Derives: `totalExpenses`, `totalIncome`, `netBalance`, `spendingByCategoryData` (array for PieChart), `incomeVsExpensesData` (array for LineChart), `recentTransactions`
- All aggregation wrapped in `useMemo` to avoid recalculation on unrelated renders
- Returns `{ summary, isLoading, isError }` for clean consumer API

**Why Client-Side:**
- Avoids requiring a dedicated backend summary endpoint
- Leverages React Query cache shared with other pages (no duplicate requests)
- Suitable for MVP scale; backend aggregation can be added later if performance requires

---

#### 🆕 **frontend/src/features/dashboard/components/SpendingByCategory.tsx**
**Status:** NEW
**Purpose:** Recharts PieChart visualizing expense breakdown by category.
Uses [[../knowledge/glossary/ui-components-design|UI Components & Design]] responsive chart patterns.

**Key Features:**
- Recharts `ResponsiveContainer > PieChart > Pie > Cell` composition
- Slices colored by a predefined MUI-compatible palette array
- Tooltip shows category name and formatted BRL amount on hover
- Legend hidden on mobile (via `useMediaQuery`) to save vertical space
- Empty state: renders "No expense data" message when array is empty

---

#### 🆕 **frontend/src/features/dashboard/components/IncomeVsExpenses.tsx**
**Status:** NEW
**Purpose:** Recharts LineChart comparing income and expense trends over the selected date range.

**Key Features:**
- Two `Line` series: Income (green) and Expenses (red)
- X-axis shows dates formatted in DD/MM format
- Y-axis labels formatted as BRL currency
- Tooltip displays both values for the hovered date
- Responsive width via `ResponsiveContainer`

---

#### 🆕 **frontend/src/features/dashboard/components/RecentTransactionsWidget.tsx**
**Status:** NEW
**Purpose:** Compact AG Grid table showing up to 10 most recent transactions in the selected date range.

**Key Features:**
- Reuses the existing `AgTransactionsGrid` domain component
- Limited to 10 rows for dashboard readability
- Columns: Date (DD/MM/YYYY), Description, Category, Amount (BRL)
- Click-through link to full transactions page

---

#### 🆕 **frontend/src/features/dashboard/components/QuickActions.tsx**
**Status:** NEW
**Purpose:** Navigation shortcut buttons for high-frequency user tasks.

**Key Features:**
- Three MUI Buttons: Add Transaction, View All Transactions, Manage Budgets
- Uses `useNavigate` from React Router to push to appropriate family-scoped routes
- Placed at bottom of dashboard to avoid competing with charts for attention

---

#### 🆕 **frontend/src/__tests__/dashboard.integration.test.tsx**
**Status:** NEW
**Purpose:** Integration tests for DashboardPage component covering all user-facing behaviors.
Follows [[../knowledge/glossary/testing|Testing]] integration-first approach with full page renders.

**Test Coverage (16 tests):**
- Renders all three OverviewCard KPIs with correct values
- Shows loading skeleton during data fetch
- Displays error state on API failure
- Shows empty state messaging when no transactions exist
- Date range toggle changes displayed data (7 days vs. 30 days)
- PieChart renders category slices with labels
- LineChart renders income and expense lines
- RecentTransactionsWidget shows up to 10 transactions
- QuickActions buttons navigate to correct routes

---

#### ❌ **frontend/src/features/app/pages/WelcomePage.tsx**
**Status:** DELETED
**Purpose:** Removed temporary placeholder page that was the default landing destination.

**Reason:** Replaced by `DashboardPage` which provides genuine financial value. The route `/app/:familyId/` now redirects to `/app/:familyId/dashboard` via updated `AppRoot.tsx`.

---

---

### Sprint 7: Budgets Feature - Backend

#### 🆕 **backend/api/alembic/versions/a1b2c3d4e5f6_add_budget_and_budget_category_tables.py**
**Status:** NEW
**Purpose:** Alembic migration creating the `budget` and `budget_category` database tables.

**Schema Changes:**
- `budget` table: `id`, `tenant_id`, `name`, `amount` (Decimal), `currency` (string), `created_at`, `updated_at`
- `budget_category` join table: `id`, `tenant_id`, `budget_id` (FK to budget), `category_id` (FK to category), `added_at`
- Unique constraint on `(budget_id, category_id)` prevents duplicate associations
- CASCADE delete on `budget_id` FK ensures join rows are cleaned up when a budget is deleted
- Indexes on `tenant_id` columns for efficient multi-tenant query filtering

**Impact:** Establishes the database foundation for the budgets feature; enforces data integrity via constraints; enables many-to-many category relationships.

---

#### ✏️ **backend/api/app/models.py**
**Status:** MODIFIED
**Purpose:** SQLModel domain models representing database tables.

**Key Changes:**
- Added `Budget` model with fields: `id`, `tenant_id`, `name`, `amount` (Decimal), `currency`, timestamps
- Added `BudgetCategory` join model with fields: `id`, `tenant_id`, `budget_id`, `category_id`, `added_at`
- Unique constraint defined at table level via `__table_args__` on `BudgetCategory`
- `tenant_id` included on join table per north_star.md multi-tenant invariant (every domain record must carry valid tenant context)

**Impact:** Enables ORM operations on budgets; establishes many-to-many pattern reusable in future features; enforces multi-tenant isolation at the model level.

---

#### ✏️ **backend/api/app/schemas.py**
**Status:** MODIFIED
**Purpose:** Pydantic schemas defining API request/response contracts.

**Key Changes:**
- `BudgetCreate`: `name` (required), `amount` (required, min 0.01), `currency` (default "BRL"), `category_ids` (optional list)
- `BudgetRead`: All budget fields + `categories` (list of `CategoryRead`) + `spent` (Decimal, calculated on read) + `month`, `year`
- `BudgetUpdate`: All fields optional; when `category_ids` provided, replaces entire category set (not additive)

**Impact:** Defines clear API contracts; enables automatic request validation; the `spent` field is dynamically calculated and never stored, keeping the schema honest.

---

#### 🆕 **backend/api/app/routers/budgets.py**
**Status:** NEW (573 lines)
**Purpose:** FastAPI router implementing five budget CRUD endpoints with multi-tenant isolation, role-based authorization, and currency-aware spent calculation.
See [[../knowledge/glossary/api-communication|API Communication]] for REST patterns and [[../knowledge/glossary/authentication-security|Authentication & Security]] for multi-tenant enforcement.

**Endpoints:**
- `GET /app/{tenant_id}/budgets?month=N&year=YYYY` - List all budgets with spent amounts
- `GET /app/{tenant_id}/budgets/{budget_id}?month=N&year=YYYY` - Single budget with categories and spent
- `POST /app/{tenant_id}/budgets` - Create budget with optional category associations
- `PATCH /app/{tenant_id}/budgets/{budget_id}` - Update budget; `category_ids` replaces entire set
- `DELETE /app/{tenant_id}/budgets/{budget_id}` - Delete budget (CASCADE removes join table rows)

**Technical Highlights:**
- `_calculate_spent_for_budget()`: Private helper aggregating expense transactions for specified month, filtered by matching currency
- `_fetch_categories_for_budget()`: Joins `BudgetCategory` to `Category` with parent category names
- Universal budget support: no categories assigned means all tenant expense transactions count (currency-filtered)
- Tenant validation: verifies `budget.tenant_id == category.tenant_id == budget_category.tenant_id`
- Authorization: OWNER-only for create/update/delete; all roles can read

**Impact:** Provides complete backend API for budgets feature; enforces data isolation; enables real-time spent tracking; supports flexible multi-category budget management.

---

#### ✏️ **backend/api/app/main.py**
**Status:** MODIFIED
**Purpose:** FastAPI application entry point.

**Key Changes:**
- Registered `budgets_router` with `/app/{tenant_id}` path prefix
- Added alongside existing accounts, categories, and transactions routers

**Impact:** Exposes budget endpoints to the frontend; maintains consistent API path structure.

---

#### 🆕 **backend/api/tests/__init__.py**
**Status:** NEW
**Purpose:** Python package marker making the `tests/` directory importable as a module.

**Impact:** Enables relative imports between test modules; follows Python package conventions.

---

#### 🆕 **backend/api/tests/conftest.py**
**Status:** NEW (516 lines)
**Purpose:** Central pytest configuration and fixture library for all backend tests.
See [[../knowledge/glossary/testing|Testing]] for testing infrastructure patterns.

**Key Fixtures:**
- Database fixtures: in-memory SQLite engine, async session management, automatic table creation and teardown per test
- Auth fixtures: `set_test_mode_env` for TEST_MODE environment setup; `authorization_header()` helper returning `Bearer {token}` dict
- Domain fixtures: `user1`, `user2`, `tenant1`, `tenant2`, `membership1`, `account1`, `category_groceries`, `category_salary`, and pre-built sample transactions
- Isolation pattern: each test gets a fresh database via pytest fixture scoping

**Impact:** Eliminates test boilerplate across all backend test files; ensures test isolation; provides consistent test data; enables fast test execution with SQLite.

---

#### 🆕 **backend/api/tests/test_budget_endpoints.py**
**Status:** NEW (2,518 lines)
**Purpose:** Comprehensive test suite for all five budget CRUD endpoints.

**Test Classes:**
- `TestBudgetCreate`: Creation with and without categories, validation rejections (negative amounts, empty names, non-existent categories, tenant mismatches)
- `TestBudgetRead`: List with spent, single budget retrieval, historical month queries
- `TestBudgetUpdate`: Name, amount, currency, category updates; PATCH with `category_ids` replaces full set
- `TestBudgetDelete`: Deletion and CASCADE effects on `budget_category` join rows
- `TestBudgetSpentCalculation`: Multi-category aggregation, universal budgets, currency filtering (BRL budget ignores USD transactions), historical months
- `TestBudgetTenantIsolation`: Cross-tenant access prevention, cross-tenant category assignment rejection, `budget_category.tenant_id` validation
- `TestBudgetAuthorization`: OWNER-only mutations, MEMBER/VIEWER can read

**Impact:** Validates correctness, tenant isolation, and authorization of the budget API; prevents regressions; documents expected behavior for future developers.

---

#### 🆕 **backend/scripts/seed_test_data.py**
**Status:** NEW (434 lines)
**Purpose:** Database seeding script for consistent manual QA testing in development environments.

**Features:**
- Safety gate: requires `FORCE_SEED=1` environment variable to prevent accidental data wipes
- Complete dataset: 2 users, 2 tenants, memberships, accounts (cash/debit/credit), hierarchical categories, 50+ transactions spanning 3 months, budgets with multi-category associations
- Deterministic randomness via `random.seed(42)` for reproducible test data across runs
- Container-friendly: designed to run inside the Docker backend container

**Usage:**
```bash
docker compose -f docker-compose.dev.yml exec backend sh -c \
  'FORCE_SEED=1 python scripts/seed_test_data.py'
```

**Test Data:**
- alice@example.com (password: "password123") - owns Silva Family
- bob@example.com (password: "password123") - owns Santos Family
- Each tenant: 3 accounts, 10+ categories (income + expense), 25+ transactions, 3 budgets (including one universal budget)

**Impact:** Enables consistent manual QA; eliminates manual data entry during testing; demonstrates realistic usage patterns for stakeholder demos.

---

### Sprint 7: Budgets Feature - Frontend

#### 🆕 **frontend/src/features/budgets/types.ts**
**Status:** NEW (53 lines)
**Purpose:** TypeScript type definitions for the budgets feature.
See [[../knowledge/glossary/typescript|TypeScript]] for type safety patterns.

**Types Defined:**
- `Budget`: Core budget entity matching backend `BudgetRead` Pydantic schema
- `BudgetCreatePayload`: Request payload for creating budgets (matches `BudgetCreate`)
- `BudgetUpdatePayload`: Request payload for updating budgets (all fields optional)
- `Category`: Category entity with optional parent for display in multi-select

**Impact:** Ensures type safety across all budgets feature files; provides IDE autocomplete; prevents runtime type errors.

---

#### 🆕 **frontend/src/features/budgets/api/budgetsApi.ts**
**Status:** NEW (185 lines)
**Purpose:** API client functions for budget CRUD operations using the centralized `apiFetch` wrapper.
Implements [[../knowledge/glossary/api-communication|API Communication]] patterns.

**Functions:**
- `getBudgets(familyId, month?, year?)`: Fetch all budgets with optional month/year filter params
- `getBudget(familyId, budgetId, month?, year?)`: Fetch single budget with categories and spent
- `createBudget(familyId, data)`: POST new budget
- `updateBudget(familyId, budgetId, data)`: PATCH existing budget
- `deleteBudget(familyId, budgetId)`: DELETE budget

**Technical Details:**
- All functions call `apiFetch()` which automatically adds the `Authorization: Bearer {token}` header
- Constructs URL with `tenant_id` in the path (matching backend router prefix)
- Month/year query params appended when provided; backend defaults to current month when absent
- Returns typed responses matching Pydantic schemas via TypeScript generics

**Impact:** Centralizes API logic; provides clean functions for React Query hooks; maintains consistent auth and error handling.

---

#### 🆕 **frontend/src/features/budgets/hooks/useBudgets.ts**
**Status:** NEW
**Purpose:** React Query hook for fetching the budgets list.
Part of [[../knowledge/glossary/state-management|State Management]] architecture.

**Key Details:**
- Query key: `['budgets', familyId, month, year]`
- Calls `getBudgets()` from `budgetsApi.ts`
- Automatic refetching on window focus
- Disabled when `familyId` is undefined (avoids premature requests)

---

#### 🆕 **frontend/src/features/budgets/hooks/useCreateBudget.ts**
**Status:** NEW
**Purpose:** React Query mutation hook for creating budgets.

**Key Details:**
- `onSuccess`: invalidates `['budgets', familyId]` to refresh the list
- Returns `isPending` for disabling the submit button during inflight requests
- Error propagated up via React Query's `onError` for parent error handling

---

#### 🆕 **frontend/src/features/budgets/hooks/useUpdateBudget.ts**
**Status:** NEW
**Purpose:** React Query mutation hook for updating budgets.

**Key Details:**
- Accepts `budgetId` as a parameter at call time (not hook creation time)
- `onSuccess`: invalidates `['budgets', familyId]` query
- Supports partial updates via `BudgetUpdatePayload` (all fields optional)

---

#### 🆕 **frontend/src/features/budgets/hooks/useDeleteBudget.ts**
**Status:** NEW
**Purpose:** React Query mutation hook for deleting budgets.

**Key Details:**
- `onSuccess`: invalidates `['budgets', familyId]` to remove deleted item from list
- Returns mutation state for button loading/disabled feedback in `DeleteBudgetConfirm`

---

#### 🆕 **frontend/src/features/budgets/components/BudgetsList.tsx**
**Status:** NEW (265 lines)
**Purpose:** AG Grid component displaying budgets with progress bars, category chips, and action buttons.
Uses [[../knowledge/glossary/ui-components-design|UI Components & Design]] patterns for AG Grid integration.

**Column Configuration:**
- Name (string)
- Amount (BRL formatted via `valueFormatter`)
- Currency (string)
- Spent (BRL formatted, calculated on backend)
- Progress Bar (custom `cellRenderer` using MUI `LinearProgress`):
  - Green: less than 80% spent
  - Yellow/warning: 80-99% spent
  - Red/error: 100% or more spent (over budget)
- Categories (custom `cellRenderer` using MUI `Chip` array; "All Categories" chip for universal budgets)
- Actions (Edit / Delete buttons with callbacks)

**Impact:** Provides primary UI for viewing budgets; visualizes spending progress at a glance; enables quick budget management from a single table view.

---

#### 🆕 **frontend/src/features/budgets/components/BudgetForm.tsx**
**Status:** NEW (294 lines)
**Purpose:** Modal form for creating and editing budgets with multi-category selection.
Implements [[../knowledge/glossary/react-patterns-hooks|React Patterns & Hooks]] with React Hook Form.

**Form Fields:**
- Name (text input, required, max 255 characters)
- Amount (number input, required, minimum 0.01)
- Currency (dropdown selector, default "BRL")
- Categories (MUI Autocomplete with `multiple` prop for multi-select, optional)

**Key Behaviors:**
- Dual-mode component: `initialData` prop being undefined means create mode; being set means edit mode
- Edit mode pre-populates all fields from the existing budget
- Category Autocomplete fetches options via `useCategories` hook
- Form submission extracts `category_ids` from selected category objects for API payload
- Accessible: proper labels, `aria-label` attributes, error messages associated via `id`

**Impact:** Enables budget creation and editing in a single reusable component; enforces validation; provides intuitive multi-category selection.

---

#### 🆕 **frontend/src/features/budgets/components/DeleteBudgetConfirm.tsx**
**Status:** NEW (73 lines)
**Purpose:** Confirmation dialog preventing accidental budget deletions.

**Key Features:**
- Displays the budget name so the user knows exactly what they are deleting
- Cancel button (grey) and Delete button (red/error color)
- Both buttons disabled during the deletion mutation (`isPending`)
- Calls parent-provided `onConfirm` handler when Delete is clicked

**Impact:** Prevents accidental data loss; follows destructive action UX best practices with explicit confirmation.

---

#### 🆕 **frontend/src/features/budgets/pages/BudgetsPage.tsx**
**Status:** NEW (220 lines)
**Purpose:** Main budgets page composing BudgetsList, BudgetForm, and DeleteBudgetConfirm components.
Manages modal state via local `useState` following [[../knowledge/glossary/state-management|State Management]] patterns.

**State Variables:**
- `formMode`: `null | 'create' | 'edit'` - controls which modal (if any) is visible
- `selectedBudget`: `Budget | null` - the budget being edited
- `budgetToDelete`: `Budget | null` - the budget pending deletion confirmation

**Page Sections:**
- Header row with "Budgets" title and "Add Budget" button
- Loading skeleton (MUI Skeleton) during data fetch
- Error alert with retry option on API failure
- Empty state with friendly message when budget list is empty
- BudgetsList AG Grid when data is available
- BudgetForm modal (create or edit mode)
- DeleteBudgetConfirm modal

**Impact:** Provides complete budgets UI; orchestrates all CRUD operations; follows the established page layout pattern used throughout the app.

---

#### 🆕 **frontend/src/features/budgets/__tests__/BudgetsPage.test.tsx**
**Status:** NEW (451 lines)
**Purpose:** Integration tests for the BudgetsPage component simulating real user workflows.
See [[../knowledge/glossary/testing|Testing]] for integration testing patterns.

**Test Coverage:**
- Renders budgets in AG Grid with name, amount, spent, progress bar, and category chips
- Shows loading skeleton during data fetch
- Displays error alert on API failure
- Shows empty state when no budgets exist
- Create workflow: opens form modal, fills fields, submits, modal closes, list refreshes
- Edit workflow: opens form pre-populated with existing data, modifies fields, submits
- Delete workflow: opens confirmation dialog, confirms, item removed from list
- Universal budget: "All Categories" chip displayed when no categories assigned

**Infrastructure:**
- `renderBudgetsPage()` helper renders with React Router context
- MSW in-memory budget store for realistic API interactions without a running backend
- `resetBudgetStore()` called in `beforeEach` for test isolation

---

#### 🆕 **frontend/src/features/budgets/__tests__/BudgetForm.test.tsx**
**Status:** NEW (298 lines)
**Purpose:** Unit tests for BudgetForm component in both create and edit modes.

**Test Coverage:**
- Create mode: empty form, submits correct payload including `category_ids`
- Edit mode: pre-populated fields, submits updated payload
- Required field validation: name and amount rejected if blank
- Minimum amount: 0 rejected, 0.01 accepted
- Max length: name longer than 255 characters rejected
- Multi-category Autocomplete: selecting categories, chip display, removing selections
- Currency dropdown: BRL default, changing to other options
- Cancel closes modal without triggering mutation
- Submit button disabled and loading spinner shown during `isPending`

---

#### 🆕 **frontend/src/test/mocks/handlers/budgets.ts**
**Status:** NEW (287 lines)
**Purpose:** MSW (Mock Service Worker) request handlers for the budgets API with in-memory store.
See [[../knowledge/glossary/testing|Testing]] for MSW mock patterns.

**Features:**
- `budgetStore` array persists budget data across requests within a single test
- Spent calculation: simulates backend logic by aggregating mock transactions filtered by currency and month
- Handlers for all five endpoints: GET list, GET single, POST create, PATCH update, DELETE
- Category association simulation: links to mock category store
- `resetBudgetStore()` export clears store data between tests for isolation

**Impact:** Enables realistic testing without a running backend; supports full integration test workflows; provides predictable data for assertion.

---

#### ✏️ **frontend/src/test/mocks/handlers/index.ts**
**Status:** MODIFIED

**Key Changes:**
- Imported `budgetHandlers` from `budgets.ts` and spread into the handlers array

**Impact:** Registers budget API mocks with the MSW server for all tests.

---

#### ✏️ **frontend/src/test/mocks/server.ts**
**Status:** MODIFIED

**Key Changes:**
- Exported `resetBudgetStore` function for use in test `beforeEach` hooks

**Impact:** Enables per-test budget store resets to maintain test isolation.

---

### Mobile-Ready: Responsive Layout

#### ✏️ **frontend/src/components/ui/organisms/AppShell.tsx**
**Status:** MODIFIED
**Purpose:** Top-level application layout shell.
Implements [[../knowledge/glossary/ui-components-design|UI Components & Design]] responsive layout patterns.

**Key Changes:**
- Added `sideNavigationOpen` state owned by AppShell (single source of truth)
- Added `isMobileViewport` via MUI `useMediaQuery('(max-width:899px)')`
- Passes `onMenuToggle` callback to TopNav for hamburger button
- Passes `isOpen`, `isMobile`, and `onClose` props to SideNav for drawer control
- Added `LAYOUT.DRAWER_WIDTH` consumption from constants for consistent spacing

**Why AppShell Owns the State:**
- Avoids prop drilling through TopNav and SideNav independently
- Single `useState` controlling both the hamburger visibility and drawer state
- Follows React's "lift state up" pattern for shared state between siblings

---

#### ✏️ **frontend/src/components/ui/organisms/SideNav.tsx**
**Status:** MODIFIED
**Purpose:** Application sidebar navigation.

**Key Changes:**
- Accepts `variant` prop: `'persistent'` on desktop (pushes main content aside) or `'temporary'` on mobile (overlays content)
- Accepts `open` and `onClose` props for controlled drawer behavior
- Auto-closes after any navigation link is clicked on mobile (calls `onClose` in `NavLink` onClick handler)
- Drawer width uses `LAYOUT.DRAWER_WIDTH` constant (240px) instead of inline value

**Impact:** Enables proper mobile navigation with overlay drawer; desktop behavior unchanged; prevents drawer from staying open after navigation on small screens.

---

#### ✏️ **frontend/src/components/ui/organisms/TopNav.tsx**
**Status:** MODIFIED
**Purpose:** Application top navigation bar.

**Key Changes:**
- Added `onMenuClick` prop (called when hamburger button is clicked)
- Added MUI `IconButton` with `MenuIcon` visible only when `isMobile` prop is true
- App title text hidden on mobile to free space for the hamburger button and family switcher
- App title remains visible on desktop

**Impact:** Provides the standard mobile navigation trigger (hamburger menu); keeps top bar uncluttered on small screens.

---

#### ✏️ **frontend/src/lib/constants.ts**
**Status:** MODIFIED
**Purpose:** Application-wide constants.

**Key Changes:**
- Added `LAYOUT` object: `{ DRAWER_WIDTH: 240 }`
- Added budget API endpoint path constants

**Why Centralize Drawer Width:**
- The drawer width value was previously duplicated between `SideNav.tsx` and `AppShell.tsx`
- A single source of truth prevents drift if the value needs changing

**Impact:** Eliminates magic numbers in layout components; provides budget endpoint paths for API client.

---

#### ✏️ **frontend/src/components/ui/molecules/FamilySwitcherMini.tsx**
**Status:** MODIFIED
**Purpose:** Compact family name display in the sidebar.

**Key Changes:**
- Added `overflow: 'hidden'`, `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'` to family name text
- Constrained width to prevent overflow on narrow mobile drawers

**Impact:** Prevents long family names from breaking the sidebar layout on small screens.

---

#### ✏️ **frontend/src/features/family/components/FamilyList.tsx**
**Status:** MODIFIED
**Purpose:** Grid of family cards on the family selection screen.

**Key Changes:**
- Replaced MUI `Grid` container/item pattern with flexbox `Box` using `flexWrap: 'wrap'`
- Each card uses `flex: '1 1 300px'` (minimum 300px, grows to fill available space)
- Produces equal-width cards that reflow naturally on mobile without MUI Grid breakpoint complexity

**Impact:** Family cards display correctly at all viewport widths without needing explicit `xs`/`sm`/`md` breakpoint props.

---

#### ✏️ **frontend/src/features/dashboard/components/SpendingByCategory.tsx** (mobile update)
**Status:** MODIFIED (as part of Mobile-Ready sprint)

**Key Changes:**
- Recharts `Legend` component conditionally hidden when `isMobileViewport` is true
- Prevents legend from consuming vertical space on phones where chart is already compact

---

### BRL Localization

#### 🆕 **frontend/src/lib/dateUtils.ts**
**Status:** NEW (39 lines)
**Purpose:** Centralized date formatting utilities for consistent Brazilian date handling throughout the app.

**Functions:**
- `formatDateBR(date: Date): string` - Formats a Date object as `DD/MM/YYYY`
- `parseDateBR(dateString: string): Date` - Parses a `DD/MM/YYYY` string into a Date object
- `formatDateISO(date: Date): string` - Converts a Date to ISO 8601 string for API payloads

**Why Centralize:**
- Date formatting was previously duplicated across multiple components using inline `toLocaleDateString` calls
- A single utility ensures all dates across the app use the same format and locale
- Makes future format changes (e.g., adding time) a single-file change

---

**BRL Currency Formatting Changes (across all components):**

The following components were updated to format monetary amounts using Brazilian Real (R$) with `pt-BR` locale formatting (commas as decimal separator, periods as thousands separator):

- `frontend/src/components/domain/ag/AgTransactionsGrid.tsx` - AG Grid `valueFormatter` updated
- `frontend/src/components/molecules/TransactionListItem.tsx` - Amount display updated
- `frontend/src/components/organisms/TransactionsGrid.tsx` - Grid amount formatting updated
- `frontend/src/features/accounts/components/AccountShareList.tsx` - Share amounts updated
- `frontend/src/features/accounts/components/AccountSummary.tsx` - Balance display updated
- `frontend/src/features/transactions/components/TransactionForm.tsx` - Currency default changed from "USD" to "BRL"
- `frontend/src/features/dashboard/components/IncomeVsExpenses.tsx` - Chart Y-axis and tooltip formatting
- `frontend/src/features/dashboard/components/RecentTransactionsWidget.tsx` - Amount and date columns
- `frontend/src/features/dashboard/pages/DashboardPage.tsx` - KPI card values
- `frontend/src/features/family/components/FamilySettings.tsx` - Budget-related displays

**DD/MM/YYYY Date Format Changes:**
- `frontend/src/components/molecules/DateRangePicker.tsx` - Input date format
- `frontend/src/features/transactions/components/TransactionForm.tsx` - Date picker format

---

### Infrastructure: Docker Consolidation

#### 🆕 **Dockerfile.devcontainer**
**Status:** NEW
**Purpose:** Unified development container Dockerfile replacing the two separate frontend and backend dev Dockerfiles.

**Key Changes:**
- Installs both Python and Node.js in a single image layer
- Supports running both `uvicorn` (backend) and `npm run dev` (frontend) from one container
- Reduces image build time by sharing base layer cache

---

#### 🆕 **.devcontainer/devcontainer.json**
**Status:** NEW
**Purpose:** Unified VS Code devcontainer configuration replacing the two separate backend and frontend devcontainers.

**Key Changes:**
- Single container definition using `Dockerfile.devcontainer`
- `forwardPorts` includes both 8000 (backend) and 5173 (frontend)
- VS Code extensions installed for both Python and TypeScript/React development

---

#### ❌ **Dockerfile.backend.dev / Dockerfile.frontend.dev**
**Status:** DELETED
**Purpose:** Replaced by unified `Dockerfile.devcontainer`.

---

#### ❌ **.devcontainer/backend/devcontainer.json / .devcontainer/frontend/devcontainer.json**
**Status:** DELETED
**Purpose:** Replaced by unified `.devcontainer/devcontainer.json`.

---

#### 🆕 **.env.production.example**
**Status:** NEW
**Purpose:** Template documenting all required environment variables for production deployment.

**Variables Documented:**
- `DATABASE_URL`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`
- `VITE_API_URL` for frontend
- Redis and Celery configuration for future background jobs

**Impact:** Simplifies production deployment by providing a clear reference for required configuration.

---

### Documentation & Configuration

#### 🆕 **docs/Inbox/** (7 new learning notes)
**Status:** NEW
**Purpose:** Reference notes added during development for technologies explored or planned:
- `Celery.md`, `Celery_Deep_Dive.md` - Celery task queue patterns for future background jobs
- `Redis.md`, `redis_deep_dive.md`, `redis_quick_reference.md` - Redis patterns for Celery broker
- `Recharts.md` - Recharts API patterns used in dashboard implementation
- `Quick fixes.md` - Common quick reference items

**Impact:** Builds team knowledge base; supports future sprint work (Celery/Redis needed for budget alerts and CSV imports).

---

#### 🆕 **docs/active_context/sprint_8.md**
**Status:** NEW
**Purpose:** Next sprint planning document establishing the roadmap for Sprint 8.

---

#### ✏️ **docs/knowledge/glossary/state-management.md**
**Status:** MODIFIED

**Key Changes:**
- Added notes on React Query mutation patterns observed in budgets feature
- Documented `queryClient.invalidateQueries` strategies
- Added on-read calculation pattern notes

---

#### ✏️ **docs/openAPI_spec.json**
**Status:** MODIFIED (large diff)
**Purpose:** OpenAPI 3.0 specification for all backend endpoints.

**Key Changes:**
- Added full endpoint definitions for all five budget endpoints
- Added `BudgetCreate`, `BudgetRead`, `BudgetUpdate` schema definitions
- Added `BudgetCategory` schema
- Updated server info

**Impact:** Keeps API documentation in sync with implementation; enables API client tooling.

---

#### ✏️ **frontend/vitest.config.ts**
**Status:** MODIFIED

**Key Changes:**
- Extended global test timeout from 5 seconds to 10 seconds

**Why:** Integration tests that simulate multi-step user workflows (open modal, fill form, submit, wait for re-render) require more time than unit tests. The 5s default caused intermittent failures on slower CI machines.

---

#### ✏️ **frontend/src/test/utils.tsx**
**Status:** MODIFIED

**Key Changes:**
- `QueryClient` in the render wrapper now created via `useState(() => new QueryClient(...))` instead of `const queryClient = new QueryClient(...)`

**Why:** Creating `QueryClient` directly in the render function body caused it to be recreated on every re-render of the wrapper, dropping the cache mid-test and causing components to re-fetch unnecessarily, which led to flaky test behavior. Using `useState` guarantees the client is created once per test.

---

## Testing Strategy

> [!info] Testing Approaches
> For comprehensive testing guidance:
> - [[../knowledge/glossary/testing|Testing & Test Patterns]] - Vitest, pytest, MSW, and integration testing
> - [[../knowledge/glossary/development-workflow|Development Workflow]] - Running tests and CI/CD

### Backend Testing (pytest + in-memory SQLite)

**New Test Infrastructure:**
- `conftest.py` (516 lines) provides comprehensive, reusable fixtures for all backend tests
- In-memory SQLite database ensures tests run fast and in isolation
- `authorization_header()` helper eliminates repetitive token setup in every test

**Budget Test Coverage (2,518 lines):**
- CRUD: create, read (list + single), update (partial), delete
- Spent calculation: multi-category aggregation, universal budgets, historical months, currency filtering
- Tenant isolation: cross-tenant access prevention, category tenant validation, join table tenant validation
- Authorization: OWNER-only mutations, MEMBER/VIEWER read access
- Validation: negative amounts, empty names, non-existent categories, duplicate categories, tenant mismatches
- CASCADE behavior: category deletion removes join table rows but preserves budget

**Running Backend Tests:**
```bash
cd backend/api
TEST_MODE=1 pytest tests/ -v
```

### Frontend Testing (Vitest + React Testing Library + MSW)

**Test Infrastructure Improvements:**
- `QueryClient` stabilized with `useState` in render wrapper (eliminates flaky re-fetch behavior)
- MSW transaction handler query param keys corrected to match actual request format
- Budget MSW handlers (287 lines) added with full CRUD in-memory simulation including spent calculation
- All stores reset in `beforeEach` via exported reset functions for test isolation

**Dashboard Tests (16 tests, `dashboard.integration.test.tsx`):**
- Renders all three KPI cards with correct aggregated values
- Date range toggle correctly changes data displayed
- Charts render with data from MSW mocked transactions
- Loading, error, and empty states all covered
- QuickActions navigation tested via React Router mock

**Budget Tests (749 lines across 2 files):**
- `BudgetsPage.test.tsx` (451 lines): full CRUD workflow integration tests
- `BudgetForm.test.tsx` (298 lines): form validation, multi-select, dual create/edit mode

**Running Frontend Tests:**
```bash
cd frontend
npm run test:run       # Run all tests once
npm run test:coverage  # Run with coverage report
```

---

## Migration Notes

### Database Migration

**Migration file:** `backend/api/alembic/versions/a1b2c3d4e5f6_add_budget_and_budget_category_tables.py`

**Apply the migration:**
```bash
cd backend/api
alembic upgrade head
```

**Rollback if needed:**
```bash
alembic downgrade -1
```

**Schema changes:**
- Creates `budget` table (id, tenant_id, name, amount, currency, timestamps)
- Creates `budget_category` join table (id, tenant_id, budget_id, category_id, added_at)
- Adds unique constraint on `(budget_id, category_id)`
- Adds indexes on `tenant_id` for query performance

**Breaking changes:** None. Budgets is a new feature. All existing tables unchanged.

---

### Frontend Breaking Changes

None. All changes are additive:
- New routes added (`/dashboard`, `/budgets`); existing routes unchanged
- Currency formatting is cosmetic (no API contract changes)
- Date format changes are display-only
- WelcomePage removed but its route `/app/:familyId/` now redirects to `/app/:familyId/dashboard`

---

### Environment Variables

No new environment variables required for this release.

Existing variables remain unchanged:
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT signing key
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Access token lifetime
- `REFRESH_TOKEN_EXPIRE_DAYS` - Refresh token lifetime
- `TEST_MODE` - Set to `1` in test environments for refresh token responses
- `VITE_API_URL` - Backend API base URL (frontend)

---

### Devcontainer Change (Developer Workstations)

If you currently use the separate backend or frontend devcontainers, you must switch to the unified devcontainer:

1. Close any active devcontainer sessions
2. Delete or archive `.devcontainer/backend/` and `.devcontainer/frontend/` (already removed from the repository)
3. Reopen the repository in the new unified devcontainer at `.devcontainer/devcontainer.json`

---

### Technical Debt Note

The file `remoteContainers-2026-02-10T18-03-54.211Z.log` was accidentally committed during development. It is a 23,000+ line VS Code Remote Containers log file with no value to the repository. It should be removed in a follow-up commit:

```bash
git rm remoteContainers-2026-02-10T18-03-54.211Z.log
git commit -m "remove accidentally committed log file"
```

---

## Performance Impact

### Backend Performance

**Budget Spent Calculation:**
- On-read aggregation per budget request: O(categories × transactions)
- For MVP scale (fewer than 10 budgets, fewer than 1,000 transactions per month), response times are acceptable (~50-100ms for list endpoint in local testing)
- Future optimization: add composite index on `(tenant_id, transaction_date, currency, transaction_type)` and consider caching spent values

### Frontend Performance

**New Recharts Bundle Size:**
- Recharts library adds approximately 85KB (minified, gzipped) to the frontend bundle
- Dashboard is a route-level component; future code-splitting could lazy-load charts on demand

**Dashboard Client-Side Aggregation:**
- `useDashboardSummary` runs aggregation in a `useMemo` block, so re-computation only occurs when the underlying transaction data changes
- For 500-1,000 transactions this is negligible; beyond 5,000 transactions, consider moving aggregation to a backend endpoint

**Test Suite Duration:**
- Backend: approximately 10-15 seconds (2,518 lines, 50+ test cases with SQLite setup/teardown)
- Frontend: approximately 8-12 seconds (total test suite with extended 10s timeout)
- Total test suite: approximately 20-30 seconds (acceptable for pre-commit and CI)

---

## Known Limitations

1. **Currency support is BRL-only on the frontend.** The backend supports any ISO 4217 currency code, but the UI does not expose a currency selector. Future: add currency dropdown to transaction and budget forms.

2. **Dashboard month/year selection is fixed to the selected preset.** Users cannot navigate to arbitrary historical months on the dashboard. Future: add month picker component.

3. **Budgets show current month only.** The month/year query params are supported by the backend but the frontend always requests the current month. Future: add month/year navigator to BudgetsPage.

4. **No budget alert notifications.** There is no automated notification when a budget reaches 80% or 100% of its limit. Future: Celery background job checking budget thresholds, with in-app badge display.

5. **Category deletion silently removes budget associations.** No warning is shown to the user when deleting a category that is assigned to budgets. Future: add confirmation dialog listing affected budgets.

6. **Accidentally committed log file in repository history.** `remoteContainers-2026-02-10T18-03-54.211Z.log` adds approximately 23,000 lines to the repository and should be removed. See Technical Debt Note above.

---

## Next Steps / Follow-up Work

### Immediate (Sprint 8 Candidates)

1. **Remove Accidentally Committed Log File (Immediate):**
   - `git rm remoteContainers-2026-02-10T18-03-54.211Z.log && git commit -m "remove accidentally committed log file"`

2. **Budget Alerts (High Priority):**
   - Celery background job checking budget thresholds (80%, 100%, 120%)
   - Alert model storing notifications per tenant
   - Badge or banner on BudgetsPage showing over-budget count
   - Optional: email notification via Celery

3. **Month/Year Navigator for Budgets (Medium Priority):**
   - MUI month picker component for BudgetsPage
   - Pass selected month/year as query params to `useBudgets` hook
   - Chart widget showing budget performance over historical months

4. **Currency Picker (Medium Priority):**
   - USD, EUR, GBP options added to BudgetForm and TransactionForm dropdowns
   - Dynamic currency symbol display based on selected currency
   - Utility function mapping ISO code to symbol and locale

### Future Enhancements

5. **CSV Transaction Import:**
   - Import flow roadmap documented in `docs/roadmap/import_flow.md`
   - Celery background job for parsing and validating CSV files
   - Frontend upload UI with progress indicator and error reporting

6. **Budget Performance Analytics:**
   - Chart comparing planned vs. actual spending per category over time
   - Trend analysis: month-over-month budget performance
   - Budget recommendation engine based on historical patterns

7. **Recurring Budgets:**
   - Template budgets that auto-create at the start of each month
   - Budget rollover: carry unused amounts to the following month

8. **Dashboard Backend Aggregation Endpoint:**
   - As transaction volume grows, move `useDashboardSummary` aggregation to a dedicated `/dashboard/summary` endpoint
   - Return pre-aggregated KPIs and chart data rather than raw transactions

### Technical Debt

9. **E2E Test Coverage:**
   - Add Playwright tests for full user workflows (login → dashboard → create budget → verify spent)
   - Add visual regression tests for progress bars and chart renders

10. **Performance Indexing:**
    - Add composite database index on `(tenant_id, transaction_date, currency, transaction_type)` for budget spent queries
    - Benchmark with 10,000+ transactions to identify thresholds

11. **Storybook Stories:**
    - Add stories for `OverviewCard`, `BudgetsList`, `BudgetForm`, `DeleteBudgetConfirm`
    - Add story for responsive SideNav showing both persistent and temporary variants

---

## Related Documentation

> [!info] Learning Resources
> For comprehensive background on technologies and patterns used across these sprints:

### Architecture & Technology Patterns
- [[../knowledge/glossary/state-management|State Management]] - React Query caching, mutations, invalidation, and client-side aggregation
- [[../knowledge/glossary/api-communication|API Communication]] - REST API patterns, apiFetch wrapper, endpoint organization
- [[../knowledge/glossary/authentication-security|Authentication & Security]] - Multi-tenant isolation, JWT tokens, role-based authorization
- [[../knowledge/glossary/project-structure-concepts|Project Structure Concepts]] - Feature module organization, backend router architecture
- [[../knowledge/glossary/routing-navigation|Routing & Navigation]] - React Router patterns, family-scoped routes, protected routes

### Frontend Implementation Patterns
- [[../knowledge/glossary/react-patterns-hooks|React Patterns & Hooks]] - Custom hooks, useMemo, composition, React Hook Form
- [[../knowledge/glossary/ui-components-design|UI Components & Design]] - MUI Drawer variants, AG Grid, Recharts, responsive design
- [[../knowledge/glossary/typescript|TypeScript]] - Type safety, interfaces, Pydantic-matched types
- [[../knowledge/glossary/frontend-build-configuration|Frontend Build & Configuration]] - Vite bundler, devcontainer setup

### Development & Testing
- [[../knowledge/glossary/testing|Testing]] - Vitest, React Testing Library, pytest, MSW in-memory stores
- [[../knowledge/glossary/development-workflow|Development Workflow]] - Alembic migrations, Docker compose, running tests

### Project Planning & Vision
- [Sprint 5 Planning Document](../active_context/sprint_5.md) - Dashboard sprint goals and checklist
- [Sprint 7 Planning Document](../active_context/sprint_7.md) - Budgets sprint goals and checklist
- [Sprint 8 Planning Document](../active_context/sprint_8.md) - Next sprint goals
- [Frontend Roadmap](../active_context/frontend_roadmap.md) - Overall sprint structure
- [North Star Document](../north_star.md) - Multi-tenant invariants and domain model requirements
- [System Architecture](../SystemArchitecture.md) - Complete system architecture overview
- [OpenAPI Specification](../openAPI_spec.json) - All endpoint and schema definitions
- [Import Flow Roadmap](../roadmap/import_flow.md) - CSV import feature planning

### Individual Sprint PR Documents
- [Sprint 5 Dashboard Release](Sprint_5_Dashboard_Release.md)
- [Sprint 7 Budgets Release](Sprint_7_Release.md)
- [Mobile-Ready Release](Mobile_Ready_Release.md)

---

## Summary Statistics

**Total Changes:**
- **98 files changed** (excluding `remoteContainers-2026-02-10T18-03-54.211Z.log`)
- **+14,000 meaningful lines added** (excluding log file)
- **-2,821 lines removed**

**Backend (Sprint 7 Budgets):**
- 1 Alembic migration (budget + budget_category tables)
- 573 lines of endpoint logic (budgets router)
- 2,518 lines of tests (comprehensive CRUD, isolation, authorization)
- 516 lines of test infrastructure (conftest.py fixtures)
- 434 lines of seed script

**Frontend (Sprint 5 Dashboard):**
- 6 new dashboard components (DashboardPage, OverviewCard, SpendingByCategory, IncomeVsExpenses, RecentTransactionsWidget, QuickActions)
- 1 new hook (useDashboardSummary with client-side aggregation)
- 16 integration tests in dashboard.integration.test.tsx
- Recharts v3.7.0 added as dependency

**Frontend (Sprint 7 Budgets):**
- 1,588 lines of feature code (budgets module: types, API, hooks, components, pages)
- 749 lines of tests (BudgetsPage + BudgetForm integration tests)
- 287 lines of MSW handlers (in-memory store)

**Mobile-Ready & Localization:**
- 4 core layout components updated (AppShell, SideNav, TopNav, FamilySwitcherMini)
- 39 lines of new dateUtils.ts
- 10+ components updated for BRL currency and DD/MM/YYYY date format

**Infrastructure:**
- 1 unified Dockerfile.devcontainer replacing 2 separate dev Dockerfiles
- 1 unified devcontainer.json replacing 2 separate configs
- Production environment example template added

**Test Coverage:**
- Backend: 50+ test cases covering CRUD, tenant isolation, authorization, currency filtering
- Frontend: 46+ test cases covering dashboard workflows, budget CRUD workflows, form validation
- Total new test lines: approximately 3,800

**Commits (development branch):**
- 14 commits from master to development across three sprint areas
- Key: "Sprint 7 completed by Claude", "# Mobile-Ready: Responsive Layout & UI Polish", "production images", "Currency changed to BRL (R$)", "DB Seed script + date format fix"

---

**Ready for Review**
All sprint goals achieved. Database migration required on deploy. No breaking changes to existing features. Accidentally committed log file should be cleaned up post-merge.
