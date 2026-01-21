// src/features/auth/hooks/useSignup.ts
// React Query mutation hook for signup

import { useMutation } from '@tanstack/react-query';
import { signup } from '../api/authApi';
import { useAuth } from './useAuth';
import { getUserFromToken } from '@/lib/jwtUtils';
import type { SignupRequest } from '@/types';

/**
 * useSignup hook
 * Signup mutation with React Query
 * Automatically stores tokens and updates auth context on success
 *
 * @example
 * const signupMutation = useSignup();
 * signupMutation.mutate({ email: 'user@example.com', password: 'password123', name: 'John Doe' });
 */
export function useSignup() {
  const { setTokens, setUser } = useAuth();

  return useMutation({
    mutationFn: (data: SignupRequest) => signup(data),
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
