// src/features/accounts/hooks/useDeleteAccountShare.ts
// React Query mutation hook for deleting account shares

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAccountShare } from '../api/accountSharesApi';

/**
 * Input type for delete mutation combining accountId and tenantId
 */
interface DeleteAccountShareInput {
  accountId: string;
  tenantId: string;
}

/**
 * React Query hook for deleting an account share
 *
 * Returns mutation function, loading state, and error state
 * Automatically invalidates accountShares query cache on success to trigger refetch
 * This ensures the share list removes the deleted share immediately
 *
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: deleteShare, isPending } = useDeleteAccountShare();
 *
 * const handleDeleteShare = (tenantId: string) => {
 *   if (confirm('Stop sharing this account?')) {
 *     deleteShare(
 *       { accountId: '123', tenantId },
 *       {
 *         onSuccess: () => {
 *           toast.success('Share removed');
 *         },
 *         onError: (error) => {
 *           // Handle specific error cases:
 *           // - 403: User not account owner
 *           // - 404: Account, tenant, or share not found
 *           toast.error(error.message);
 *         },
 *       }
 *     );
 *   }
 * };
 */
export function useDeleteAccountShare() {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to delete account share
    mutationFn: ({
      accountId,
      tenantId,
    }: DeleteAccountShareInput): Promise<void> => {
      return deleteAccountShare(accountId, tenantId);
    },

    // On success, invalidate accountShares query to trigger refetch
    // This ensures UI removes the share from the list immediately
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['accountShares', variables.accountId],
      });
    },
  });
}
