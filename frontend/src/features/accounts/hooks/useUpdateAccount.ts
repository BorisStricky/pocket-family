// src/features/accounts/hooks/useUpdateAccount.ts
// React Query mutation hook for updating existing accounts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAccount } from '../api/accountsApi';
import type { AccountUpdate, AccountRead } from '@/types/account';

/**
 * React Query hook for updating an existing account
 *
 * Returns mutation function, loading state, and error state
 * Automatically invalidates relevant query caches on success:
 * - The specific account query (for detail views)
 * - All accounts list queries (for list views)
 *
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: updateExistingAccount, isPending } = useUpdateAccount();
 *
 * const handleUpdate = (accountId: string, data: AccountUpdate) => {
 *   updateExistingAccount(
 *     { accountId, data },
 *     {
 *       onSuccess: (account) => {
 *         toast.success('Account updated');
 *       },
 *       onError: (error) => {
 *         toast.error(error.message);
 *       },
 *     }
 *   );
 * };
 */
export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to update account
    // Takes both accountId and data as parameters
    mutationFn: ({
      accountId,
      data,
    }: {
      accountId: string;
      data: AccountUpdate;
    }): Promise<AccountRead> => {
      return updateAccount(accountId, data);
    },

    // On success, invalidate queries to show updated data
    onSuccess: (updatedAccount) => {
      // Invalidate the specific account query (detail view)
      queryClient.invalidateQueries({
        queryKey: ['account', updatedAccount.id],
      });

      // Invalidate all accounts list queries (includes family-specific and global)
      // Using wildcard to catch ['accounts', familyId] and ['accounts', 'all']
      queryClient.invalidateQueries({
        queryKey: ['accounts'],
      });
    },
  });
}
