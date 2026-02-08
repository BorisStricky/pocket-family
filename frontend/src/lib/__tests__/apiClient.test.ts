// Unit tests for the centralized API fetch wrapper
// Tests auth header injection, error handling, and request formatting

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { apiFetch, ApiError } from '../apiClient';
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
