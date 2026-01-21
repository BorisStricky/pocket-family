// src/test/mocks/handlers/family.ts
// MSW handlers for family/tenant endpoints (/tenants/*)

import { http, HttpResponse } from 'msw';
import { createMockFamily, createMockFamilyList, createMockJWT } from '../factories';

// Base URL for API requests (matches vitest.config.ts define)
const API_BASE = 'http://localhost:8000';

/**
 * Family/tenant endpoint handlers for MSW
 * These provide default successful responses that can be overridden per-test
 */
export const familyHandlers = [
  // GET /tenants - List user's tenants/families
  http.get(`${API_BASE}/tenants`, () => {
    return HttpResponse.json(createMockFamilyList(2));
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
];
