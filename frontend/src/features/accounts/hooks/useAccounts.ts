// src/features/accounts/hooks/useAccounts.ts
// React Query hook for fetching list of accounts with optional tenant filter

import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '../api/accountsApi';

/**
 * React Query hook for fetching list of accounts
 *
 * Query key structure: ['accounts', familyId] or ['accounts', 'all']
 * This structure ensures proper cache isolation per family and global view
 *
 * When familyId is provided: returns only accounts shared with that family
 * When familyId is undefined: returns all user's accounts (global view)
 *
 * @param familyId Optional UUID of family/tenant to filter accounts for
 * @returns TanStack Query result with accounts data, loading, and error states
 *
 * @example
 * // Fetch accounts for a specific family
 * const { data: familyAccounts, isLoading } = useAccounts(familyId);
 *
 * @example
 * // Fetch all user's accounts (global view)
 * const { data: allAccounts } = useAccounts();
 */
export function useAccounts(familyId?: string) {
  return useQuery({
    // Query key includes familyId to ensure proper cache segregation
    // Use 'all' for global view to differentiate from family-specific queries
    queryKey: familyId ? ['accounts', familyId] : ['accounts', 'all'],

    // Query function calls API with optional familyId
    queryFn: () => getAccounts(familyId),

    // Always enabled since even without familyId we fetch all accounts
    // The API handles the difference based on presence of tenant_id param
  });
}
