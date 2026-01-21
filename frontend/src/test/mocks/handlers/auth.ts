// src/test/mocks/handlers/auth.ts
// MSW handlers for auth endpoints (/auth/*)

import { http, HttpResponse } from 'msw';
import { createMockJWT } from '../factories';
import type { TokenResponse } from '@/types';

// Base URL for API requests (matches vitest.config.ts define)
const API_BASE = 'http://localhost:8000';

/**
 * Default successful token response factory
 * Creates a token response with a valid JWT
 */
function createTokenResponse(tenant_id: string | null = 'tenant-uuid-456'): TokenResponse {
  return {
    access_token: createMockJWT({ tenant_id }),
    refresh_token: 'mock-refresh-token',
    token_type: 'bearer',
  };
}

/**
 * Auth endpoint handlers for MSW
 * These provide default successful responses that can be overridden per-test
 */
export const authHandlers = [
  // POST /auth/login - Login endpoint
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    // Simulate validation error for specific test email
    if (body.email === 'invalid@example.com') {
      return HttpResponse.json(
        { detail: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Return successful login response
    return HttpResponse.json(createTokenResponse());
  }),

  // POST /auth/signup - Signup endpoint
  http.post(`${API_BASE}/auth/signup`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string; name?: string };

    // Simulate duplicate email error
    if (body.email === 'existing@example.com') {
      return HttpResponse.json(
        { detail: 'Email already registered' },
        { status: 409 }
      );
    }

    // Simulate validation error
    if (body.email === 'invalid-email') {
      return HttpResponse.json(
        { detail: 'Invalid email format' },
        { status: 400 }
      );
    }

    // New users start without a tenant
    return HttpResponse.json(createTokenResponse(null));
  }),

  // POST /auth/logout - Logout endpoint
  http.post(`${API_BASE}/auth/logout`, () => {
    return HttpResponse.json({ ok: true });
  }),

  // POST /auth/refresh - Refresh token endpoint
  http.post(`${API_BASE}/auth/refresh`, () => {
    return HttpResponse.json(createTokenResponse());
  }),
];
