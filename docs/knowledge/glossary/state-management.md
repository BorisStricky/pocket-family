---
documentation_status: Updated
overview: Covers state management patterns in React including Context API for global state and React Query for server state. Includes comprehensive React Query patterns with useQuery, useMutation, cache invalidation, and query key strategies. Explains the difference between client state and server state, and when to use each approach.
tags:
  - react
  - react-query
  - context-api
  - typescript
  - state-management
  - server-state
  - caching
  - tanstack-query
---

# State Management

**React Context API**: Built-in React feature for sharing state across components without prop drilling. We use it for global auth state (user, tokens). Implementation: [AuthContext.tsx](../frontend/src/features/auth/context/AuthContext.tsx)

**Context Provider**: Component that wraps app and provides context value to all children. Example: `<AuthProvider>` makes auth state available everywhere.

**useContext Hook**: Hook to access context value in any component. We wrap it in custom hooks like `useAuth()` for better API.

**React Query (TanStack Query)**: Library for managing server state (API data). Handles loading states, caching, refetching, mutations. Alternative to Redux for async data. We use it for all API calls.

**Query**: Read operation (GET requests). Automatically caches data and refetches when stale. Example: `useQuery({ queryKey: ['transactions'], queryFn: fetchTransactions })`

**Mutation**: Write operation (POST/PUT/DELETE). Used with callbacks for success/error handling. Example: `useMutation({ mutationFn: login, onSuccess: () => navigate('/app') })`

**QueryClient**: React Query's cache manager. Configured once at app root with default options. Wrapped app in `<QueryClientProvider>`.

## React Query Deep Dive

**useQuery Hook**: Hook for fetching and caching data from server. Takes object with `queryKey` (array identifier for cache), `queryFn` (async function returning data), and optional config like `staleTime`, `gcTime`, and `enabled`. Returns object with `data`, `isLoading`, `isError`, `error`, and `refetch` function. Reference implementation: [useAccount.ts](../../frontend/src/features/accounts/hooks/useAccount.ts)

**useMutation Hook**: Hook for write operations (POST/PUT/DELETE). Takes object with `mutationFn` (async function), `onSuccess` callback (to invalidate related queries), `onError` callback (error handling), and `onMutate` (optimistic updates). Returns `mutate` function (fire-and-forget), `mutateAsync` (returns promise), plus status flags `isPending`, `isSuccess`, and `error`. Reference implementation: [useCreateAccount.ts](../../frontend/src/features/accounts/hooks/useCreateAccount.ts)

**useQueryClient Hook**: Hook to access QueryClient instance for manual cache operations. Common patterns: `queryClient.invalidateQueries()` to mark data stale, `queryClient.setQueryData()` for manual updates, `queryClient.getQueryData()` to read cache, `queryClient.prefetchQuery()` to prefetch data before needed. Used in mutation `onSuccess` callbacks to synchronize server state changes.

**Query Invalidation**: Pattern of marking cached data stale to trigger refetch on next access or immediately. Used after mutations succeed to ensure UI shows latest data. Syntax: `queryClient.invalidateQueries({ queryKey: ['accounts'] })`. Supports partial matching - invalidating `['accounts']` also invalidates `['accounts', '123']` and `['accounts', '123', filters]`. Preferred over manual cache updates because server is source of truth.

**Query Keys**: Array-based identifiers for cache entries following convention `['feature', id, filters]`. Example: `['accounts', familyId, { status: 'active' }]`. Hierarchical matching means invalidating `['accounts']` marks all account-related queries stale. Must be JSON-serializable. Avoid abbreviated names (use `accounts` not `acc`, `transactions` not `tx`).

**Stale Time**: Duration (milliseconds) before cached data is considered stale and refetch is triggered. Default is 0ms (always stale, refetch on every mount). Common values: 30000ms (30 seconds) for fast-changing data, 300000ms (5 minutes) for slower updates. Trade-off: longer staleness means fewer server requests but potentially stale UI. Distinct from `gcTime` which controls how long unused queries remain in memory before garbage collection.

**Server State vs Client State**: Fundamental distinction in state management. Server state includes data from API (accounts, transactions, users) - managed by React Query with caching, refetching, and synchronization. Client state is UI-specific (modal open/closed, form inputs, toggles, loading flags) - managed with `useState`. Separation matters because each has different lifecycle and requirements. Mixing causes synchronization bugs.

**Dependent Queries**: Queries that require data from another query before executing. Use `enabled` option to conditionally run: `useQuery({ queryKey: ['transactions', familyId], queryFn: ..., enabled: !!familyId })`. Example: transactions query depends on valid `familyId` from family context. Prevents errors from undefined values and prevents unnecessary network requests. Query automatically runs when dependencies become available.

## Domain-Specific Query Patterns

**Category Management Queries**: Pattern for managing hierarchical category data with React Query. Query key structure: `['categories', familyId]` for list queries and `['category', categoryId]` for single category. Mutations invalidate appropriate queries - creating/updating categories invalidates the list query, updating single category invalidates both list and detail. Categories support parent-child relationships via `parent_id` field for unlimited nesting depth. Category kind (expense/income) determines transaction type compatibility.

**Hierarchical Data Caching**: Pattern for caching nested data structures like category trees. Two approaches: (1) flat list with parent_id relationships, client-side tree building, or (2) server-computed hierarchical structure with path field. Flat approach allows granular cache updates when single category changes. Tree approach requires full list invalidation but reduces client-side computation. Category implementation uses flat list with optional server-computed `path` field for breadcrumb display.

**Multi-Tenant Query Isolation**: Pattern ensuring queries are scoped to current tenant context. Query keys must include `familyId` to prevent cross-tenant data leaks. Example: `['categories', familyId]` not just `['categories']`. When user switches tenants, all queries with old familyId become inactive and new tenant queries fetch fresh data. API functions receive tenant_id from auth token, frontend includes familyId in query keys for proper cache isolation. Critical for data security in multi-tenant applications.

**Dashboard Summary**: Client-side aggregation of transactions, accounts, and categories into KPI metrics, charts, and recent activity. Computed via useDashboardSummary hook since no backend endpoint exists. Context: Demonstrates pattern of deriving computed state from multiple React Query hooks rather than fetching pre-aggregated data from backend. Useful when backend does not provide specific aggregation endpoints.

**Date Range Preset**: Predefined time periods (7d, 30d, month, year) used to filter dashboard data display. Context: UI abstraction that translates to startDate/endDate parameters for filtering transactions and computing metrics. Simplifies user interface while maintaining flexible query capabilities. Common pattern in analytics dashboards.

**Overview Card**: Reusable KPI card component that displays a metric value with optional trend delta indicator and icon. Context: Composition pattern for dashboard metrics - combines typography, icons, and conditional rendering for positive/negative trends. Reused across Total Expenses, Total Income, and Accounts Balance cards in DashboardPage.

**Budget**: A monthly spending limit that tracks expenses across one or more categories within a tenant. Each budget has a name, amount limit, and currency. The "spent" amount is calculated on-read by aggregating expense transactions. Context: Budgets help users manage spending by tracking progress against defined limits with visual indicators (green/yellow/red) based on percentage spent.

**BudgetCategory**: A join table linking budgets to categories in a many-to-many relationship. One budget can track multiple categories, and one category can belong to multiple budgets. Context: Implements flexible budget tracking where users can create specific budgets (e.g., "Entertainment" covering Movies + Games) or combine overlapping categories across different budget goals.

**Universal Budget**: A budget with no categories that tracks ALL tenant expense transactions matching its currency for the month. Context: Provides overall spending limits without category restrictions, useful for total monthly spending caps. Implemented by checking if budget has zero category associations.

**Spent Calculation**: The on-read aggregation of expense transactions across a budget's categories for a specific calendar month, filtered by the budget's currency. Context: Calculated dynamically on GET requests to ensure accuracy without maintaining denormalized state. Only transactions matching budget.currency are summed to prevent mixing BRL and USD amounts.
