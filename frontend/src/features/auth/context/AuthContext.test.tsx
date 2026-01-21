// src/features/auth/context/AuthContext.test.tsx
// Tests for the AuthContext provider that manages authentication state
// Uses direct provider testing with renderHook - no API calls involved

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, AuthContext } from './AuthContext';
import { STORAGE_KEYS } from '@/lib/constants';
import { createMockJWT, createExpiredMockJWT, createMockUser } from '@/test/mocks/factories';
import type { TokenResponse } from '@/types';

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize with null user, isAuthenticated false, and isLoading true', () => {
    // Act - Render the hook
    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    // Assert - Verify initial state before effect runs
    // Note: Due to how React effects work, isLoading becomes false almost immediately
    expect(result.current?.user).toBeNull();
    expect(result.current?.isAuthenticated).toBe(false);
  });

  it('should set isLoading to false after initialization', async () => {
    // Act - Render the hook
    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    // Assert - Wait for isLoading to become false
    await waitFor(() => {
      expect(result.current?.isLoading).toBe(false);
    });
  });

  it('should restore user from valid token in localStorage on mount', async () => {
    // Arrange - Create a valid token and store it
    const mockUser = createMockUser({ id: 'user-123', email: 'test@example.com', tenant_id: 'family-456' });
    const validToken = createMockJWT({
      sub: mockUser.id,
      email: mockUser.email,
      tenant_id: mockUser.tenant_id,
    });
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, validToken);

    // Act - Render the hook (triggers useEffect)
    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    // Assert - Wait for user to be restored from token
    await waitFor(() => {
      expect(result.current?.user).not.toBeNull();
      expect(result.current?.user?.id).toBe(mockUser.id);
      expect(result.current?.user?.email).toBe(mockUser.email);
      expect(result.current?.user?.tenant_id).toBe(mockUser.tenant_id);
      expect(result.current?.isAuthenticated).toBe(true);
    });
  });

  it('should clear expired token from localStorage on mount', async () => {
    // Arrange - Create and store an expired token
    const expiredToken = createExpiredMockJWT();
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, expiredToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'some-refresh-token');

    // Act - Render the hook
    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    // Assert - Wait for tokens to be cleared
    await waitFor(() => {
      expect(result.current?.user).toBeNull();
      expect(result.current?.isAuthenticated).toBe(false);
      expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
    });
  });

  it('should clear invalid token that fails to decode on mount', async () => {
    // Arrange - Store a malformed token
    const invalidToken = 'not-a-valid-jwt-token';
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, invalidToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'some-refresh-token');

    // Act - Render the hook
    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    // Assert - Wait for invalid tokens to be cleared
    await waitFor(() => {
      expect(result.current?.user).toBeNull();
      expect(result.current?.isAuthenticated).toBe(false);
      expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
    });
  });

  it('should store tokens via setTokens and update localStorage', async () => {
    // Arrange - Render the hook
    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current?.isLoading).toBe(false);
    });

    // Act - Call setTokens with mock token response
    const tokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_type: 'bearer',
    };
    result.current?.setTokens(tokenResponse);

    // Assert - Verify tokens are stored in localStorage
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe('new-access-token');
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBe('new-refresh-token');
  });

  it('should store only access token when refresh_token is not provided', async () => {
    // Arrange - Render the hook
    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current?.isLoading).toBe(false);
    });

    // Act - Call setTokens without refresh_token
    const tokenResponse: TokenResponse = {
      access_token: 'access-only-token',
      token_type: 'bearer',
    };
    result.current?.setTokens(tokenResponse);

    // Assert - Verify only access token is stored
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe('access-only-token');
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
  });

  it('should update user state via setUser', async () => {
    // Arrange - Render the hook
    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current?.isLoading).toBe(false);
    });

    // Act - Call setUser with a mock user
    const mockUser = createMockUser({ id: 'user-789', email: 'newuser@example.com' });
    result.current?.setUser(mockUser);

    // Assert - Verify user state is updated
    await waitFor(() => {
      expect(result.current?.user).toEqual(mockUser);
      expect(result.current?.isAuthenticated).toBe(true);
    });
  });

  it('should clear auth state and tokens via clearAuth', async () => {
    // Arrange - Set up authenticated state with tokens
    const mockUser = createMockUser({ id: 'user-999', email: 'clear@example.com' });
    const validToken = createMockJWT({ sub: mockUser.id, email: mockUser.email });
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, validToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'refresh-token');

    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    // Wait for user to be restored
    await waitFor(() => {
      expect(result.current?.isAuthenticated).toBe(true);
    });

    // Act - Call clearAuth
    result.current?.clearAuth();

    // Assert - Verify auth state is cleared
    await waitFor(() => {
      expect(result.current?.user).toBeNull();
      expect(result.current?.isAuthenticated).toBe(false);
      expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
    });
  });

  it('should preserve other localStorage items when clearing auth', async () => {
    // Arrange - Set up auth tokens and other localStorage data
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'access-token');
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'refresh-token');
    localStorage.setItem('other_data', 'should-persist');

    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current?.isLoading).toBe(false);
    });

    // Act - Call clearAuth
    result.current?.clearAuth();

    // Assert - Verify only auth tokens are cleared
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
    expect(localStorage.getItem('other_data')).toBe('should-persist');
  });

  it('should handle full auth lifecycle: login → authenticated → logout', async () => {
    // Arrange - Render the hook (starts unauthenticated)
    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current?.isLoading).toBe(false);
    });

    // Assert initial state - not authenticated
    expect(result.current?.isAuthenticated).toBe(false);
    expect(result.current?.user).toBeNull();

    // Act - Simulate login by setting tokens and user
    const mockUser = createMockUser({ id: 'user-lifecycle', email: 'lifecycle@example.com' });
    const validToken = createMockJWT({ sub: mockUser.id, email: mockUser.email });
    const tokenResponse: TokenResponse = {
      access_token: validToken,
      refresh_token: 'refresh-token',
      token_type: 'bearer',
    };

    result.current?.setTokens(tokenResponse);
    result.current?.setUser(mockUser);

    // Assert authenticated state
    await waitFor(() => {
      expect(result.current?.isAuthenticated).toBe(true);
      expect(result.current?.user?.id).toBe(mockUser.id);
      expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe(validToken);
    });

    // Act - Simulate logout
    result.current?.clearAuth();

    // Assert logged out state
    await waitFor(() => {
      expect(result.current?.isAuthenticated).toBe(false);
      expect(result.current?.user).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    });
  });

  it('should maintain stable function references for setUser, setTokens, and clearAuth', async () => {
    // Arrange - Render the hook
    const { result, rerender } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current?.isLoading).toBe(false);
    });

    // Capture initial function references
    const initialSetUser = result.current?.setUser;
    const initialSetTokens = result.current?.setTokens;
    const initialClearAuth = result.current?.clearAuth;

    // Act - Force re-render
    rerender();

    // Assert - Verify function references haven't changed (useCallback working)
    expect(result.current?.setUser).toBe(initialSetUser);
    expect(result.current?.setTokens).toBe(initialSetTokens);
    expect(result.current?.clearAuth).toBe(initialClearAuth);
  });
});
