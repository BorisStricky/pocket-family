// src/features/auth/context/AuthContext.tsx
// Global authentication state management

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { getUserFromToken, isTokenExpired } from '@/lib/jwtUtils';
import { setAuthFailureCallback, refreshAccessToken } from '@/lib/apiClient';
import type { User, TokenResponse } from '@/types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setTokens: (tokens: TokenResponse) => void;
  clearAuth: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider component
 * Manages authentication state and token storage
 * Provides user, isAuthenticated, isLoading, and auth management functions
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, restore the session from localStorage or silently refresh the access token.
  // The access token is short-lived (15 min), but the HttpOnly refresh token cookie is valid
  // for 30 days. Without the silent refresh, returning users are redirected to /login every
  // time their access token has expired — even when they never explicitly logged out.
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const isValid = token && !isTokenExpired(token);

    if (isValid) {
      // Token is present and still fresh — decode it directly to avoid an unnecessary network call
      const userFromToken = getUserFromToken(token!);
      if (userFromToken) {
        setUser(userFromToken);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      }
      setIsLoading(false);
    } else {
      // Access token is missing or expired — try a silent refresh using the HttpOnly cookie.
      // Reuses the shared refreshAccessToken from apiClient which handles deduplication,
      // localStorage storage, and auth failure callbacks in one place.
      refreshAccessToken()
        .then((newToken) => {
          const userFromToken = getUserFromToken(newToken);
          if (userFromToken) setUser(userFromToken);
        })
        .catch(() => {
          // Both tokens are gone/expired — user must log in manually.
          // The auth failure callback in apiClient handles localStorage cleanup
          // for server-rejected tokens (401/403). For network errors we clean up here.
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    }
  }, []);

  /**
   * Store tokens in localStorage
   */
  const setTokens = useCallback((tokens: TokenResponse) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
    }
  }, []);

  /**
   * Clear authentication state and tokens
   */
  const clearAuth = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  }, []);

  // Register auth failure callback with apiClient on mount
  // This allows the API client to trigger logout when the refresh token expires or is invalid
  // Without this, users would see API errors instead of being redirected to login
  useEffect(() => {
    setAuthFailureCallback(() => {
      // Clear auth state — ProtectedRoute will automatically redirect to /login
      // when isAuthenticated becomes false. Avoid window.location.href which
      // hard-reloads the page and prevents showing any user feedback.
      clearAuth();
    });
  }, [clearAuth]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    setUser,
    setTokens,
    clearAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
