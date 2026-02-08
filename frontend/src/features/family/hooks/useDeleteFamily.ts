// src/features/family/hooks/useDeleteFamily.ts
// React Query mutation hook for deleting a family/tenant

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteFamily } from '../api/familyApi';

/**
 * React Query hook for deleting a family/tenant
 *
 * Returns mutation function, loading state, and error state.
 * On success, invalidates the families list query so the deleted family
 * is removed from the family selector immediately.
 *
 * Only the owner of a family can delete it. Backend enforces this constraint.
 * Deleting a family permanently removes all associated data (accounts,
 * transactions, categories, memberships).
 *
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: deleteFamilyMutation, isPending } = useDeleteFamily();
 *
 * deleteFamilyMutation(familyId, {
 *   onSuccess: () => {
 *     toast.success('Family deleted');
 *     navigate('/app/families');
 *   },
 *   onError: (error) => {
 *     toast.error(error.message);
 *   },
 * });
 */
export function useDeleteFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to delete the family
    mutationFn: (familyId: string): Promise<{ ok: boolean }> => {
      return deleteFamily(familyId);
    },

    // On success, invalidate families list and clean up related caches
    onSuccess: (_data, familyId) => {
      // Remove the deleted family from the families list
      queryClient.invalidateQueries({
        queryKey: ['families'],
      });

      // Invalidate all cached data for this family to free memory
      // This covers members, categories, transactions, accounts
      queryClient.invalidateQueries({
        queryKey: ['members', familyId],
      });
      queryClient.invalidateQueries({
        queryKey: ['categories', familyId],
      });
      queryClient.invalidateQueries({
        queryKey: ['transactions', familyId],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounts', familyId],
      });
    },
  });
}
