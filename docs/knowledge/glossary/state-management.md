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
