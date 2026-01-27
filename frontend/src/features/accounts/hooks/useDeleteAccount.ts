// src/features/accounts/hooks/useDeleteAccount.ts
// React Query mutation hook for deleting accounts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAccount } from '../api/accountsApi';

/**
 * React Query hook for deleting an account
 *
 * Returns mutation function, loading state, and error state
 * Automatically invalidates accounts list queries on success
 *
 * When familyId is provided:
 * - Signals to backend this is a family context deletion
 * - Backend blocks deletion if account is shared with multiple families (409 Conflict)
 * - User must delete from main accounts page for multi-shared accounts
 *
 * When familyId is not provided (main/global context):
 * - Deletion proceeds regardless of share count
 * - All AccountShare records cascade deleted
 * - Linked Transaction records have account_id set to NULL
 *
 * @param familyId Optional UUID of family context (for cache invalidation and context signal)
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: deleteExistingAccount, isPending } = useDeleteAccount(familyId);
 *
 * const handleDelete = (accountId: string) => {
 *   deleteExistingAccount(accountId, {
 *     onSuccess: () => {
 *       toast.success('Account deleted');
 *       navigate(`/app/${familyId}/accounts`);
 *     },
 *     onError: (error) => {
 *       // Backend returns 409 if account is shared with multiple families
 *       if (error.status === 409) {
 *         toast.error('This account is shared with multiple families. Please delete from main Accounts page.');
 *       } else {
 *         toast.error(error.message || 'Failed to delete account');
 *       }
 *     },
 *   });
 * };
 */
export function useDeleteAccount(familyId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to delete account
    // Pass fromFamilyContext=true when familyId is provided to signal family context deletion
    mutationFn: (accountId: string): Promise<void> => {
      return deleteAccount(accountId, !!familyId);
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
