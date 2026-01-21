// src/lib/jwtUtils.ts
// JWT decoding utilities (client-side only, no verification)

import type { User } from '@/types';

/**
 * JWT payload structure from backend
 */
export interface JWTPayload {
  sub: string; // user_id
  email: string; // user email
  tenant_id: string | null; // family/tenant ID
  roles: string[]; // user roles (e.g., ["owner"])
  exp: number; // expiration timestamp
}

/**
 * Decode JWT token (client-side, no verification)
 * WARNING: This does NOT verify the signature. Never use for security checks.
 * Only use for extracting user info from tokens already validated by backend.
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (base64url)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JWTPayload;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Extract user info from JWT token
 */
export function getUserFromToken(token: string): User | null {
  const payload = decodeJWT(token);
  if (!payload) {
    return null;
  }

  return {
    id: payload.sub,
    email: payload.email,
    tenant_id: payload.tenant_id,
    roles: payload.roles,
  };
}

/**
 * Check if JWT token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }

  // exp is in seconds, Date.now() is in milliseconds
  return payload.exp * 1000 < Date.now();
}
