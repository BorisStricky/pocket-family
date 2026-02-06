// Unit tests for JWT decoding utilities
// Tests the client-side JWT parsing used by AuthContext

import { describe, it, expect } from 'vitest';
import { decodeJWT, getUserFromToken, isTokenExpired } from '../jwtUtils';
import { createMockJWT, createExpiredMockJWT } from '@/test/mocks/factories';

describe('jwtUtils', () => {
  describe('decodeJWT', () => {
    it('returns payload from a valid token', () => {
      const token = createMockJWT({
        sub: 'user-123',
        email: 'test@example.com',
        tenant_id: 'tenant-456',
        roles: ['owner'],
      });

      const payload = decodeJWT(token);

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('user-123');
      expect(payload!.email).toBe('test@example.com');
      expect(payload!.tenant_id).toBe('tenant-456');
      expect(payload!.roles).toEqual(['owner']);
    });

    it('still decodes an expired token (client does not validate expiry)', () => {
      const token = createExpiredMockJWT();

      const payload = decodeJWT(token);

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('user-uuid-123');
      // exp should be in the past
      expect(payload!.exp * 1000).toBeLessThan(Date.now());
    });

    it('returns null for a malformed token', () => {
      expect(decodeJWT('not-a-jwt')).toBeNull();
      expect(decodeJWT('')).toBeNull();
      expect(decodeJWT('only.two')).toBeNull();
    });
  });

  describe('getUserFromToken', () => {
    it('extracts User object from valid token', () => {
      const token = createMockJWT({
        sub: 'user-abc',
        email: 'user@test.com',
        tenant_id: 'tenant-xyz',
        roles: ['member'],
      });

      const user = getUserFromToken(token);

      expect(user).toEqual({
        id: 'user-abc',
        email: 'user@test.com',
        tenant_id: 'tenant-xyz',
        roles: ['member'],
      });
    });
  });

  describe('isTokenExpired', () => {
    it('returns false for a token expiring in the future', () => {
      const token = createMockJWT({ expiresInSeconds: 3600 });
      expect(isTokenExpired(token)).toBe(false);
    });

    it('returns true for a token that already expired', () => {
      const token = createExpiredMockJWT();
      expect(isTokenExpired(token)).toBe(true);
    });

    it('returns true for a malformed token (conservative)', () => {
      expect(isTokenExpired('garbage')).toBe(true);
    });
  });
});
