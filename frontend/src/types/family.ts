// src/types/family.ts
// Type definitions for family/tenant and membership domain models
// These types match the backend Pydantic schemas from the OpenAPI spec

/**
 * TenantRead schema - response from GET /tenants endpoints
 * Represents a family/group in the multi-tenant system
 */
export interface TenantRead {
  id: string; // UUID
  name: string; // Family/tenant display name
  // The family's main currency. All transaction amounts are stored in this currency
  // after conversion from whatever currency the user entered.
  default_currency: string; // BRL | USD | EUR | RSD
  created_at: string; // ISO datetime string
}

/**
 * TenantUpdate schema - request body for PATCH /tenants/{tenant_id}
 * Used by owners to update family properties. All fields are optional.
 */
export interface TenantUpdate {
  name?: string;
  default_currency?: string; // BRL | USD | EUR | RSD
}

/**
 * TenantCreate schema - request body for POST /tenants
 * Used when creating a new family. The creating user automatically becomes the owner.
 */
export interface TenantCreate {
  name: string; // Family name (required, min 2 characters)
}

/**
 * MembershipRole - the role a user holds within a family/tenant
 * Determines what actions the user can perform:
 * - owner: full control (invite, remove, delete family, manage categories)
 * - member: can create transactions and view data
 * - viewer: read-only access to family data
 */
export type MembershipRole = 'owner' | 'member' | 'viewer';

/**
 * MembershipStatus - the lifecycle state of a membership
 * - active: user has full access per their role
 * - pending: invitation sent but not yet accepted
 * - revoked: membership was removed by owner or user left
 */
export type MembershipStatus = 'active' | 'pending' | 'revoked';

/**
 * MembershipRead schema - response from membership endpoints
 * Represents a user's relationship to a family/tenant
 * user_id is null for pending invitations (user hasn't accepted yet)
 */
export interface MembershipRead {
  id: string; // UUID - membership ID used for remove/update operations
  tenant_id: string; // UUID - which family this membership belongs to
  user_id: string | null; // UUID or null for pending invitations
  user_email: string | null; // Email address (shown for pending invites)
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string; // ISO datetime string
}

/**
 * MembershipCreate schema - request body for POST /tenants/{tenant_id}/members
 * Used by owners to invite new members to their family
 * Creates a PENDING membership that the invited user must accept
 */
export interface MembershipCreate {
  user_email: string; // Email of the user to invite
  role?: MembershipRole; // Defaults to 'member' if not specified
}

/**
 * MembershipUpdate schema - request body for PATCH /tenants/{tenant_id}/members/{membership_id}
 * Used by owners to change a member's role or status
 */
export interface MembershipUpdate {
  role?: MembershipRole | null;
  status?: MembershipStatus | null;
}
