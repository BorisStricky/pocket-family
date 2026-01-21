// src/features/transactions/hooks/useTransaction.ts
// React Query hook for fetching a single transaction by ID

import { useQuery } from '@tanstack/react-query';
import { fetchTransactionById } from '../api/transactionsApi';

/**
 * React Query hook for fetching single transaction by ID
 *
 * Query key structure: ['transactions', transactionId]
 * This key structure allows mutations to invalidate both list and detail views
 * by targeting queries that start with ['transactions']
 *
 * @param transactionId UUID of the transaction to fetch
 * @returns TanStack Query result with transaction data, loading, and error states
 *
 * @example
 * // Fetch single transaction for detail view or editing
 * const { data: transaction, isLoading } = useTransaction('transaction-uuid-123');
 *
 * @example
 * // Handle loading and error states
 * const { data, isLoading, isError, error } = useTransaction(transactionId);
 * if (isLoading) return <Spinner />;
 * if (isError) return <ErrorMessage error={error} />;
 */
export function useTransaction(transactionId: string) {
  return useQuery({
    // Query key uses 'transactions' (plural) to align with list queries
    // This allows invalidateQueries({ queryKey: ['transactions'] }) to clear both lists and details
    queryKey: ['transactions', transactionId],

    // Query function calls API with transactionId
    // Backend validates tenant ownership via JWT token
    queryFn: () => fetchTransactionById(transactionId),

    // Only run query if transactionId is provided
    enabled: !!transactionId,
  });
}
