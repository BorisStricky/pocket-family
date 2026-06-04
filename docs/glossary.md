# Glossary

A reference of technical terms, patterns, and domain concepts used across the Pocket Family codebase.

---

## Frontend Patterns

**MonthPicker**: Shared molecule component that renders a `< June 2026 >` prev/next navigation control for stepping through calendar months one at a time. Context: Used as the primary period selector on the Reports and Transactions pages; exposes 1-indexed `month` + `year` props and fires an `onChange` callback, keeping date arithmetic out of page components.

**getMonthRange**: Pure helper function (exported from `MonthPicker.tsx`) that converts a 1-indexed `(year, month)` pair into the inclusive ISO `YYYY-MM-DD` bounds (`startDate`, `endDate`) for that calendar month. Context: Uses local-timezone `Date` construction so bounds match what the user sees, avoiding the UTC-shift pitfall present when using `.toISOString()` on a local date.

**getCurrentYearMonth**: Pure helper (exported from `MonthPicker.tsx`) that returns `{ year, month }` for today's local calendar month. Context: Used as the default initial state for the month picker on both the Reports and Transactions pages.

**Client-Side Aggregation**: Pattern where raw transaction rows fetched from `GET /transactions` are aggregated in the browser using `useMemo` rather than via a dedicated backend endpoint. Context: The existing endpoint already returns every needed field (`amount`, `currency`, `transaction_type`, `account_name`, `category_name`, `created_by_name`), so a separate reports endpoint and migration are avoided. Makes cross-filter interactions instant (no re-fetch per click). First used in `useDashboardSummary`, extended by `useMonthlyReport`.

**useMonthlyReport**: Custom React Query hook that fetches one month of transactions and categories, then aggregates them client-side into totals and per-category / per-day / per-user / per-account breakdowns. Context: Located at `frontend/src/features/reports/hooks/useMonthlyReport.ts`; accepts a cross-filter `selection` and re-runs aggregation via `useMemo` whenever the selection, currency, or roll-up toggle changes — no extra network call needed.

**ReportSelection**: TypeScript interface `{ dimension: ReportDimension; value: string; label: string }` representing an active cross-filter on one chart dimension. Context: Shared across all chart components and the `useMonthlyReport` hook; `null` means no filter is active.

**ReportDimension**: Union type `'category' | 'account' | 'user' | 'day'` naming the four dimensions a user can cross-filter the monthly report by. Context: Determines which chart ignores its own filter dimension (so other slices remain selectable) while all other charts respect it.

**Cross-Filter (Bidirectional Chart Filter)**: Interaction pattern where clicking a slice or bar in one chart filters the aggregation of every other chart and the KPI totals, while leaving the chart that was clicked showing its full (unfiltered) data. Context: Implemented in `useMonthlyReport` via the `includeForChart` helper; the active selection is lifted to `ReportsPage` state and passed to all chart components.

**Subcategory Roll-Up Toggle**: A `Switch` control on the Category Pie Chart that, when on, attributes expense transactions from any subcategory to the subcategory's top-level parent category before aggregating. Context: Implemented by climbing the `parent_id` chain in `resolveCategory` inside `useMonthlyReport`; guarded against cycles with a `Set<string>`.

**ReportSlice**: Interface `{ id: string; label: string; total: number }` representing a single aggregated segment of a pie or donut chart. Context: Produced by `useMonthlyReport` for `byCategory`, `byUser`, and `byAccount`; `id` is the stable key matched against `ReportSelection.value`.

**DailyAmount**: Interface `{ date: string; income: number; expenses: number }` for a single calendar day's income and expense totals. Context: Produced by `useMonthlyReport` as the `byDay` array and consumed by `DailyAmountsBarChart`.

**MonthlyReportData**: The complete aggregated shape returned by `useMonthlyReport` for one month and currency: totals, `byCategory`, `byDay`, `byUser`, `byAccount`, `availableCurrencies`, and the resolved `currency`. Context: Already cross-filtered according to the active `ReportSelection` passed in.

**Custom Range Toggle**: A secondary "Custom range" button on the Transactions page that shows or hides a `Collapse`-wrapped `DateRangePicker` for arbitrary date spans. Context: Added when the `MonthPicker` became the primary period control; the free-form range is preserved for power users but demoted from always-visible to opt-in.

**formatReportAmount**: Utility function in `features/reports/utils.ts` that formats a numeric amount as a locale-sensitive currency string using `Intl.NumberFormat`. Context: Used by all four report chart components; falls back to `value.toFixed(2)` when the currency code is empty, and catches `Intl` throws for unknown codes to avoid runtime errors.

---

## React Query Patterns

**React Query Invalidation**: Process of marking cached data as stale to trigger automatic refetch. Context: Used after mutations to ensure UI reflects latest server state without manual refetching.

---

## Backend / API Patterns

**Tenant Context**: The current family/group scope for multi-tenant operations. Context: Stored in JWT token and React context; used to filter all database queries by `tenant_id`.

**ActiveContext**: Dependency injection object containing user, tenant, and membership information. Context: Returned by `get_current_user_context()` in FastAPI endpoints to enforce multi-tenant isolation.

---

## Testing Patterns

**MSW (Mock Service Worker)**: Testing library that intercepts network requests at the service-worker level to provide mocked API responses. Context: Used in frontend integration tests to simulate backend API responses without actual HTTP calls; configured in `frontend/src/test/mocks/`.

**renderWithProviders**: Test utility that wraps a component tree in all required React providers (Router, QueryClient, AuthContext, etc.) before rendering. Context: Used in every frontend integration test to avoid provider boilerplate and ensure a realistic render environment.

**setupAuthenticatedUser**: Test utility that seeds the auth state (localStorage token, MSW user endpoint) so the component under test sees a logged-in user. Context: Called in `beforeEach` in page-level integration tests.
