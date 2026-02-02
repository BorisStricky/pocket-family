# Sprint 5: Dashboard (1 week)

## Goal
Dashboard shows meaningful KPIs, charts, and recent activity using real transaction, account, and category data from previous sprints. Users get overview of financial health.

## Success Criteria
- [ ] Dashboard shows key metrics (total expenses, income, balance)
- [ ] Charts display spending by category, trends over time
- [ ] Recent transactions widget shows last 5-10 transactions
- [ ] Quick actions (Add Transaction, View Reports)
- [ ] Data updates when navigating from other pages

---

## Components Checklist

### Dashboard Hooks

| Done | Hook | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | useDashboardSummary | `src/features/dashboard/hooks/useDashboardSummary.ts` | Fetch summary metrics | • Query key: `['dashboard', familyId, dateRange]`<br>• Call custom endpoint or aggregate client-side<br>• Returns: total expenses, income, balance, etc. |

### API Functions (if backend provides aggregations)

| Done | Function | File Path | Method | Endpoint | Request | Response | Notes |
|------|----------|-----------|--------|----------|---------|----------|-------|
| [ ] | getDashboardSummary | `src/features/dashboard/api/dashboardApi.ts` | GET | `/dashboard/summary` | Query params: dateRange | Summary object | Custom endpoint (check if exists in backend) |

**Note:** If no backend aggregation endpoint, compute client-side from `useTransactions` and `useAccounts`.

### UI Components (Organisms)

| Done | Component | File Path | Props | Story | Notes |
|------|-----------|-----------|-------|-------|-------|
| [ ] | OverviewCard | `src/components/ui/organisms/OverviewCard.tsx` | `title, value, delta?, icon?` | `Organisms/OverviewCard` | • KPI card showing metric<br>• Delta (up/down indicator)<br>• Icon (optional) |
| [ ] | MiniChart | `src/components/ui/organisms/MiniChart.tsx` | `data, type: 'line'\|'bar'\|'pie'` | `Organisms/MiniChart` | • Small chart for cards<br>• Use Recharts |
| [ ] | RecentTransactionsWidget | `src/features/dashboard/components/RecentTransactionsWidget.tsx` | `familyId, limit?` | `Features/RecentTransactions` | • Shows last N transactions<br>• Click → navigate to transactions page<br>• Reuse AG Grid or simple list |

### Feature Components (Dashboard)

| Done | Component | File Path | Props | Used In | Notes |
|------|-----------|-----------|-------|---------|-------|
| [ ] | SpendingByCategory | `src/features/dashboard/components/SpendingByCategory.tsx` | `familyId, dateRange?` | Dashboard | • Pie or bar chart<br>• Group expenses by category<br>• Use Recharts |
| [ ] | IncomeVsExpenses | `src/features/dashboard/components/IncomeVsExpenses.tsx` | `familyId, dateRange?` | Dashboard | • Line or bar chart<br>• Compare income vs expenses over time<br>• Use Recharts |
| [ ] | QuickActions | `src/features/dashboard/components/QuickActions.tsx` | - | Dashboard | • Button grid<br>• Add Transaction, View Reports, Import CSV |

### Pages

| Done | Page | File Path | Route | Protected | Dependencies | Notes |
|------|------|-----------|-------|-----------|--------------|-------|
| [ ] | DashboardPage | `src/features/dashboard/pages/DashboardPage.tsx` | `/app/:familyId/dashboard` | Yes | OverviewCard, Charts, RecentTransactions | Main dashboard landing |

### Testing

| Done | Test | File Path | Purpose | Notes |
|------|------|-----------|---------|-------|
| [ ] | DashboardPage tests | `src/features/dashboard/__tests__/DashboardPage.test.tsx` | Test rendering | Mock hooks, test cards render |
| [ ] | OverviewCard tests | `src/components/ui/organisms/__tests__/OverviewCard.test.tsx` | Test card display | Test delta indicators |

---

## Implementation Steps (Sprint 5)

### Step 1: Install Recharts
- [ ] Add Recharts dependency
- [ ] Import Recharts styles if needed

### Step 2: Dashboard API & Hooks
- [ ] Check if backend has `/dashboard/summary` endpoint
- [ ] If not, implement client-side aggregation using existing hooks
- [ ] Create `useDashboardSummary` hook

### Step 3: Overview Cards
- [ ] Build `OverviewCard` component
- [ ] Display key metrics: Total Expenses, Total Income, Net Balance
- [ ] Add delta indicators (% change from previous period)

### Step 4: Charts
- [ ] Build `SpendingByCategory` chart (pie or bar)
- [ ] Fetch transactions, group by category
- [ ] Build `IncomeVsExpenses` chart (line or bar)
- [ ] Aggregate by date (daily, weekly, monthly)

### Step 5: Recent Transactions Widget
- [ ] Build `RecentTransactionsWidget`
- [ ] Fetch last 5-10 transactions using `useTransactions` with limit
- [ ] Display in simple list or mini AG Grid
- [ ] Add "View All" link → navigate to transactions page

### Step 6: Quick Actions
- [ ] Build `QuickActions` component
- [ ] Add buttons: Add Transaction, View Reports, Import CSV
- [ ] Wire up navigation

### Step 7: Dashboard Page
- [ ] Create `DashboardPage` layout
- [ ] Arrange overview cards in grid (2-3 columns)
- [ ] Add charts below cards
- [ ] Add recent transactions widget
- [ ] Add quick actions at top or sidebar

### Step 8: Testing & Polish
- [ ] Test dashboard with real data
- [ ] Test empty state (no transactions)
- [ ] Add loading states for charts
- [ ] Optimize performance (memoization, lazy loading)

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
