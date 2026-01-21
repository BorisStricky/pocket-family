// src/features/auth/hooks/useLogout.test.tsx
// Tests for the useLogout mutation hook
// Uses MSW handlers for /auth/logout endpoint

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLogout } from './useLogout';
import { createTestQueryClient, TestWrapper } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { STORAGE_KEYS } from '@/lib/constants';

describe('useLogout', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should successfully logout and clear tokens', async () => {
    // Arrange - Set up authenticated state with tokens
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'test-access-token');
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'test-refresh-token');

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger logout mutation
    const { result } = renderHook(() => useLogout(), { wrapper });

    result.current.mutate();

    // Assert - Wait for mutation to succeed
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify tokens are cleared from localStorage
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
  });

  it('should clear tokens even when logout API fails (401)', async () => {
    // Arrange - Set up authenticated state
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'test-access-token');
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'test-refresh-token');

    // Override MSW handler to return 401 error
    server.use(
      http.post('http://localhost:8000/auth/logout', () => {
        return HttpResponse.json(
          { detail: 'Unauthorized' },
          { status: 401 }
        );
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger logout
    const { result } = renderHook(() => useLogout(), { wrapper });

    result.current.mutate();

    // Assert - Wait for mutation to error
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Verify tokens are STILL cleared (logout always clears locally)
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
  });

  it('should clear tokens even when logout API fails (500)', async () => {
    // Arrange - Set up authenticated state
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'test-access-token');
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'test-refresh-token');

    // Override MSW handler to return 500 error
    server.use(
      http.post('http://localhost:8000/auth/logout', () => {
        return HttpResponse.json(
          { detail: 'Internal server error' },
          { status: 500 }
        );
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger logout
    const { result } = renderHook(() => useLogout(), { wrapper });

    result.current.mutate();

    // Assert - Wait for mutation to error
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Verify tokens are cleared despite server error
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
  });

  it('should preserve other localStorage items when logging out', async () => {
    // Arrange - Set up auth tokens and other data
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'test-access-token');
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'test-refresh-token');
    localStorage.setItem('user_preferences', JSON.stringify({ theme: 'dark' }));
    localStorage.setItem('other_data', 'should-persist');

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger logout
    const { result } = renderHook(() => useLogout(), { wrapper });

    result.current.mutate();

    // Assert - Wait for completion
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify only auth tokens are cleared
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
    expect(localStorage.getItem('user_preferences')).toBe(JSON.stringify({ theme: 'dark' }));
    expect(localStorage.getItem('other_data')).toBe('should-persist');
  });

  it('should call POST /auth/logout', async () => {
    // Arrange - Track if endpoint was called
    let wasEndpointCalled = false;
    server.use(
      http.post('http://localhost:8000/auth/logout', () => {
        wasEndpointCalled = true;
        return HttpResponse.json({ ok: true });
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger logout
    const { result } = renderHook(() => useLogout(), { wrapper });

    result.current.mutate();

    // Assert - Wait for completion and verify endpoint was called
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(wasEndpointCalled).toBe(true);
  });

  it('should handle logout when no tokens exist', async () => {
    // Arrange - No tokens in localStorage
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger logout anyway
    const { result } = renderHook(() => useLogout(), { wrapper });

    result.current.mutate();

    // Assert - Should complete successfully (no-op is fine)
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Tokens still null
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
  });

  it('should track mutation states: idle → success', async () => {
    // Arrange - Create wrapper
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook
    const { result } = renderHook(() => useLogout(), { wrapper });

    // Assert initial state - idle
    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);

    // Act - Trigger mutation
    result.current.mutate();

    // Assert success state (skip pending check - too fast in tests)
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
    });
  });

  it('should track mutation states when API errors', async () => {
    // Arrange - Override to return error
    server.use(
      http.post('http://localhost:8000/auth/logout', () => {
        return HttpResponse.json(
          { detail: 'Server error' },
          { status: 500 }
        );
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook
    const { result } = renderHook(() => useLogout(), { wrapper });

    // Assert initial state
    expect(result.current.isError).toBe(false);

    // Act - Trigger mutation
    result.current.mutate();

    // Assert error state (skip pending check - too fast in tests)
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.isPending).toBe(false);
      expect(result.current.isSuccess).toBe(false);
    });
  });

  it('should handle network failure gracefully', async () => {
    // Arrange - Set up authenticated state
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'test-access-token');
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'test-refresh-token');

    // Override MSW handler to simulate network failure
    server.use(
      http.post('http://localhost:8000/auth/logout', () => {
        return HttpResponse.error();
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger logout
    const { result } = renderHook(() => useLogout(), { wrapper });

    result.current.mutate();

    // Assert - Even with network failure, tokens should be cleared locally
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Verify local tokens are cleared despite network error
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
  });
});
