// src/lib/apiClient.ts
// Centralized API fetch wrapper with auth token injection

import { STORAGE_KEYS } from './constants';

/**
 * Custom API error class with status code and response body
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetch wrapper that:
 * - Reads VITE_API_URL from environment
 * - Automatically adds Authorization header from localStorage
 * - Handles JSON and text responses
 * - Throws ApiError with status code on failure
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const url = path.startsWith('http') ? path : `${base.replace(/\/$/, '')}${path}`;

  const headers = new Headers(init.headers || {});

  // Inject auth token if available
  const token = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set Content-Type to JSON by default (unless FormData)
  if (!(init.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  // Include credentials (cookies) with requests for HttpOnly refresh_token
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include'  // Send cookies with cross-origin requests
  });

  // Parse response based on Content-Type
  const ct = res.headers.get('content-type') || '';
  let payload: any = null;
  if (ct.includes('application/json')) {
    payload = await res.json();
  } else {
    payload = await res.text();
  }

  // Throw ApiError if not successful
  if (!res.ok) {
    throw new ApiError(
      `API error ${res.status}`,
      res.status,
      payload
    );
  }

  return payload;
}
