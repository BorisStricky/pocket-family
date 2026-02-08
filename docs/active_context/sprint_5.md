# Sprint 5: Dashboard (1 week)

## Goal
Dashboard shows meaningful KPIs, charts, and recent activity using real transaction, account, and category data from previous sprints. Users get overview of financial health.

## Success Criteria
- [x] Dashboard shows key metrics (total expenses, income, balance)
- [x] Charts display spending by category, trends over time
- [x] Recent transactions widget shows transactions from date range
- [x] Quick actions (Add Transaction, View Accounts, Settings)
- [x] Data updates when navigating from other pages

---

## Components Checklist

### Dashboard Hooks

| Done | Hook | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [x] | useDashboardSummary | `src/features/dashboard/hooks/useDashboardSummary.ts` | Fetch summary metrics | • Client-side aggregation from transactions, accounts, categories<br>• Returns: total expenses, income, balance, spending by category, income vs expenses trend |

### API Functions (if backend provides aggregations)

| Done | Function | File Path | Method | Endpoint | Request | Response | Notes |
|------|----------|-----------|--------|----------|---------|----------|-------|
| N/A | getDashboardSummary | N/A | N/A | N/A | N/A | N/A | No backend endpoint - using client-side aggregation |

**Note:** Backend does not provide dashboard aggregation endpoint. All metrics computed client-side using `useTransactions`, `useAccounts`, and `useCategories` hooks.

### UI Components (Organisms)

| Done | Component                | File Path                                                        | Props                              | Story                         | Notes                                                                                                              |
| ---- | ------------------------ | ---------------------------------------------------------------- | ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [x]  | OverviewCard             | `src/components/ui/organisms/OverviewCard.tsx`                   | `title, value, delta?, icon?`      | `Organisms/OverviewCard`      | • KPI card showing metric<br>• Delta (up/down indicator)<br>• Icon (optional)<br>• 8 tests passing                                      |
| N/A  | MiniChart                | N/A                      | N/A | N/A         | • NOT created as separate component<br>• Charts embedded directly in SpendingByCategory and IncomeVsExpenses using Recharts                                                                          |
| [x]  | RecentTransactionsWidget | `src/features/dashboard/components/RecentTransactionsWidget.tsx` | `familyId, dateRange?`             | `Features/RecentTransactions` | • Shows transactions from specified date range<br>• Click → navigate to transactions page<br>• Uses AG Grid |

### Feature Components (Dashboard)

| Done | Component          | File Path                                                  | Props                  | Used In   | Notes                                                                           |
| ---- | ------------------ | ---------------------------------------------------------- | ---------------------- | --------- | ------------------------------------------------------------------------------- |
| [x]  | SpendingByCategory | `src/features/dashboard/components/SpendingByCategory.tsx` | `familyId, dateRange` | Dashboard | • Pie chart<br>• Group expenses by category<br>• Uses Recharts PieChart            |
| [x]  | IncomeVsExpenses   | `src/features/dashboard/components/IncomeVsExpenses.tsx`   | `familyId, dateRange` | Dashboard | • Line chart<br>• Compare income vs expenses over time<br>• Uses Recharts LineChart |
| [x]  | QuickActions       | `src/features/dashboard/components/QuickActions.tsx`       | -                      | Dashboard | • Button grid with icons<br>• Add Transaction, View Accounts, Settings navigation                    |

### Pages

| Done | Page | File Path | Route | Protected | Dependencies | Notes |
|------|------|-----------|-------|-----------|--------------|-------|
| [x] | DashboardPage | `src/features/dashboard/pages/DashboardPage.tsx` | `/app/:familyId/dashboard` | Yes | OverviewCard, SpendingByCategory, IncomeVsExpenses, RecentTransactionsWidget, QuickActions | Main dashboard landing with 3 KPI cards, 2 charts, recent transactions, and quick actions |

### Testing

| Done | Test | File Path | Purpose | Notes |
|------|------|-----------|---------|-------|
| [x] | DashboardPage tests | `src/features/dashboard/__tests__/DashboardPage.test.tsx` | Test rendering | 8 tests passing - mocks hooks, tests cards render, charts render, loading/error states |
| [x] | OverviewCard tests | `src/components/ui/organisms/__tests__/OverviewCard.test.tsx` | Test card display | 8 tests passing - tests delta indicators, icons, formatting |

---

## Implementation Steps (Sprint 5)

### Step 1: Install Recharts
- [x] Add Recharts dependency
- [x] Import Recharts components

### Step 2: Dashboard API & Hooks
- [x] Checked backend - no `/dashboard/summary` endpoint
- [x] Implemented client-side aggregation using existing hooks
- [x] Created `useDashboardSummary` hook at `src/features/dashboard/hooks/useDashboardSummary.ts`

### Step 3: Overview Cards
- [x] Built `OverviewCard` component at `src/components/ui/organisms/OverviewCard.tsx`
- [x] Display key metrics: Total Expenses, Total Income, Net Balance
- [x] Added delta indicators (up/down arrows with percentage)

### Step 4: Charts
- [x] Built `SpendingByCategory` pie chart at `src/features/dashboard/components/SpendingByCategory.tsx`
- [x] Fetch transactions, group by category using useDashboardSummary
- [x] Built `IncomeVsExpenses` line chart at `src/features/dashboard/components/IncomeVsExpenses.tsx`
- [x] Aggregate by day using useDashboardSummary

### Step 5: Recent Transactions Widget
- [x] Built `RecentTransactionsWidget` at `src/features/dashboard/components/RecentTransactionsWidget.tsx`
- [x] Fetch transactions from date range using `useTransactions`
- [x] Display in AG Grid
- [x] Add "View All" link → navigate to transactions page

### Step 6: Quick Actions
- [x] Built `QuickActions` component at `src/features/dashboard/components/QuickActions.tsx`
- [x] Added buttons: Add Transaction, View Accounts, Settings
- [x] Wired up navigation using React Router

### Step 7: Dashboard Page
- [x] Created `DashboardPage` layout at `src/features/dashboard/pages/DashboardPage.tsx`
- [x] Arranged overview cards in grid (3 columns on desktop, responsive)
- [x] Added charts below cards in 2-column grid
- [x] Added recent transactions widget
- [x] Added quick actions at top with date range selector

### Step 8: Testing & Polish
- [x] Tested dashboard with real data
- [x] Tested empty state (no transactions) - shows "No data" messages
- [x] Added loading states for all components
- [x] Route wired at /app/:familyId/dashboard
- [x] SideNav updated with Dashboard link
- [x] 16 tests passing (8 DashboardPage + 8 OverviewCard)

---

## API Endpoints Reference (Sprint 5)

**Option 1: Backend provides aggregations**
| Endpoint | Method | Request | Response | Notes |
|----------|--------|---------|----------|-------|
| `/dashboard/summary` | GET | Query: dateRange | Summary metrics | Custom endpoint (if implemented) |

**Option 2: Client-side aggregation**
- Use existing `GET /transactions` and `GET /accounts` endpoints
- Aggregate in frontend using JavaScript/lodash

---

## Notes & Assumptions

- **Date range:** Default to current month; allow switching (last 7 days, 30 days, year)
- **Performance:** If aggregating client-side, limit transactions fetched (e.g., last 1000)
- **Charts:** Use Recharts for simplicity (alternative: Chart.js, Nivo)
- **Mobile:** Make dashboard responsive (stack cards vertically on mobile)
- **Real-time updates:** Charts update when transactions added/edited (React Query cache invalidation)
