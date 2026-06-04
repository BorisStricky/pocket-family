# Finish the Reports feature (interactive monthly reports + shared MonthPicker)

## Context

The Reports feature is currently a routed stub (`frontend/src/features/reports/pages/ReportsPage.tsx` → `<UnderConstruction>`); the nav item and route already exist. This change ships the first ("light", in-scope) reporting service: an **interactive monthly report page** plus a reusable **month picker** used on both the Reports page and the Transactions page. A future, out-of-scope service will handle async PDF/AI reports — we leave a clean seam but build none of it now.

### Decisions
- **No new backend endpoint, no migration.** `GET /transactions?scope=tenant&tenant_id=&start=&end=` already returns each row enriched with `amount`, `currency`, `transaction_type`, `transaction_date`, `account_id`+`account_name`, `category_id`+`category_name`, `created_by`+`created_by_name` (`schemas.py` `TransactionRead`). We aggregate client-side, exactly like the existing dashboard (`features/dashboard/hooks/useDashboardSummary.ts`). Parent category (for the roll-up toggle) comes from the existing `GET /categories` (`parent_id`).
- **"Per user" = transaction creator** (`created_by_name`) — already on every row.
- **Cross-filtering is bidirectional**: clicking any category slice, day bar, user, or account filters all the *other* charts and the totals.
- **Single default currency** (no conversion): aggregate one currency at a time; default to the dominant currency in the month, with a small selector if several are present.
- **Month picker**: primary period control on Reports; on Transactions it becomes primary with the existing `DateRangePicker` demoted to a secondary "Custom range" toggle.
- Four charts: (a) daily expenses/incomes bar, (b) expenses-by-category pie with a subcategory roll-up toggle, (c) nested donut — outer ring by user (creator), inner ring by account, (d) KPI totals (income / expense / net).

## Work

### 1. Shared `MonthPicker` molecule — `frontend/src/components/molecules/MonthPicker.tsx`

A pure UI `< June 2026 >` control: prev/next `IconButton`s (`ChevronLeft`/`ChevronRight`) around a centered label. Follows `DateRangePicker` conventions in the same folder (MUI, local-timezone date handling, default + named export).

- Props: `{ year: number; month: number; onChange: (year: number, month: number) => void; minMonth?; maxMonth?; label?: string }` (month 1-indexed). `< >` decrement/increment with year roll-over.
- Co-locate and export small pure helpers so callers derive filter dates without duplicating logic:
  - `getMonthRange(year, month) => { startDate: string; endDate: string }` returning local-timezone `YYYY-MM-DD` for the 1st and last day (`new Date(year, month-1, 1)` / `new Date(year, month, 0)`, formatted like `DateRangePicker.tsx`'s `formatToISODate`).
  - `getCurrentYearMonth() => { year, month }`.
- Export from `frontend/src/components/molecules/index.ts`.

### 2. Transactions page integration — `frontend/src/features/transactions/pages/TransactionsPage.tsx`

- Replace the current "default to current month + always-visible `DateRangePicker`" wiring with a primary `MonthPicker` (default = current month) that drives `localStartDate/localEndDate` via `getMonthRange`, plus a "Custom range" toggle (MUI `Button`/`Collapse`) that reveals the existing `DateRangePicker` for arbitrary ranges.
- Keep the existing debounce + `filters` wiring and empty-state copy untouched — the pickers just set `localStartDate/localEndDate`.

### 3. Reports feature build-out — `frontend/src/features/reports/`

Flat feature structure (`hooks/`, `components/`, `pages/`, `types.ts`).

**`hooks/useMonthlyReport.ts`** — modeled on `useDashboardSummary.ts`:
- Inputs: `familyId`, `{ year, month }`, `reportCurrency`, `rollUpSubcategories`, active cross-filter `selection`.
- Fetches `useTransactions(familyId, getMonthRange(...))`, `useCategories(familyId)`, `useAccounts(familyId)`.
- Builds a `categoryId → parentId/parentName` map for the roll-up toggle (on → attribute to top-level parent; off → leaf category).
- Determines available currencies + dominant default; filters rows to `reportCurrency`.
- Computes with `useMemo`: totals (income/expense/net/count), `byCategory`, `byDay`, `byUser` (creator), `byAccount`.
- **Cross-filter rule**: `type ReportSelection = { dimension: 'category'|'account'|'user'|'day'; value: string; label: string } | null`. Daily/donut/totals aggregations run over transactions filtered by the active selection; the chart owning the selected dimension aggregates over the *unfiltered* set (other slices stay selectable) and highlights the active element.

**`components/`** (flat, props interfaces, no `any`, reuse Recharts patterns from `features/dashboard/components/`):
- `ReportTotals.tsx` — KPI cards (income, expense, net).
- `DailyAmountsBarChart.tsx` — Recharts `BarChart` (income + expense per day); bar click → `day` selection.
- `CategoryPieChart.tsx` — Recharts `PieChart` like `SpendingByCategory.tsx` + roll-up toggle (`Switch`/`ToggleButton`); slice click → `category` selection.
- `UserAccountDonut.tsx` — one `PieChart` with two `Pie`s: inner ring by account, outer ring by user (creator); both rings sum to the same total. Slice clicks → `account`/`user` selections.
- Active-filter `Chip` (inline or `ActiveFilterChip.tsx`) — dismissible, clears the selection.

**`pages/ReportsPage.tsx`** — replace the stub: header with `MonthPicker` (default current month) + currency `Select` (only when >1 currency present) + active-filter chip; grid of the four chart components; loading/error/empty states (mirror `DashboardPage`). Keep `pages/index.ts` export.

### 4. Tests (frontend, integration-first per `frontend/CLAUDE.md`)

In `frontend/src/__tests__/`, using `renderWithProviders`, `setupAuthenticatedUser`, MSW stores, semantic queries:
- `ReportsPage.integration.test.tsx`: charts/totals render for a month; month prev/next changes the period; clicking a category slice cross-filters totals/daily; roll-up toggle changes grouping; currency selector appears only with multiple currencies.
- Transactions page test: month picker prev/next updates the list; "Custom range" reveals the `DateRangePicker`.
- Pure `getMonthRange` unit test if warranted.

## Out of scope (future)
Async PDF generation, month-over-month comparison, AI analysis, server-side aggregation endpoint. No backend code or migration in this change.

## Verification
- `cd frontend && npm run build` (no TS errors) and `npm test` pass.
- `npm run dev`, log into a family with transactions:
  - **Reports** (`/app/:familyId/reports`): four charts render for the current month; `< >` moves months; clicking a category slice re-filters daily bar, donut, totals and shows an active-filter chip; clearing restores; roll-up toggle merges subcategories into parents; currency selector shows only with multiple currencies.
  - **Transactions**: month picker drives the list; "Custom range" reveals the date-range picker and arbitrary ranges still work.
- No backend changes — no backend test run required.
