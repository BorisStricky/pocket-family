// src/test/mocks/handlers/family.ts
// MSW handlers for family/tenant endpoints (/tenants/*) and membership endpoints
// Covers family CRUD, member listing, invitations, and member removal

import { http, HttpResponse } from 'msw';
import { createMockFamily, createMockFamilyList, createMockJWT } from '../factories';
import { createMockMembershipList, createMockMembership, createMockPendingMembership } from '../factories';
import type { MembershipRead } from '@/types/family';

// Base URL for API requests (matches vitest.config.ts define)
const API_BASE = 'http://localhost:8000';

// In-memory store for families during tests
let mockFamilyStore = createMockFamilyList(2);

// In-memory store for memberships during tests
// Keyed by tenant_id for multi-tenant isolation
let mockMembershipStore: MembershipRead[] = createMockMembershipList(true);

/**
 * Reset the family store to default state
 * Call this in beforeEach to ensure test isolation
 */
export function resetFamilyStore(): void {
  mockFamilyStore = createMockFamilyList(2);
  mockMembershipStore = createMockMembershipList(true);
}

/**
 * Family/tenant and membership endpoint handlers for MSW
 * These provide default successful responses that can be overridden per-test
 */
export const familyHandlers = [
  // GET /tenants - List user's tenants/families
  http.get(`${API_BASE}/tenants`, () => {
    return HttpResponse.json(mockFamilyStore);
  }),

  // GET /tenants/:id - Get single tenant by ID
  http.get(`${API_BASE}/tenants/:id`, ({ params }) => {
    const { id } = params;

    // Simulate 404 for non-existent tenant
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized access
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to access this tenant' },
        { status: 403 }
      );
    }

    return HttpResponse.json(createMockFamily({ id: id as string }));
  }),

  // POST /tenants - Create new tenant/family
  http.post(`${API_BASE}/tenants`, async ({ request }) => {
    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as { name?: string };

    // Validate required name field
    if (!body.name) {
      return HttpResponse.json(
        { detail: 'name is required' },
        { status: 400 }
      );
    }

    // Validate minimum name length
    if (body.name.length < 2) {
      return HttpResponse.json(
        { detail: 'name must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Create new family with generated ID
    const newFamily = createMockFamily({
      id: `tenant-uuid-new-${Date.now()}`,
      name: body.name,
    });

    mockFamilyStore.push(newFamily);
    return HttpResponse.json(newFamily, { status: 201 });
  }),

  // DELETE /tenants/:id - Delete tenant/family (owner only)
  http.delete(`${API_BASE}/tenants/:id`, ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simulate 404 for non-existent tenant
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized delete (non-owner)
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Only the owner can delete this family' },
        { status: 403 }
      );
    }

    // Remove from store
    mockFamilyStore = mockFamilyStore.filter(
      (family) => family.id !== id
    );

    // Also remove memberships for this family
    mockMembershipStore = mockMembershipStore.filter(
      (membership) => membership.tenant_id !== id
    );

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /tenants/:id/switch - Switch to a different tenant
  http.post(`${API_BASE}/tenants/:id/switch`, ({ params }) => {
    const { id } = params;

    // Simulate 403 for unauthorized switch
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to switch to this tenant' },
        { status: 403 }
      );
    }

    // Return new token with updated tenant_id
    return HttpResponse.json({
      access_token: createMockJWT({ tenantId: id as string }),
    });
  }),

  // GET /tenants/:tenantId/members - List members of a family
  http.get(`${API_BASE}/tenants/:tenantId/members`, ({ params, request }) => {
    const { tenantId } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simulate 404 for non-existent tenant
    if (tenantId === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized access
    if (tenantId === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to access members of this family' },
        { status: 403 }
      );
    }

    // Filter memberships by tenant_id for multi-tenant isolation
    const filteredMemberships = mockMembershipStore.filter(
      (membership) => membership.tenant_id === tenantId
    );

    return HttpResponse.json(filteredMemberships);
  }),

  // POST /tenants/:tenantId/members - Invite a new member
  http.post(`${API_BASE}/tenants/:tenantId/members`, async ({ params, request }) => {
    const { tenantId } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simulate 403 for non-owner attempting to invite
    if (tenantId === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Only the owner can invite members' },
        { status: 403 }
      );
    }

    const body = await request.json() as { user_email?: string; role?: string };

    // Validate required email
    if (!body.user_email) {
      return HttpResponse.json(
        { detail: 'user_email is required' },
        { status: 400 }
      );
    }

    // Validate email format (basic check)
    if (!body.user_email.includes('@')) {
      return HttpResponse.json(
        { detail: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if member already exists
    const existingMembership = mockMembershipStore.find(
      (membership) =>
        membership.tenant_id === tenantId &&
        membership.user_email === body.user_email &&
        membership.status !== 'revoked'
    );

    if (existingMembership) {
      return HttpResponse.json(
        { detail: 'User is already a member or has a pending invitation' },
        { status: 409 }
      );
    }

    // Create new pending membership
    const newMembership = createMockPendingMembership({
      id: `membership-uuid-new-${Date.now()}`,
      tenantId: tenantId as string,
      userEmail: body.user_email,
      role: (body.role as 'member' | 'viewer') || 'member',
    });

    mockMembershipStore.push(newMembership);
    return HttpResponse.json(newMembership, { status: 201 });
  }),

  // DELETE /tenants/:tenantId/members/:membershipId - Remove member or leave family
  http.delete(`${API_BASE}/tenants/:tenantId/members/:membershipId`, ({ params, request }) => {
    const { tenantId, membershipId } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simulate 404 for non-existent membership
    if (membershipId === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Membership not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized removal (trying to remove owner)
    if (membershipId === 'cannot-remove-id') {
      return HttpResponse.json(
        { detail: 'Cannot remove the owner of the family' },
        { status: 403 }
      );
    }

    // Remove membership from store
    mockMembershipStore = mockMembershipStore.filter(
      (membership) => membership.id !== membershipId
    );

    return new HttpResponse(null, { status: 204 });
  }),
];
