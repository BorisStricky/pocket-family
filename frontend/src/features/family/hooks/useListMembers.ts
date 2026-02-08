// src/features/family/hooks/useListMembers.ts
// React Query hook for fetching the members list of a family/tenant

import { useQuery } from '@tanstack/react-query';
import { listMembers } from '../api/familyApi';

/**
 * React Query hook for fetching all members of a family
 *
 * Query key structure: ['members', familyId]
 * This ensures proper cache isolation per family, so each family's
 * member list is cached separately.
 *
 * Returns members of all statuses (active, pending, revoked).
 * The UI can filter by status as needed (e.g., only show active + pending).
 *
 * @param familyId UUID of family/tenant to fetch members for
 * @returns TanStack Query result with members data, loading, and error states
 *
 * @example
 * const { data: members = [], isLoading } = useListMembers(familyId);
 *
 * // Filter to show only active and pending members
 * const visibleMembers = members.filter(
 *   member => member.status === 'active' || member.status === 'pending'
 * );
 */
export function useListMembers(familyId: string) {
  return useQuery({
    // Query key includes familyId for cache segregation per family
    queryKey: ['members', familyId],

    // Query function calls API to fetch members list
    queryFn: () => listMembers(familyId),

    // Only fetch when familyId is provided
    enabled: !!familyId,
  });
}
