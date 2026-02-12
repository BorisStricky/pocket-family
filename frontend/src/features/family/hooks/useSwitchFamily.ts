// src/features/family/hooks/useSwitchFamily.ts
// React Query mutation hook for switching families

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { switchFamily } from '../api/familyApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { STORAGE_KEYS } from '@/lib/constants';
import type { TokenResponse } from '@/types';

/**
 * Switch to a different family context
 * Mutation that calls POST /tenants/{tenant_id}/switch
 * On success:
 * - Stores new access token in localStorage
 * - Updates auth context with new user from token
 * - Invalidates family queries to refresh data
 * - Navigates to /app/:familyId/dashboard
 */
export function useSwitchFamily() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setTokens } = useAuth();

  return useMutation<TokenResponse, Error, string>({
    mutationFn: (familyId: string) => switchFamily(familyId),
    onSuccess: (data, familyId) => {
      // Store new token in localStorage (apiFetch will use it automatically)
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);

      // Update auth context with new token data
      // This decodes the JWT and updates the user object with new tenant_id
      setTokens(data);

      // Invalidate family queries to refresh with new context
      queryClient.invalidateQueries({ queryKey: ['families'] });
      queryClient.invalidateQueries({ queryKey: ['family'] });

      // Navigate to dashboard of the new family
      navigate(`/app/${familyId}/dashboard`);
    },
  });
}
