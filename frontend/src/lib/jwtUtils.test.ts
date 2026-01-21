// src/lib/jwtUtils.test.ts
// Tests for JWT decoding utilities

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { decodeJWT, getUserFromToken, isTokenExpired } from './jwtUtils';

// Helper to create mock JWT tokens
function createMockJWT(payload: any): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadEncoded = btoa(JSON.stringify(payload));
  return `${header}.${payloadEncoded}.signature`;
}

describe('jwtUtils', () => {
  describe('decodeJWT', () => {
    it('should decode valid JWT and extract payload', () => {
      const payload = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        roles: ['owner'],
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };
      const token = createMockJWT(payload);

      const result = decodeJWT(token);

      expect(result).toEqual(payload);
    });

    it('should return null for malformed token (not 3 parts)', () => {
      const malformedToken = 'header.payload'; // Missing signature

      const result = decodeJWT(malformedToken);

      expect(result).toBeNull();
    });

    it('should return null for invalid base64', () => {
      const invalidToken = 'invalid.!!!invalid!!!.signature';

      const result = decodeJWT(invalidToken);

      expect(result).toBeNull();
    });

    it('should return null for non-JWT string', () => {
      const notAToken = 'this-is-not-a-jwt-token';

      const result = decodeJWT(notAToken);

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = decodeJWT('');

      expect(result).toBeNull();
    });

    it('should handle payload with null tenant_id', () => {
      const payload = {
        sub: 'user-123',
        tenant_id: null,
        roles: ['owner'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = createMockJWT(payload);

      const result = decodeJWT(token);

      expect(result).toEqual(payload);
      expect(result?.tenant_id).toBeNull();
    });
  });

  describe('getUserFromToken', () => {
    it('should extract user with id, tenant_id, roles from valid token', () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        tenant_id: 'tenant-456',
        roles: ['owner'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = createMockJWT(payload);

      const user = getUserFromToken(token);

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        tenant_id: 'tenant-456',
        roles: ['owner'],
      });
    });

    it('should return null when JWT decode fails', () => {
      const invalidToken = 'invalid.token.here';

      const user = getUserFromToken(invalidToken);

      expect(user).toBeNull();
    });

    it('should handle missing optional fields (tenant_id)', () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        tenant_id: null,
        roles: ['member'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = createMockJWT(payload);

      const user = getUserFromToken(token);

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        tenant_id: null,
        roles: ['member'],
      });
    });

    it('should handle empty roles array', () => {
      const payload = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        roles: [],
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = createMockJWT(payload);

      const user = getUserFromToken(token);

      expect(user?.roles).toEqual([]);
    });
  });

  describe('isTokenExpired', () => {
    beforeEach(() => {
      // Reset Date.now mock before each test
      vi.restoreAllMocks();
    });

    it('should return true for expired token (exp in past)', () => {
      const payload = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        roles: ['owner'],
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      const token = createMockJWT(payload);

      const expired = isTokenExpired(token);

      expect(expired).toBe(true);
    });

    it('should return false for valid token (exp in future)', () => {
      const payload = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        roles: ['owner'],
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };
      const token = createMockJWT(payload);

      const expired = isTokenExpired(token);

      expect(expired).toBe(false);
    });

    it('should return true for token without exp field', () => {
      const payload = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        roles: ['owner'],
        // No exp field
      };
      const token = createMockJWT(payload);

      const expired = isTokenExpired(token);

      expect(expired).toBe(true);
    });

    it('should return true when decode fails', () => {
      const invalidToken = 'invalid.token.here';

      const expired = isTokenExpired(invalidToken);

      expect(expired).toBe(true);
    });

    it('should handle token expiring exactly now', () => {
      const now = Date.now();
      const payload = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        roles: ['owner'],
        exp: Math.floor(now / 1000), // Expires exactly now
      };
      const token = createMockJWT(payload);

      const expired = isTokenExpired(token);

      // Token expiring now should be considered expired
      expect(expired).toBe(true);
    });

    it('should handle token expiring 1 second from now', () => {
      const payload = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        roles: ['owner'],
        exp: Math.floor(Date.now() / 1000) + 1, // 1 second from now
      };
      const token = createMockJWT(payload);

      const expired = isTokenExpired(token);

      expect(expired).toBe(false);
    });
  });
});
