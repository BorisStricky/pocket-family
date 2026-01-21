// src/features/family/hooks/useFamilies.ts
// React Query hook for fetching user's families

import { useQuery } from '@tanstack/react-query';
import { getFamilies } from '../api/familyApi';
import type { TenantRead } from '@/types/family';

/**
 * Fetch all families that the current user belongs to
 * Query key: ['families']
 * Uses GET /tenants endpoint
 * Returns list of TenantRead objects
 */
export function useFamilies() {
  return useQuery<TenantRead[], Error>({
    queryKey: ['families'],
    queryFn: getFamilies,
    // Families data is relatively stable, cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
}
