// src/test/mocks/factories/jwt.ts
// Factory functions for creating mock JWT tokens in tests

/**
 * JWT payload structure matching backend's token format
 */
interface MockJWTPayload {
  sub: string;           // user_id
  email: string;         // user email
  tenant_id: string | null; // family/tenant ID
  roles: string[];       // user roles
  exp: number;           // expiration timestamp in seconds
}

/**
 * Options for creating mock JWT tokens
 */
interface CreateMockJWTOptions {
  sub?: string;
  email?: string;
  tenant_id?: string | null;
  roles?: string[];
  expiresInSeconds?: number;
}

/**
 * Create a mock JWT token with customizable payload
 * The token follows the standard JWT format: header.payload.signature
 * WARNING: This creates a fake JWT for testing only - signature is not valid
 *
 * @example
 * const token = createMockJWT({ tenantId: 'family-123' });
 * const expiredToken = createMockJWT({ expiresInSeconds: -3600 }); // Expired 1 hour ago
 */
export function createMockJWT(options: CreateMockJWTOptions = {}): string {
  const {
    sub = 'user-uuid-123',
    email = 'test@example.com',
    tenant_id = 'tenant-uuid-456',
    roles = ['member'],
    expiresInSeconds = 3600, // Default: expires in 1 hour
  } = options;

  // Create JWT header (standard HS256)
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Create JWT payload with expiration
  const payload: MockJWTPayload = {
    sub,
    email,
    tenant_id,
    roles,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  // Encode header and payload as base64url
  // Note: We use a placeholder signature since we're not verifying tokens client-side
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Use a placeholder signature (tests don't verify signatures)
  const mockSignature = 'mock-signature-for-testing';

  return `${encodedHeader}.${encodedPayload}.${mockSignature}`;
}

/**
 * Create a valid (non-expired) mock JWT token
 * Convenience wrapper for common test case
 */
export function createValidMockJWT(tenant_id: string = 'tenant-uuid-456'): string {
  return createMockJWT({ tenant_id, expiresInSeconds: 3600 });
}

/**
 * Create an expired mock JWT token
 * Useful for testing token expiration handling
 */
export function createExpiredMockJWT(): string {
  return createMockJWT({ expiresInSeconds: -3600 }); // Expired 1 hour ago
}

/**
 * Create a mock JWT token with no tenant_id (null)
 * Useful for testing new users without family assignment
 */
export function createNoTenantMockJWT(): string {
  return createMockJWT({ tenant_id: null });
}
