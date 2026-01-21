// src/features/auth/hooks/useLogout.ts
// React Query mutation hook for logout

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout } from '../api/authApi';
import { useAuth } from './useAuth';

/**
 * useLogout hook
 * Logout mutation with React Query
 * Clears tokens and auth context on success
 *
 * @example
 * const logoutMutation = useLogout();
 * logoutMutation.mutate();
 */
export function useLogout() {
  const { clearAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Call logout API to revoke refresh token
      // Backend reads refresh_token from HttpOnly cookie
      await logout();
    },
    onSettled: () => {
      // Clear ALL React Query cache to prevent cross-user data leaks
      // This ensures User 2 never sees User 1's cached families/transactions/etc
      queryClient.clear();
      // Clear auth state and access token (refresh token cookie is deleted by backend)
      clearAuth();
    },
  });
}
