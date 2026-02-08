// src/test/mocks/factories/membership.ts
// Factory functions for creating mock Membership objects in tests
// Provides realistic test data matching the MembershipRead schema from the backend

import type { MembershipRead, MembershipRole, MembershipStatus } from '@/types/family';

/**
 * Options for creating mock membership objects
 * All fields are optional - defaults provide a typical active member
 */
interface CreateMockMembershipOptions {
  id?: string;
  tenantId?: string;
  userId?: string | null;
  userEmail?: string | null;
  role?: MembershipRole;
  status?: MembershipStatus;
  createdAt?: string;
}

/**
 * Create a mock MembershipRead object with customizable properties
 * Defaults to an active member with realistic UUIDs and email
 *
 * @example
 * const membership = createMockMembership({ role: 'owner' });
 * const pending = createMockMembership({ status: 'pending', userId: null });
 */
export function createMockMembership(
  options: CreateMockMembershipOptions = {}
): MembershipRead {
  const {
    id = 'membership-uuid-1',
    tenantId = 'tenant-uuid-456',
    userId = 'user-uuid-123',
    userEmail = 'testuser@example.com',
    role = 'member',
    status = 'active',
    createdAt = new Date().toISOString(),
  } = options;

  return {
    id,
    tenant_id: tenantId,
    user_id: userId,
    user_email: userEmail,
    role,
    status,
    created_at: createdAt,
  };
}

/**
 * Create a mock owner membership
 * Convenience factory for the most common owner scenario
 */
export function createMockOwnerMembership(
  options: Partial<CreateMockMembershipOptions> = {}
): MembershipRead {
  return createMockMembership({
    id: 'membership-owner-uuid',
    userId: 'user-uuid-owner',
    userEmail: 'owner@example.com',
    role: 'owner',
    status: 'active',
    ...options,
  });
}

/**
 * Create a mock pending invitation membership
 * Pending invitations have null user_id since the user hasn't accepted yet
 */
export function createMockPendingMembership(
  options: Partial<CreateMockMembershipOptions> = {}
): MembershipRead {
  return createMockMembership({
    id: 'membership-pending-uuid',
    userId: null,
    userEmail: 'invited@example.com',
    role: 'member',
    status: 'pending',
    ...options,
  });
}

/**
 * Create a list of mock memberships representing a typical family
 * Includes an owner, active members, and optionally pending invitations
 *
 * @param includeInvitations Whether to include pending invitation memberships
 *
 * @example
 * const members = createMockMembershipList(); // owner + 2 members
 * const withInvites = createMockMembershipList(true); // owner + 2 members + 1 pending
 */
export function createMockMembershipList(
  includeInvitations: boolean = false
): MembershipRead[] {
  const memberships: MembershipRead[] = [
    createMockOwnerMembership({
      tenantId: 'tenant-uuid-456',
    }),
    createMockMembership({
      id: 'membership-uuid-2',
      userId: 'user-uuid-member1',
      userEmail: 'member1@example.com',
      role: 'member',
      status: 'active',
      tenantId: 'tenant-uuid-456',
    }),
    createMockMembership({
      id: 'membership-uuid-3',
      userId: 'user-uuid-member2',
      userEmail: 'member2@example.com',
      role: 'viewer',
      status: 'active',
      tenantId: 'tenant-uuid-456',
    }),
  ];

  if (includeInvitations) {
    memberships.push(
      createMockPendingMembership({
        tenantId: 'tenant-uuid-456',
      })
    );
  }

  return memberships;
}
