// src/features/transactions/hooks/useCreateTransaction.ts
// React Query mutation hook for creating new transactions

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTransaction } from '../api/transactionsApi';
import type { TransactionCreate } from '../types';

/**
 * React Query mutation hook for creating new transaction
 *
 * Automatically invalidates all transaction-related queries on success
 * to ensure list views and cached data reflect the newly created transaction
 *
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example
 * // Create transaction with form data
 * const { mutate: createTx, isPending } = useCreateTransaction();
 *
 * createTx({
 *   tenant_id: familyId,
 *   account_id: 'account-123',
 *   amount: '150.00',
 *   transaction_date: '2026-01-12',
 *   transaction_type: 'expense',
 *   description: 'Groceries'
 * });
 *
 * @example
 * // With success/error callbacks
 * const { mutate } = useCreateTransaction();
 * mutate(data, {
 *   onSuccess: (transaction) => console.log('Created:', transaction.id),
 *   onError: (error) => toast.error(error.message)
 * });
 */
export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function accepts TransactionCreate data
    // The data includes tenant_id which is validated against user's JWT token
    mutationFn: (data: TransactionCreate) => createTransaction(data),

    // On success, invalidate all transaction queries to trigger refetch
    // This ensures transaction lists across the app show the new transaction
    onSuccess: () => {
      // Invalidate all queries starting with ['transactions']
      // This catches both list queries ['transactions', familyId, filters?]
      // and detail queries ['transactions', transactionId]
      queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });
    },
  });
}
