// src/features/category/hooks/useCategoryTransactionCount.ts
// React Query hook for fetching transaction count for a category

import { useQuery } from '@tanstack/react-query';
import { getCategoryTransactionCount } from '../api/categoriesApi';

/**
 * React Query hook for fetching transaction count for a category
 *
 * Returns the number of transactions that reference the specified category.
 * Used to determine if a category can be safely deleted or if transaction
 * reassignment is required.
 *
 * The query is enabled by default and will automatically refetch when
 * the categoryId changes.
 *
 * @param categoryId UUID of category to check for transaction count
 * @returns Query object with transaction count data and loading/error states
 *
 * @example
 * const { data: transactionCount, isLoading } = useCategoryTransactionCount(categoryId);
 *
 * if (isLoading) {
 *   return <CircularProgress />;
 * }
 *
 * if (transactionCount === 0) {
 *   return <Alert>Category can be safely deleted</Alert>;
 * }
 */
export function useCategoryTransactionCount(categoryId: string | null) {
  return useQuery({
    // Query key includes category ID for caching per category
    queryKey: ['categories', categoryId, 'transaction-count'],

    // Fetch function calls API to get transaction count
    queryFn: () => {
      if (!categoryId) {
        throw new Error('Category ID is required');
      }
      return getCategoryTransactionCount(categoryId);
    },

    // Only run query if categoryId is provided
    enabled: !!categoryId,

    // Cache for 30 seconds since transaction counts may change frequently
    staleTime: 30000,
  });
}
