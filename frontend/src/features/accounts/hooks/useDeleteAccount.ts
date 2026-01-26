// src/features/accounts/hooks/useDeleteAccount.ts
// React Query mutation hook for deleting accounts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAccount } from '../api/accountsApi';

/**
 * React Query hook for deleting an account
 *
 * Returns mutation function, loading state, and error state
 * Automatically invalidates accounts list queries on success
 * Backend may reject deletion if account has transactions (referential integrity)
 *
 * @param familyId Optional UUID of family context (for cache invalidation)
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: deleteExistingAccount, isPending } = useDeleteAccount(familyId);
 *
 * const handleDelete = (accountId: string) => {
 *   if (confirm('Are you sure? This cannot be undone.')) {
 *     deleteExistingAccount(accountId, {
 *       onSuccess: () => {
 *         toast.success('Account deleted');
 *         navigate(`/app/${familyId}/accounts`);
 *       },
 *       onError: (error) => {
 *         // Backend returns 400 if account has transactions
 *         toast.error(error.message || 'Cannot delete account with transactions');
 *       },
 *     });
 *   }
 * };
 */
export function useDeleteAccount(familyId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to delete account
    mutationFn: (accountId: string): Promise<void> => {
      return deleteAccount(accountId);
    },

    // On success, invalidate accounts queries to remove deleted account from UI
    onSuccess: (_, accountId) => {
      // Invalidate family-specific accounts query if familyId provided
      if (familyId) {
        queryClient.invalidateQueries({
          queryKey: ['accounts', familyId],
        });
      }

      // Invalidate global accounts query
      queryClient.invalidateQueries({
        queryKey: ['accounts', 'all'],
      });

      // Also invalidate the specific account query (in case detail view is still mounted)
      queryClient.invalidateQueries({
        queryKey: ['account', accountId],
      });

      // Invalidate transactions queries as they may reference the deleted account
      // This prevents showing stale transaction data with orphaned account references
      queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });
    },
  });
}
