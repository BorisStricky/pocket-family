// src/types/index.ts
// Shared TypeScript types for the application

/**
 * Auth-related types based on OpenAPI spec
 */

// SignupIn schema
export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
}

// LoginIn schema
export interface LoginRequest {
  email: string;
  password: string;
}

// TokenOut schema
export interface TokenResponse {
  access_token: string;
  refresh_token?: string; // Only in test mode
  token_type: string; // "bearer"
}

/**
 * User information (decoded from JWT or from API)
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  created_at?: string;
  tenant_id?: string | null; // Current family/tenant ID from JWT
  roles?: string[]; // User roles from JWT (e.g., ["owner"])
}

/**
 * Supported UI language codes (BCP-47). Mirrors the backend's
 * SUPPORTED_LANGUAGES set so the two stay in sync.
 */
export type LanguageCode = 'en' | 'pt-BR';

/**
 * Authenticated user's own profile as returned by GET/PATCH /users/me.
 * Distinct from the JWT-decoded `User` above: this is the persisted,
 * server-authoritative profile (no tenant_id/roles, which are token claims).
 */
export interface CurrentUser {
  id: string;
  email: string;
  name?: string | null;
  language: LanguageCode;
  created_at: string;
}

/**
 * Request body for PATCH /users/me. Only self-editable preferences.
 */
export interface UserUpdate {
  language?: LanguageCode;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Re-export transaction types
 */
export * from './transaction';

/**
 * Re-export family/tenant types
 */
export * from './family';
