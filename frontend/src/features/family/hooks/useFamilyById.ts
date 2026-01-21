// src/features/family/hooks/useFamilyById.ts
// React Query hook for fetching a single family by ID

import { useQuery } from '@tanstack/react-query';
import { getFamilyById } from '../api/familyApi';
import type { TenantRead } from '@/types/family';

/**
 * Fetch a specific family by ID
 * Query key: ['family', familyId]
 * Uses GET /tenants/{tenant_id} endpoint
 * Validates user membership - throws 403 if not a member
 * Used by FamilyGuard to validate access to family-scoped routes
 */
export function useFamilyById(familyId: string | undefined) {
  return useQuery<TenantRead, Error>({
    queryKey: ['family', familyId],
    queryFn: () => {
      if (!familyId) {
        throw new Error('Family ID is required');
      }
      return getFamilyById(familyId);
    },
    // Only run query if familyId is provided
    enabled: !!familyId,
    // Cache family data for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Retry only once on error (to avoid hammering backend on 403)
    retry: 1,
  });
}
