// src/features/transactions/hooks/useUpdateTransaction.ts
// React Query mutation hook for updating existing transactions

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTransaction } from '../api/transactionsApi';
import type { TransactionUpdate } from '../types';

/**
 * React Query mutation hook for updating existing transaction
 *
 * Automatically invalidates both list queries and the specific transaction query
 * on success to ensure all views reflect the updated data
 *
 * @param transactionId UUID of the transaction to update
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example
 * // Update transaction amount and description
 * const { mutate: updateTx, isPending } = useUpdateTransaction('transaction-123');
 *
 * updateTx({
 *   amount: '250.00',
 *   description: 'Updated groceries total'
 * });
 *
 * @example
 * // With success callback
 * const { mutate } = useUpdateTransaction(transactionId);
 * mutate({ category_id: 'new-category' }, {
 *   onSuccess: (updated) => toast.success('Transaction updated'),
 *   onError: (error) => toast.error(error.message)
 * });
 */
export function useUpdateTransaction(transactionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function accepts partial TransactionUpdate data
    // Only provided fields will be updated on the backend
    mutationFn: (data: TransactionUpdate) => updateTransaction(transactionId, data),

    // On success, invalidate both list and detail queries
    onSuccess: () => {
      // Invalidate all transaction list queries to refresh list views
      // This catches queries like ['transactions', familyId, filters?]
      queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });

      // Also invalidate the specific transaction detail query
      // This ensures the detail view shows updated data
      queryClient.invalidateQueries({
        queryKey: ['transactions', transactionId],
      });
    },
  });
}
