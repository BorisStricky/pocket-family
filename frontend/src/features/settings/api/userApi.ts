// src/features/settings/api/userApi.ts
// API functions for the authenticated user's own profile/preferences.

import { apiFetch } from '@/lib/apiClient';
import { API_ENDPOINTS } from '@/lib/constants';
import type { CurrentUser, LanguageCode } from '@/types';

/**
 * Fetch the authenticated user's profile (GET /users/me).
 * Used on app load to restore the server-side language preference.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch(API_ENDPOINTS.USERS_ME) as Promise<CurrentUser>;
}

/**
 * Persist a new preferred language for the authenticated user
 * (PATCH /users/me). Returns the updated profile.
 */
export async function updateLanguage(language: LanguageCode): Promise<CurrentUser> {
  return apiFetch(API_ENDPOINTS.USERS_ME, {
    method: 'PATCH',
    body: JSON.stringify({ language }),
  }) as Promise<CurrentUser>;
}
