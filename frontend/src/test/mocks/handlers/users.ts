// src/test/mocks/handlers/users.ts
// MSW handlers for the current-user profile endpoints (/users/me).

import { http, HttpResponse } from 'msw';
import type { CurrentUser, LanguageCode } from '@/types';

// Base URL for API requests (matches vitest.config.ts define)
const API_BASE = 'http://localhost:8000';

// Default profile returned by GET /users/me. Mirrors the backend default of
// English so tests that don't touch language see the expected baseline.
const DEFAULT_CURRENT_USER: CurrentUser = {
  id: 'user-uuid-123',
  email: 'test@example.com',
  name: 'Test User',
  language: 'en',
  created_at: '2026-01-01T00:00:00Z',
};

// In-memory store so a PATCH is reflected by a subsequent GET within a test.
let currentUserStore: CurrentUser = { ...DEFAULT_CURRENT_USER };

/**
 * Reset the user store to its default. Call in beforeEach for isolation.
 */
export function resetUserStore(): void {
  currentUserStore = { ...DEFAULT_CURRENT_USER };
}

export const userHandlers = [
  // GET /users/me - return the current user's profile
  http.get(`${API_BASE}/users/me`, () => {
    return HttpResponse.json(currentUserStore);
  }),

  // PATCH /users/me - update self-editable preferences (language)
  http.patch(`${API_BASE}/users/me`, async ({ request }) => {
    const body = (await request.json()) as { language?: LanguageCode };
    if (body.language) {
      currentUserStore = { ...currentUserStore, language: body.language };
    }
    return HttpResponse.json(currentUserStore);
  }),
];
