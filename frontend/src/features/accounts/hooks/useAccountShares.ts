// src/features/accounts/hooks/useAccountShares.ts
// React Query hook for fetching account shares (families account is shared with)

import { useQuery } from '@tanstack/react-query';
import { getAccountShares } from '../api/accountSharesApi';

/**
 * React Query hook for fetching list of shares for a specific account
 *
 * Query key structure: ['accountShares', accountId]
 * This structure ensures proper cache isolation per account
 *
 * Only enabled when user is the account owner
 * Use isOwner prop to conditionally enable the query
 *
 * @param accountId UUID of the account to fetch shares for
 * @param options Optional configuration object
 * @param options.isOwner Whether the current user owns this account (query only runs if true)
 * @returns TanStack Query result with account shares data, loading, and error states
 *
 * @example
 * // Fetch shares only if user owns the account
 * const { data: shares, isLoading } = useAccountShares(accountId, { isOwner: true });
 *
 * @example
 * // Query is disabled when user is not owner
 * const { data: shares } = useAccountShares(accountId, { isOwner: false }); // Won't fetch
 */
export function useAccountShares(
  accountId: string,
  options?: { isOwner?: boolean }
) {
  return useQuery({
    // Query key includes accountId to ensure proper cache segregation
    queryKey: ['accountShares', accountId],

    // Query function calls API to fetch shares for this account
    queryFn: () => getAccountShares(accountId),

    // Only fetch shares if user owns the account
    // Prevents unnecessary API calls and potential 403 errors
    enabled: options?.isOwner ?? false,
  });
}
