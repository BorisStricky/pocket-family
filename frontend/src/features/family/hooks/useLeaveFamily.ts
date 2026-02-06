// src/features/family/hooks/useLeaveFamily.ts
// React Query mutation hook for leaving a family (member removes themselves)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeMember } from '../api/familyApi';

/**
 * React Query hook for leaving a family
 *
 * Uses the same backend endpoint as removeMember (DELETE /tenants/{id}/members/{id}),
 * but is semantically different: the user is removing their own membership.
 *
 * On success, invalidates both the members list and the families list,
 * because the user will no longer see this family in their family selector.
 *
 * Owners cannot leave their own family - they must delete it or transfer ownership.
 * Backend enforces this constraint and returns 403 if an owner tries to leave.
 *
 * @param familyId UUID of the family to leave
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: leave, isPending } = useLeaveFamily(familyId);
 *
 * leave({ membershipId: currentUserMembershipId }, {
 *   onSuccess: () => {
 *     toast.success('You have left the family');
 *     navigate('/app/families');
 *   },
 * });
 */
export function useLeaveFamily(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Uses the same removeMember API function - backend determines authorization
    // based on whether the caller is removing themselves vs. another member
    mutationFn: (membershipId: string): Promise<{ ok: boolean }> => {
      return removeMember(familyId, membershipId);
    },

    // On success, invalidate both members and families lists
    // Members list: the user's membership is now removed
    // Families list: the user no longer belongs to this family
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['members', familyId],
      });
      queryClient.invalidateQueries({
        queryKey: ['families'],
      });
    },
  });
}
