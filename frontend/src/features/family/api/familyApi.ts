// src/features/family/api/familyApi.ts
// API functions for family/tenant operations

import { apiFetch } from '@/lib/apiClient';
import { API_ENDPOINTS } from '@/lib/constants';
import type { TenantRead } from '@/types/family';
import type { TokenResponse } from '@/types';

/**
 * Get all families/tenants that the current user is a member of
 * Calls GET /tenants
 * Returns list of families with ACTIVE membership status
 */
export async function getFamilies(): Promise<TenantRead[]> {
  return apiFetch(API_ENDPOINTS.TENANTS, {
    method: 'GET',
  });
}

/**
 * Get a specific family/tenant by ID
 * Calls GET /tenants/{tenant_id}
 * Validates that the user is an ACTIVE member of this family
 * Throws 403 if user is not a member, 404 if family doesn't exist
 */
export async function getFamilyById(familyId: string): Promise<TenantRead> {
  const url = API_ENDPOINTS.TENANT_BY_ID.replace(':id', familyId);
  return apiFetch(url, {
    method: 'GET',
  });
}

/**
 * Switch to a different family context
 * Calls POST /tenants/{tenant_id}/switch
 * Returns new access token with updated tenant_id claim
 * The caller is responsible for storing the new token and updating auth state
 */
export async function switchFamily(familyId: string): Promise<TokenResponse> {
  const url = API_ENDPOINTS.TENANT_SWITCH.replace(':id', familyId);
  return apiFetch(url, {
    method: 'POST',
  });
}
