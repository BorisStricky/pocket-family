// src/features/accounts/hooks/useUpdateAccountShare.ts
// React Query mutation hook for updating account share visibility

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAccountShare } from '../api/accountSharesApi';
import type { AccountShareUpdate, AccountShareRead } from '@/types/account';

/**
 * Input type for update mutation combining accountId, tenantId, and update data
 */
interface UpdateAccountShareInput {
  accountId: string;
  tenantId: string;
  data: AccountShareUpdate;
}

/**
 * React Query hook for updating an existing account share
 *
 * Returns mutation function, loading state, and error state
 * Automatically invalidates accountShares query cache on success to trigger refetch
 * This ensures the share list reflects updated visibility settings immediately
 *
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: updateShare, isPending } = useUpdateAccountShare();
 *
 * const handleVisibilityChange = (visibility: ShareVisibility) => {
 *   updateShare(
 *     {
 *       accountId: '123',
 *       tenantId: '456',
 *       data: { visibility },
 *     },
 *     {
 *       onSuccess: (share) => {
 *         toast.success('Visibility updated');
 *         onClose();
 *       },
 *       onError: (error) => {
 *         // Handle specific error cases:
 *         // - 403: User not account owner
 *         // - 404: Account, tenant, or share not found
 *         toast.error(error.message);
 *       },
 *     }
 *   );
 * };
 */
export function useUpdateAccountShare() {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to update account share visibility
    mutationFn: ({
      accountId,
      tenantId,
      data,
    }: UpdateAccountShareInput): Promise<AccountShareRead> => {
      return updateAccountShare(accountId, tenantId, data);
    },

    // On success, invalidate accountShares query to trigger refetch
    // This ensures UI shows updated visibility status immediately
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['accountShares', variables.accountId],
      });
    },
  });
}
