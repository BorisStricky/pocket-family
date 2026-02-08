// src/features/transactions/hooks/useUpdateTransaction.ts
// React Query mutation hook for updating existing transactions

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTransaction } from '../api/transactionsApi';
import type { TransactionUpdate } from '../types';

/**
 * React Query mutation hook for updating existing transaction
 *
 * Automatically invalidates transaction list queries on success to ensure
 * all list views reflect the updated data. Detail query is not invalidated
 * since users typically navigate away from detail page after update.
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

    // On success, invalidate only list queries (not detail query)
    onSuccess: () => {
      // Invalidate all transaction list queries to refresh list views
      // This catches queries like ['transactions', familyId, filters?]
      // Detail query invalidation removed - user navigates away immediately
      // (see TransactionDetailPage.tsx:68), so detail refetch is wasted
      // If user navigates back to detail page, React Query will fetch fresh data automatically
      queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });
    },
  });
}
