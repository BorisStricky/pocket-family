// src/features/transactions/hooks/useDeleteTransaction.ts
// React Query mutation hook for deleting transactions

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteTransaction } from '../api/transactionsApi';

/**
 * React Query mutation hook for deleting transaction
 *
 * Automatically invalidates all transaction-related queries on success
 * to ensure list views no longer show the deleted transaction
 *
 * The mutation accepts transactionId as the variable parameter,
 * allowing the same hook instance to delete different transactions
 *
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example
 * // Delete transaction after confirmation
 * const { mutate: deleteTx, isPending } = useDeleteTransaction();
 *
 * const handleDelete = () => {
 *   if (confirm('Delete this transaction?')) {
 *     deleteTx('transaction-uuid-123');
 *   }
 * };
 *
 * @example
 * // With success callback
 * const { mutate } = useDeleteTransaction();
 * mutate(transactionId, {
 *   onSuccess: () => {
 *     toast.success('Transaction deleted');
 *     navigate('/transactions');
 *   },
 *   onError: (error) => toast.error(error.message)
 * });
 */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function accepts transactionId as parameter
    // This allows the same hook to be used for deleting any transaction
    mutationFn: (transactionId: string) => deleteTransaction(transactionId),

    // On success, invalidate all transaction queries to trigger refetch
    // This ensures the deleted transaction is removed from all list views
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
