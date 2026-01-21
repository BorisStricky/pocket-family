// src/features/transactions/hooks/useTransactions.ts
// React Query hook for fetching list of transactions with optional filters

import { useQuery } from '@tanstack/react-query';
import { fetchTransactions } from '../api/transactionsApi';
import type { TransactionFilters } from '../types';

/**
 * React Query hook for fetching list of transactions
 *
 * Query key structure: ['transactions', familyId, filters?]
 * This structure ensures proper cache isolation per family and filter combination
 * Different filter combinations create separate cache entries for optimal UX
 *
 * @param familyId UUID of the family/tenant to fetch transactions for
 * @param filters Optional filters to narrow results (date range, account, category, etc.)
 * @returns TanStack Query result with transactions data, loading, and error states
 *
 * @example
 * // Fetch all transactions for family
 * const { data: transactions, isLoading } = useTransactions(familyId);
 *
 * @example
 * // Fetch transactions filtered by account and date range
 * const { data } = useTransactions(familyId, {
 *   account_id: 'account-123',
 *   start_date: '2026-01-01',
 *   end_date: '2026-01-31'
 * });
 */
export function useTransactions(familyId: string, filters?: TransactionFilters) {
  return useQuery({
    // Query key includes familyId and filters to ensure proper cache segregation
    // Each unique filter combination gets its own cache entry
    queryKey: ['transactions', familyId, filters],

    // Query function calls API with familyId and optional filters
    queryFn: () => fetchTransactions(familyId, filters),

    // Only run query if familyId is provided (prevents unnecessary API calls)
    enabled: !!familyId,
  });
}
