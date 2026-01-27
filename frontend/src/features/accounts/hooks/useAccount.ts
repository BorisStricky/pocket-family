// src/features/accounts/hooks/useAccount.ts
// React Query hook for fetching a single account by ID

import { useQuery } from '@tanstack/react-query';
import { getAccount } from '../api/accountsApi';

/**
 * React Query hook for fetching a single account
 *
 * Query key structure: ['account', accountId]
 * This enables stale-while-revalidate pattern: shows cached data immediately
 * while revalidating in the background for the freshest balance
 *
 * @param accountId UUID of the account to fetch
 * @returns TanStack Query result with account data, loading, and error states
 *
 * @example
 * // Fetch specific account for detail view
 * const { data: account, isLoading, error } = useAccount(accountId);
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * return <div>{account.name}: {account.balance}</div>;
 */
export function useAccount(accountId: string) {
  return useQuery({
    // Query key includes accountId for cache isolation per account
    queryKey: ['account', accountId],

    // Query function fetches single account by ID
    queryFn: () => getAccount(accountId),

    // Only run query if accountId is provided (prevents unnecessary API calls)
    enabled: !!accountId,

    // Enable stale-while-revalidate pattern: show cached data immediately
    // while fetching fresh data in background for optimal UX
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}
