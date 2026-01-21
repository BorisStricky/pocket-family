// src/features/auth/api/authApi.ts
// Auth API functions for login, signup, logout, refresh token

import { apiFetch } from '@/lib/apiClient';
import { API_ENDPOINTS } from '@/lib/constants';
import type { LoginRequest, SignupRequest, TokenResponse } from '@/types';

/**
 * Login with email and password
 * POST /auth/login
 * Returns access_token and refresh_token
 */
export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  return apiFetch(API_ENDPOINTS.LOGIN, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

/**
 * Signup with email, password, and optional name
 * POST /auth/signup
 * Returns access_token and refresh_token
 */
export async function signup(data: SignupRequest): Promise<TokenResponse> {
  return apiFetch(API_ENDPOINTS.SIGNUP, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Logout and revoke refresh token
 * POST /auth/logout
 * Refresh token is read from HttpOnly cookie by backend
 * Returns { ok: true }
 */
export async function logout(): Promise<{ ok: boolean }> {
  return apiFetch(API_ENDPOINTS.LOGOUT, {
    method: 'POST',
  });
}

/**
 * Refresh access token using refresh token
 * POST /auth/refresh
 * Refresh token is read from HttpOnly cookie by backend
 * Returns new access_token and refresh_token
 */
export async function refreshToken(): Promise<TokenResponse> {
  return apiFetch(API_ENDPOINTS.REFRESH, {
    method: 'POST',
  });
}
