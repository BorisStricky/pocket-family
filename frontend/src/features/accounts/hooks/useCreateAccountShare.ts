// src/features/accounts/hooks/useCreateAccountShare.ts
// React Query mutation hook for creating account shares

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAccountShare } from '../api/accountSharesApi';
import type { AccountShareCreate, AccountShareRead } from '@/types/account';

/**
 * React Query hook for creating a new account share
 *
 * Returns mutation function, loading state, and error state
 * Automatically invalidates accountShares query cache on success to trigger refetch
 * This ensures the share list shows the newly created share immediately
 *
 * @param accountId UUID of the account being shared
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: shareAccount, isPending } = useCreateAccountShare(accountId);
 *
 * const handleSubmit = (data: AccountShareCreate) => {
 *   shareAccount(data, {
 *     onSuccess: (share) => {
 *       toast.success('Account shared successfully');
 *       onClose();
 *     },
 *     onError: (error) => {
 *       // Handle specific error cases:
 *       // - 400: Share already exists (duplicate)
 *       // - 403: User not member of target tenant or not account owner
 *       // - 404: Account or tenant not found
 *       toast.error(error.message);
 *     },
 *   });
 * };
 */
export function useCreateAccountShare(accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to create account share
    mutationFn: (data: AccountShareCreate): Promise<AccountShareRead> => {
      return createAccountShare(accountId, data);
    },

    // On success, invalidate accountShares query to trigger refetch
    // This ensures UI shows the new share in the list immediately
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['accountShares', accountId],
      });
    },
  });
}
