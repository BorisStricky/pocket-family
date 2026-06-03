# Monthly Reports Feature

**Branch:** `feature/monthly-reports` → `development`
**Last Updated:** 2026-06-03

## Overview

This change ships the first reporting service for Pocket Family: an interactive monthly report page that lets users visualise income and expenses for any calendar month across four linked charts (category pie, daily bar, user/account donut, and KPI totals) with bidirectional cross-filter interaction. It also introduces a shared `MonthPicker` molecule that replaces the always-visible `DateRangePicker` as the primary period control on the Transactions page.

No backend endpoint or database migration is required: the existing `GET /transactions` response already carries every enriched field (`account_name`, `category_name`, `created_by_name`), and `GET /categories` supplies the parent hierarchy for the subcategory roll-up toggle. All aggregation happens client-side via `useMemo`, following the same pattern as `useDashboardSummary`.

## Goals Achieved

- Shared `MonthPicker` molecule usable anywhere a calendar-month period selector is needed
- `getMonthRange` / `getCurrentYearMonth` helpers eliminate duplicated month-boundary arithmetic
- `useMonthlyReport` hook aggregates one month's transactions into chart-ready shapes with cross-filter support
- Four chart components (Category Pie, Daily Bar, User/Account Donut, KPI Totals) replace the `UnderConstruction` stub on the Reports page
- Bidirectional cross-filter: clicking any chart slice re-filters all other charts instantly (no re-fetch)
- Subcategory roll-up toggle attributes leaf-category spending to its top-level parent
- Currency selector appears only when multiple currencies are present in a month
- Transactions page: month picker is now the primary control; DateRangePicker demoted to a collapsible "Custom range" toggle
- 213 lines of integration tests for ReportsPage, updated Transactions page tests, and unit tests for `getMonthRange`

## Directory Structure

```
frontend/src/
  components/
    molecules/
      MonthPicker.tsx               (NEW) MonthPicker component + getMonthRange + getCurrentYearMonth
      index.ts                      (MODIFIED) exports MonthPicker and helpers
  features/
    reports/
      types.ts                      (NEW) ReportDimension, ReportSelection, ReportSlice, DailyAmount, MonthlyReportData
      utils.ts                      (NEW) CHART_COLORS palette, formatReportAmount
      hooks/
        useMonthlyReport.ts         (NEW) client-side monthly aggregation hook
      components/
        CategoryPieChart.tsx        (NEW) expense pie chart with roll-up toggle + cross-filter
        DailyAmountsBarChart.tsx    (NEW) grouped income/expense bar chart + cross-filter
        ReportTotals.tsx            (NEW) KPI cards (income, expense, net)
        UserAccountDonut.tsx        (NEW) nested donut: inner=accounts, outer=users + cross-filter
      pages/
        ReportsPage.tsx             (MODIFIED) replaced UnderConstruction stub with full page
    transactions/
      pages/
        TransactionsPage.tsx        (MODIFIED) MonthPicker as primary filter, DateRangePicker in Collapse
  lib/
    __tests__/
      monthRange.test.ts            (NEW) unit tests for getMonthRange + getCurrentYearMonth
  __tests__/
    reports.integration.test.tsx    (NEW) ReportsPage integration tests
    transactions.integration.test.tsx (MODIFIED) updated for MonthPicker + Custom range toggle
docs/
  feature-report-plan.md            (NEW) feature planning document
```

## Files Changed - Detailed Breakdown

### New Files

#### `frontend/src/components/molecules/MonthPicker.tsx`

**Purpose**: Reusable `< June 2026 >` navigation control for stepping through calendar months one at a time.

**Key Features**:
- Props: `year`, `month` (1-indexed), `onChange`, optional `minMonth` / `maxMonth` boundary guards, optional `label`
- Year rolls over at December/January boundary automatically
- Exports `getMonthRange(year, month) => { startDate, endDate }` using local-timezone `Date` construction (avoids UTC-shift present in `.toISOString()`)
- Exports `getCurrentYearMonth() => { year, month }` for default initial state
- MUI `IconButton` (ChevronLeft / ChevronRight) around a `Typography` label; accessible `aria-label` on each arrow

**Integration**:
- Used on `ReportsPage` and `TransactionsPage`
- `getMonthRange` is also imported by `useMonthlyReport` to derive the transactions API query bounds

---

#### `frontend/src/features/reports/types.ts`

**Purpose**: TypeScript types for the Reports feature's aggregated data shapes.

**Key Exports**:
- `ReportDimension` — `'category' | 'account' | 'user' | 'day'`
- `ReportSelection` — active cross-filter: `{ dimension, value, label }`
- `ReportSlice` — one pie/donut segment: `{ id, label, total }`
- `DailyAmount` — one day's totals: `{ date, income, expenses }`
- `MonthlyReportData` — full aggregated month: totals, `byCategory`, `byDay`, `byUser`, `byAccount`, `availableCurrencies`, `currency`

---

#### `frontend/src/features/reports/utils.ts`

**Purpose**: Shared presentation helpers for the Reports charts.

**Key Exports**:
- `CHART_COLORS` — ten-color palette (mirrors dashboard palette)
- `formatReportAmount(value, currency)` — `Intl.NumberFormat` currency formatting with graceful fallback on unknown currency codes

---

#### `frontend/src/features/reports/hooks/useMonthlyReport.ts`

**Purpose**: Aggregate one month of transactions and categories into chart-ready data, applying cross-filter and currency/roll-up options.

**Key Features**:
- Inputs: `familyId`, `year`, `month`, optional `reportCurrency`, `rollUpSubcategories` toggle, active `selection`
- Fetches `useTransactions` with `getMonthRange`-derived bounds, plus `useCategories` for parent hierarchy
- Builds `parentIdByCategory` and `nameByCategory` lookup maps so `resolveCategory` stays O(1) per transaction
- Determines dominant currency from frequency counts; caller can override via `reportCurrency`
- `includeForChart(transaction, selection, chartDimension, effectiveCategoryId)` — cross-filter rule: a chart ignores the selection on its own dimension so other slices remain visible and selectable
- Income is intentionally excluded from `'category'` cross-filter (income rows carry no expense category, so applying the filter would zero out Total Income)
- Subcategory roll-up walks the full `parent_id` chain (not just one level) with a `Set` guard against cycles
- All floating-point accumulation rounded to cents via `roundCents`

**Integration**:
- Called by `ReportsPage` with lifted state for `selection`, `rollUpSubcategories`, and `reportCurrency`
- Returns `{ report: MonthlyReportData | null, isLoading, error }`

---

#### `frontend/src/features/reports/components/CategoryPieChart.tsx`

**Purpose**: Recharts `PieChart` of expenses by (effective) category with a roll-up `Switch` toggle.

**Key Features**:
- Slice click toggles a `'category'` `ReportSelection`; re-clicking the same slice clears the filter
- Non-selected slices dimmed to `opacity: 0.3` once a slice is selected
- Roll-up toggle (`FormControlLabel` + `Switch`) lifted to page state so the aggregation hook re-runs
- Legend hidden on mobile (`useMediaQuery`) to save vertical space

---

#### `frontend/src/features/reports/components/DailyAmountsBarChart.tsx`

**Purpose**: Recharts `BarChart` with grouped income (green) and expense (red) bars for each day of the month.

**Key Features**:
- Chart-level `onClick` extracts the clicked day from `activePayload[0].payload.date`
- Non-selected days rendered in `#CFD8DC` muted grey once a day is selected
- X-axis shows day-of-month (DD) extracted from ISO date to keep labels short

---

#### `frontend/src/features/reports/components/ReportTotals.tsx`

**Purpose**: Three KPI cards — Total Income, Total Expenses, Net — reflecting the active cross-filter.

**Key Features**:
- Net card is coloured green when positive, red when negative
- Uses `formatReportAmount` for locale-sensitive currency display

---

#### `frontend/src/features/reports/components/UserAccountDonut.tsx`

**Purpose**: Nested Recharts `PieChart` with two `Pie` rings: inner = by account, outer = by user (transaction creator). Both rings sum to the same total.

**Key Features**:
- Inner ring triggers `'account'` selection; outer ring triggers `'user'` selection
- Outer ring palette offset by 3 positions so the two rings read as visually distinct

---

#### `frontend/src/features/reports/pages/ReportsPage.tsx` (modified)

**Purpose**: Replaced the `UnderConstruction` stub with the full interactive monthly report page.

**Key Features**:
- Header: `MonthPicker` (default = current month) + currency `Select` (visible only when multiple currencies are present) + dismissible `Chip` showing the active cross-filter
- Changing the month clears the active selection and currency override so the new month starts fresh
- Two-column grid (category pie + user/account donut), full-width daily bar chart below
- Loading spinner, error `Alert`, and per-chart empty states

---

#### `frontend/src/lib/__tests__/monthRange.test.ts`

**Purpose**: Unit tests for `getMonthRange` and `getCurrentYearMonth`.

**Coverage**:
- 31-day month (January), 30-day month (April), February non-leap, February leap year, December year boundary
- `getCurrentYearMonth` returns local year and 1-indexed month

---

#### `frontend/src/__tests__/reports.integration.test.tsx`

**Purpose**: Integration tests for `ReportsPage` rendered with MSW-intercepted API responses.

**Coverage** (7 tests):
- Four chart section headings render after data loads
- KPI totals are computed correctly from seeded data (expenses 180, income 1000, net 820)
- Empty state shown when no transactions exist
- Currency selector hidden with one currency, shown with multiple currencies
- Roll-up toggle is present
- Month navigation re-queries with the next month's date bounds

---

### Modified Files

#### `frontend/src/components/molecules/index.ts`

Added `MonthPicker`, `getMonthRange`, and `getCurrentYearMonth` to the molecules barrel export.

---

#### `frontend/src/features/transactions/pages/TransactionsPage.tsx`

**Changes**:
- Replaced the inline `currentMonthStart` / `currentMonthEnd` computation (which used `.toISOString()`, vulnerable to UTC shift) with `getMonthRange(selectedMonth.year, selectedMonth.month)`
- Added `MonthPicker` as the primary date filter with `selectedMonth` state
- Wrapped the existing `DateRangePicker` in a `Collapse` behind a "Custom range" toggle button
- `handleMonthChange` updates `selectedMonth` and snaps `localStartDate` / `localEndDate` to the new month's bounds; the debounced query chain is unchanged

**Impact**:
- Default month-scoped loading behaviour is preserved
- Power users retain access to arbitrary date ranges via the toggle
- UTC-shift bug in date boundary calculation fixed

---

#### `frontend/src/__tests__/transactions.integration.test.tsx`

**Changes**:
- Updated the "renders filters section" test to assert on the MonthPicker's prev/next buttons rather than the `DateRangePicker` label (which is now hidden by default)
- Added test: "Custom range" button reveals the `DateRangePicker`
- Added test: prev/next arrows step months and update the displayed label

---

## Testing Strategy

| Test file | Type | Tests |
|---|---|---|
| `lib/__tests__/monthRange.test.ts` | Unit | 6 (date boundary correctness) |
| `__tests__/reports.integration.test.tsx` | Integration | 7 (ReportsPage scenarios) |
| `__tests__/transactions.integration.test.tsx` | Integration | 3 updated / 2 new |

No backend tests required (no backend changes).

## Architecture Decisions

**No new backend endpoint**: `GET /transactions` with `start`/`end` date bounds returns all enriched fields needed for aggregation. Adding a reports endpoint would duplicate logic already in the frontend and require a migration. The same client-side approach is already used by `useDashboardSummary`.

**Cross-filter rule for income and categories**: A `'category'` selection applies to expenses only. Applying it to income would zero out Total Income (income rows have no expense category), making Net misleadingly equal to `-totalExpenses`. Income totals only respect `account`, `user`, and `day` selections.

**1-indexed month convention**: `MonthPicker` uses 1-indexed months (`1`=January) throughout its public API to match human-readable labels and backend date strings, converting internally for JavaScript `Date` construction (`month - 1`).

**Local-timezone date formatting**: Both `getMonthRange` and the existing `DateRangePicker.formatToISODate` use `date.getFullYear() / getMonth() / getDate()` rather than `toISOString()`. `toISOString()` returns UTC midnight, which can produce the previous day's date for users west of UTC.

## Known Limitations

- Cross-filter slice clicks are not tested at the chart-segment level in jsdom (Recharts does not render SVG in jsdom). Covered by hook logic tests and a future Playwright test.
- No month-over-month comparison, async PDF export, or AI analysis — out of scope per `docs/feature-report-plan.md`.
- Currency conversion is not supported; only one currency is aggregated at a time.

## Next Steps

- End-to-end Playwright tests for slice-click cross-filter interaction
- Month-over-month comparison view
- Server-side aggregation endpoint for large datasets
- Async PDF / AI report generation (separate feature)
