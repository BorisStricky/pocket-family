// src/features/family/hooks/useInviteMember.ts
// React Query mutation hook for inviting new members to a family

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteMember } from '../api/familyApi';
import type { MembershipCreate, MembershipRead } from '@/types/family';

/**
 * React Query hook for inviting a new member to a family
 *
 * Returns mutation function, loading state, and error state.
 * On success, invalidates the members list query so the new pending
 * invitation appears immediately in the members list.
 *
 * Only owners can invite new members. Backend enforces this constraint
 * and returns 403 if a non-owner attempts to invite.
 *
 * @param familyId UUID of family to invite the member to
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: invite, isPending } = useInviteMember(familyId);
 *
 * invite({ user_email: 'newuser@example.com', role: 'member' }, {
 *   onSuccess: (membership) => {
 *     toast.success(`Invitation sent to ${membership.user_email}`);
 *   },
 *   onError: (error) => {
 *     toast.error(error.message);
 *   },
 * });
 */
export function useInviteMember(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to create a pending membership invitation
    mutationFn: (data: MembershipCreate): Promise<MembershipRead> => {
      return inviteMember(familyId, data);
    },

    // On success, invalidate the members list to show the new pending invitation
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['members', familyId],
      });
    },
  });
}
