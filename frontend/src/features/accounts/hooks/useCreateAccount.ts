// src/features/accounts/hooks/useCreateAccount.ts
// React Query mutation hook for creating new accounts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAccount } from '../api/accountsApi';
import type { AccountCreate, AccountRead } from '@/types/account';

/**
 * React Query hook for creating a new account
 *
 * Returns mutation function, loading state, and error state
 * Automatically invalidates accounts query cache on success to trigger refetch
 * This ensures all account lists show the newly created account immediately
 *
 * @param familyId Optional UUID of family context (for cache invalidation)
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: createNewAccount, isPending } = useCreateAccount(familyId);
 *
 * const handleSubmit = (data: AccountCreate) => {
 *   createNewAccount(data, {
 *     onSuccess: (account) => {
 *       toast.success('Account created');
 *       navigate(`/app/${familyId}/accounts/${account.id}`);
 *     },
 *     onError: (error) => {
 *       toast.error(error.message);
 *     },
 *   });
 * };
 */
export function useCreateAccount(familyId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to create account
    mutationFn: (data: AccountCreate): Promise<AccountRead> => {
      return createAccount(data);
    },

    // On success, invalidate accounts queries to trigger refetch
    // This ensures UI shows the new account in lists immediately
    onSuccess: () => {
      // Invalidate family-specific accounts query if familyId provided
      if (familyId) {
        queryClient.invalidateQueries({
          queryKey: ['accounts', familyId],
        });
      }

      // Also invalidate global accounts query to update "all accounts" view
      queryClient.invalidateQueries({
        queryKey: ['accounts', 'all'],
      });
    },
  });
}
