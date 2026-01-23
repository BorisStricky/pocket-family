// src/lib/apiClient.ts
// Centralized API fetch wrapper with auth token injection

import { STORAGE_KEYS, API_ENDPOINTS } from './constants';

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

// Module-level state for coordinating token refresh across concurrent requests
// This prevents race conditions when multiple API calls fail with 401 simultaneously
let isRefreshing = false; // Flag to prevent concurrent refresh attempts
let refreshPromise: Promise<string> | null = null; // Shared promise for in-flight refresh
let onAuthFailureCallback: (() => void) | null = null; // Callback to trigger logout

/**
 * Register a callback to execute when authentication completely fails
 * This allows the apiClient to trigger logout in AuthContext when refresh token is invalid/expired
 * Should be called once during app initialization in AuthContext
 *
 * @param callback Function to call when refresh token expires or is invalid
 */
export function setAuthFailureCallback(callback: () => void) {
  onAuthFailureCallback = callback;
}

/**
 * Internal function to refresh the access token using the refresh token cookie
 * This function is called by apiFetch when a 401 response is received
 *
 * Returns a shared promise if a refresh is already in progress to prevent race conditions
 * This ensures multiple concurrent 401 responses trigger only one refresh request
 *
 * @returns Promise that resolves to the new access token
 * @throws ApiError if refresh fails (invalid/expired refresh token)
 */
async function refreshAccessToken(): Promise<string> {
  // If already refreshing, return the existing promise to queue this request
  // This prevents multiple simultaneous refresh calls when several requests fail at once
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  // Set flag and create new promise
  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      // Call refresh endpoint (uses HttpOnly cookie automatically)
      // IMPORTANT: We must NOT use apiFetch here to avoid infinite recursion
      // if the refresh endpoint itself returns 401
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${base}${API_ENDPOINTS.REFRESH}`, {
        method: 'POST',
        credentials: 'include', // Send refresh token cookie
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Refresh failed - token is invalid or expired
        // Trigger auth failure callback to logout user
        throw new ApiError('Refresh token invalid', response.status, await response.json().catch(() => null));
      }

      const data = await response.json();
      const newAccessToken = data.access_token;

      // Store new access token in localStorage
      // Backend automatically rotates refresh token in HttpOnly cookie
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);

      return newAccessToken;
    } catch (error) {
      // Trigger auth failure callback (logout) when refresh fails
      // This handles expired refresh tokens or network errors gracefully
      if (onAuthFailureCallback) {
        onAuthFailureCallback();
      }

      throw error;
    } finally {
      // Reset state to allow future refresh attempts
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Extended RequestInit to include retry flag
 * The _isRetry flag prevents infinite loops by marking retry attempts
 */
interface ApiFetchInit extends RequestInit {
  _isRetry?: boolean;
}

/**
 * Fetch wrapper that:
 * - Reads VITE_API_URL from environment
 * - Automatically adds Authorization header from localStorage
 * - Handles JSON and text responses
 * - Automatically refreshes token on 401 and retries request
 * - Throws ApiError with status code on failure
 */
export async function apiFetch(path: string, init: ApiFetchInit = {}) {
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

  // Handle 204 No Content - no body to parse
  if (res.status === 204) {
    return { ok: true };
  }

  // Parse response based on Content-Type
  const ct = res.headers.get('content-type') || '';
  let payload: any = null;
  if (ct.includes('application/json')) {
    payload = await res.json();
  } else {
    payload = await res.text();
  }

  // Handle 401 Unauthorized with automatic token refresh
  // Only attempt refresh if this is not already a retry to prevent infinite loops
  if (res.status === 401 && !init._isRetry) {
    try {
      // Attempt to refresh the access token using the HttpOnly refresh token cookie
      // This call returns the new token from localStorage after storing it
      const newToken = await refreshAccessToken();

      // Retry the original request with the new token
      // Update the Authorization header with the fresh token
      const retryHeaders = new Headers(headers);
      retryHeaders.set('Authorization', `Bearer ${newToken}`);

      // Recursively call apiFetch with the retry flag set
      // This prevents infinite loops if the retry also returns 401
      return apiFetch(path, {
        ...init,
        headers: retryHeaders,
        _isRetry: true, // Mark as retry to prevent another refresh attempt
      });
    } catch (refreshError) {
      // Refresh failed - re-throw the original 401 error
      // The auth failure callback will have already been triggered to logout the user
      throw new ApiError(
        `API error ${res.status}`,
        res.status,
        payload
      );
    }
  }

  // Throw ApiError if not successful (for non-401 errors or retry failures)
  if (!res.ok) {
    throw new ApiError(
      `API error ${res.status}`,
      res.status,
      payload
    );
  }

  return payload;
}
