// src/features/family/api/familyApi.ts
// API functions for family/tenant and membership operations
// Covers family CRUD, member listing, invitations, and member removal

import { apiFetch } from '@/lib/apiClient';
import { API_ENDPOINTS } from '@/lib/constants';
import type { TenantRead, TenantCreate, MembershipRead, MembershipCreate } from '@/types/family';
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

/**
 * Create a new family/tenant
 * Calls POST /tenants with the family name
 * The creating user automatically becomes the owner of the new family
 * Returns the created tenant with its generated UUID
 */
export async function createFamily(data: TenantCreate): Promise<TenantRead> {
  return apiFetch(API_ENDPOINTS.TENANTS, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a family/tenant
 * Calls DELETE /tenants/{tenant_id}
 * Only the owner of the family can delete it
 * This permanently removes the family and all associated data
 */
export async function deleteFamily(familyId: string): Promise<{ ok: boolean }> {
  const url = API_ENDPOINTS.TENANT_BY_ID.replace(':id', familyId);
  return apiFetch(url, {
    method: 'DELETE',
  });
}

/**
 * List all members of a family/tenant
 * Calls GET /tenants/{tenant_id}/members
 * Returns members with all statuses (active, pending, revoked)
 * UI should filter/display based on status as needed
 */
export async function listMembers(familyId: string): Promise<MembershipRead[]> {
  const url = API_ENDPOINTS.TENANT_MEMBERS.replace(':tenantId', familyId);
  return apiFetch(url, {
    method: 'GET',
  });
}

/**
 * Invite a new member to a family/tenant
 * Calls POST /tenants/{tenant_id}/members
 * Creates a PENDING membership for the invited user
 * Only owners can invite new members
 * The invited user will need to accept the invitation to become active
 */
export async function inviteMember(
  familyId: string,
  data: MembershipCreate
): Promise<MembershipRead> {
  const url = API_ENDPOINTS.TENANT_MEMBERS.replace(':tenantId', familyId);
  return apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Remove a member from a family/tenant
 * Calls DELETE /tenants/{tenant_id}/members/{membership_id}
 * Used for two scenarios:
 * 1. Owner removes another member (removeMember)
 * 2. Member removes themselves (leaveFamily)
 * Both use the same endpoint - the backend determines permissions based on the caller
 */
export async function removeMember(
  familyId: string,
  membershipId: string
): Promise<{ ok: boolean }> {
  const url = API_ENDPOINTS.TENANT_MEMBER_BY_ID
    .replace(':tenantId', familyId)
    .replace(':membershipId', membershipId);
  return apiFetch(url, {
    method: 'DELETE',
  });
}
