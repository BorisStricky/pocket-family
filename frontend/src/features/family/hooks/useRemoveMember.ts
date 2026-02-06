// src/features/family/hooks/useRemoveMember.ts
// React Query mutation hook for removing members from a family

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeMember } from '../api/familyApi';

/**
 * Parameters for removing a member from a family
 */
export interface RemoveMemberParams {
  /** UUID of the membership to remove */
  membershipId: string;
}

/**
 * React Query hook for removing a member from a family
 *
 * Returns mutation function, loading state, and error state.
 * On success, invalidates the members list query so the removed member
 * disappears from the UI immediately.
 *
 * Only owners can remove other members. Backend enforces this constraint.
 * Owners cannot remove themselves - they must use deleteFamily or transfer ownership first.
 *
 * @param familyId UUID of the family to remove the member from
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: remove, isPending } = useRemoveMember(familyId);
 *
 * remove({ membershipId: 'membership-uuid' }, {
 *   onSuccess: () => {
 *     toast.success('Member removed');
 *   },
 * });
 */
export function useRemoveMember(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to remove the member
    mutationFn: (params: RemoveMemberParams): Promise<{ ok: boolean }> => {
      return removeMember(familyId, params.membershipId);
    },

    // On success, invalidate members list to remove the member from UI
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['members', familyId],
      });
    },
  });
}
