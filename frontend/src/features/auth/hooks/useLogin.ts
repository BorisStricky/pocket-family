// src/features/auth/hooks/useLogin.ts
// React Query mutation hook for login

import { useMutation } from '@tanstack/react-query';
import { login } from '../api/authApi';
import { useAuth } from './useAuth';
import { getUserFromToken } from '@/lib/jwtUtils';
import type { LoginRequest } from '@/types';

/**
 * useLogin hook
 * Login mutation with React Query
 * Automatically stores tokens and updates auth context on success
 *
 * @example
 * const loginMutation = useLogin();
 * loginMutation.mutate({ email: 'user@example.com', password: 'password123' });
 */
export function useLogin() {
  const { setTokens, setUser } = useAuth();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => login(credentials),
    onSuccess: (data) => {
      // Store tokens
      setTokens(data);

      // Decode JWT to extract user info
      const user = getUserFromToken(data.access_token);
      if (user) {
        setUser(user);
      }
    },
  });
}
