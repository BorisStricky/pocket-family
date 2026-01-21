// src/features/auth/hooks/useAuth.ts
// Hook to access auth context

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * useAuth hook
 * Access authentication state and methods
 *
 * @example
 * const { user, isAuthenticated, isLoading, setUser, setTokens, clearAuth } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
