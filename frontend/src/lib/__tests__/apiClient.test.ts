// Unit tests for the centralized API fetch wrapper
// Tests auth header injection, error handling, and request formatting

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { apiFetch, ApiError, setAuthFailureCallback } from '../apiClient';
import { STORAGE_KEYS } from '../constants';
import { createMockJWT } from '@/test/mocks/factories';

const API_BASE = 'http://localhost:8000';

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('includes Authorization header from localStorage token', async () => {
    const token = createMockJWT();
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);

    // MSW handler that echoes back the Authorization header
    let capturedAuthHeader: string | null = null;
    server.use(
      http.get(`${API_BASE}/test`, ({ request }) => {
        capturedAuthHeader = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      })
    );

    await apiFetch('/test');

    expect(capturedAuthHeader).toBe(`Bearer ${token}`);
  });

  it('throws ApiError with message on non-401 error responses', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, createMockJWT());

    server.use(
      http.get(`${API_BASE}/test`, () => {
        return HttpResponse.json(
          { detail: 'Resource not found' },
          { status: 404 }
        );
      })
    );

    await expect(apiFetch('/test')).rejects.toThrow(ApiError);

    try {
      await apiFetch('/test');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).message).toBe('Resource not found');
    }
  });

  it('sends POST body with Content-Type application/json', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, createMockJWT());

    let capturedBody: unknown = null;
    let capturedContentType: string | null = null;

    server.use(
      http.post(`${API_BASE}/test`, async ({ request }) => {
        capturedContentType = request.headers.get('Content-Type');
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'new-item' }, { status: 201 });
      })
    );

    const result = await apiFetch('/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Item', amount: 100 }),
    });

    expect(capturedContentType).toBe('application/json');
    expect(capturedBody).toEqual({ name: 'Test Item', amount: 100 });
    expect(result).toEqual({ id: 'new-item' });
  });

  it('handles 204 No Content responses', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, createMockJWT());

    server.use(
      http.delete(`${API_BASE}/test/123`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    const result = await apiFetch('/test/123', { method: 'DELETE' });
    expect(result).toEqual({ ok: true });
  });
});

// The 401 → refresh → retry machinery and its module-level concurrency state
// (isRefreshing / refreshPromise) are the most security-sensitive part of the
// client and were previously only touched incidentally by page-level tests.
// These exercise the refresh paths directly.
describe('apiFetch 401 refresh + retry', () => {
  const OLD_TOKEN = createMockJWT({ sub: 'old' });
  const NEW_TOKEN = createMockJWT({ sub: 'refreshed' });

  beforeEach(() => {
    localStorage.clear();
    // Start each test as if the stored access token is stale.
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, OLD_TOKEN);
    // Reset the module-level logout callback so assertions are per-test.
    setAuthFailureCallback(() => {});
  });

  it('refreshes the token on 401 then retries the original request with it', async () => {
    // Protected endpoint: 401 unless the request carries the refreshed token.
    server.use(
      http.get(`${API_BASE}/protected`, ({ request }) => {
        const authorization = request.headers.get('Authorization');
        if (authorization === `Bearer ${NEW_TOKEN}`) {
          return HttpResponse.json({ data: 'ok' });
        }
        return HttpResponse.json({ detail: 'expired' }, { status: 401 });
      }),
      http.post(`${API_BASE}/auth/refresh`, () => {
        return HttpResponse.json({ access_token: NEW_TOKEN });
      })
    );

    const result = await apiFetch('/protected');

    // The retry succeeded, and the refreshed token is now stored.
    expect(result).toEqual({ data: 'ok' });
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe(NEW_TOKEN);
  });

  it('refreshes only once when several requests get 401 concurrently', async () => {
    let refreshCallCount = 0;

    server.use(
      http.get(`${API_BASE}/protected`, ({ request }) => {
        const authorization = request.headers.get('Authorization');
        if (authorization === `Bearer ${NEW_TOKEN}`) {
          return HttpResponse.json({ data: 'ok' });
        }
        return HttpResponse.json({ detail: 'expired' }, { status: 401 });
      }),
      http.post(`${API_BASE}/auth/refresh`, async () => {
        refreshCallCount += 1;
        // A small delay keeps the refresh in-flight so the other 401s dedupe
        // onto the shared refreshPromise instead of starting their own.
        await new Promise((resolve) => setTimeout(resolve, 20));
        return HttpResponse.json({ access_token: NEW_TOKEN });
      })
    );

    // Five simultaneous requests all see a 401 at once.
    const results = await Promise.all([
      apiFetch('/protected'),
      apiFetch('/protected'),
      apiFetch('/protected'),
      apiFetch('/protected'),
      apiFetch('/protected'),
    ]);

    expect(results).toEqual([
      { data: 'ok' },
      { data: 'ok' },
      { data: 'ok' },
      { data: 'ok' },
      { data: 'ok' },
    ]);
    // The shared refresh promise means exactly one refresh request was made.
    expect(refreshCallCount).toBe(1);
  });

  it('invokes the logout callback when the refresh itself is rejected', async () => {
    const onAuthFailure = vi.fn();
    setAuthFailureCallback(onAuthFailure);

    server.use(
      http.get(`${API_BASE}/protected`, () => {
        return HttpResponse.json({ detail: 'expired' }, { status: 401 });
      }),
      http.post(`${API_BASE}/auth/refresh`, () => {
        // Refresh token is invalid/expired — the server definitively rejects it.
        return HttpResponse.json({ detail: 'invalid refresh' }, { status: 401 });
      })
    );

    await expect(apiFetch('/protected')).rejects.toThrow(ApiError);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('does NOT log out when the refresh fails with a transient network error', async () => {
    const onAuthFailure = vi.fn();
    setAuthFailureCallback(onAuthFailure);

    server.use(
      http.get(`${API_BASE}/protected`, () => {
        return HttpResponse.json({ detail: 'expired' }, { status: 401 });
      }),
      // A network-level failure (not a 401/403) must not force a logout, since
      // the refresh token may still be valid — the request just didn't arrive.
      http.post(`${API_BASE}/auth/refresh`, () => HttpResponse.error())
    );

    await expect(apiFetch('/protected')).rejects.toThrow();
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('does NOT attempt a refresh when a login request returns 401', async () => {
    let refreshCallCount = 0;

    server.use(
      http.post(`${API_BASE}/auth/login`, () => {
        // 401 here means bad credentials, not an expired access token.
        return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
      }),
      http.post(`${API_BASE}/auth/refresh`, () => {
        refreshCallCount += 1;
        return HttpResponse.json({ access_token: NEW_TOKEN });
      })
    );

    await expect(
      apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.c', password: 'wrong' }),
      })
    ).rejects.toThrow(ApiError);
    // The credential-endpoint guard means no refresh was triggered.
    expect(refreshCallCount).toBe(0);
  });
});
