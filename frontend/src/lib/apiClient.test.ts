// src/lib/apiClient.test.ts
// Tests for the centralized API fetch wrapper
// Uses global fetch mocking (not MSW) because we're testing the fetch wrapper itself

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from './apiClient';
import { STORAGE_KEYS } from './constants';

describe('apiClient', () => {
  // Store original fetch to restore after tests
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Create a fresh mock for each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('apiFetch', () => {
    it('should make a GET request with default settings', async () => {
      // Arrange - Mock successful JSON response
      const mockData = { id: 1, name: 'Test' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
      });

      // Act - Call apiFetch
      const result = await apiFetch('/test');

      // Assert - Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/test',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.any(Headers),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should construct URL from VITE_API_URL environment variable', async () => {
      // Arrange - Mock response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      // Act - Call apiFetch (uses VITE_API_URL from vitest.config.ts define)
      await apiFetch('/users');

      // Assert - Verify URL construction
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/users',
        expect.any(Object)
      );
    });

    it('should inject Authorization header when token exists in localStorage', async () => {
      // Arrange - Set token in localStorage
      const testToken = 'test-access-token-12345';
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, testToken);

      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      // Act - Call apiFetch
      await apiFetch('/protected');

      // Assert - Verify Authorization header was set
      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers as Headers;
      expect(headers.get('Authorization')).toBe(`Bearer ${testToken}`);
    });

    it('should not set Authorization header when no token in localStorage', async () => {
      // Arrange - Ensure no token
      localStorage.clear();

      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      // Act - Call apiFetch
      await apiFetch('/public');

      // Assert - Verify no Authorization header
      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers as Headers;
      expect(headers.get('Authorization')).toBeNull();
    });

    it('should always set credentials: include for cookies', async () => {
      // Arrange - Mock response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      // Act - Call apiFetch
      await apiFetch('/test');

      // Assert - Verify credentials: include
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should set Content-Type to application/json by default', async () => {
      // Arrange - Mock response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      // Act - Call apiFetch with body
      await apiFetch('/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      });

      // Assert - Verify Content-Type header
      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should not set Content-Type for FormData', async () => {
      // Arrange - Mock response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      const formData = new FormData();
      formData.append('file', 'test');

      // Act - Call apiFetch with FormData
      await apiFetch('/upload', {
        method: 'POST',
        body: formData,
      });

      // Assert - Verify Content-Type is not set (browser sets it with boundary)
      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers as Headers;
      // Browser automatically sets multipart/form-data with boundary for FormData
      expect(headers.get('Content-Type')).toBeNull();
    });

    it('should parse JSON responses', async () => {
      // Arrange - Mock JSON response
      const mockData = { id: 1, email: 'test@example.com' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
      });

      // Act - Call apiFetch
      const result = await apiFetch('/user');

      // Assert - Verify JSON parsing
      expect(result).toEqual(mockData);
    });

    it('should parse text responses', async () => {
      // Arrange - Mock text response
      const mockText = 'Plain text response';
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => mockText,
      });

      // Act - Call apiFetch
      const result = await apiFetch('/status');

      // Assert - Verify text parsing
      expect(result).toBe(mockText);
    });

    it('should throw ApiError with status and body on HTTP error', async () => {
      // Arrange - Mock 400 error response
      const errorBody = { detail: 'Validation failed' };
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => errorBody,
      });

      // Act & Assert - Verify ApiError is thrown
      await expect(apiFetch('/invalid')).rejects.toThrow(ApiError);
      await expect(apiFetch('/invalid')).rejects.toThrow('API error 400');

      try {
        await apiFetch('/invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.body).toEqual(errorBody);
      }
    });

    it('should throw ApiError on 401 unauthorized', async () => {
      // Arrange - Mock 401 response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Unauthorized' }),
      });

      // Act & Assert - Verify 401 handling
      await expect(apiFetch('/protected')).rejects.toThrow(ApiError);

      try {
        await apiFetch('/protected');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(401);
      }
    });

    it('should throw ApiError on 403 forbidden', async () => {
      // Arrange - Mock 403 response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Forbidden' }),
      });

      // Act & Assert - Verify 403 handling
      try {
        await apiFetch('/admin');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(403);
      }
    });

    it('should throw ApiError on 500 server error', async () => {
      // Arrange - Mock 500 response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Internal server error' }),
      });

      // Act & Assert - Verify 500 handling
      try {
        await apiFetch('/broken');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(500);
      }
    });

    it('should handle network failures', async () => {
      // Arrange - Mock network error
      (global.fetch as any).mockRejectedValue(new TypeError('Network request failed'));

      // Act & Assert - Verify network error handling
      await expect(apiFetch('/test')).rejects.toThrow(TypeError);
      await expect(apiFetch('/test')).rejects.toThrow('Network request failed');
    });

    it('should handle absolute URLs without prepending base', async () => {
      // Arrange - Mock response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      // Act - Call apiFetch with absolute URL
      await apiFetch('https://external-api.com/data');

      // Assert - Verify absolute URL is used as-is
      expect(global.fetch).toHaveBeenCalledWith(
        'https://external-api.com/data',
        expect.any(Object)
      );
    });
  });
});
