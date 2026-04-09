// src/features/family/hooks/useUpdateFamily.ts
// React Query mutation hook for updating a family/tenant's properties

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateFamily } from '../api/familyApi';
import type { TenantUpdate, TenantRead } from '@/types/family';

/**
 * React Query hook for updating a family's properties (name, default_currency).
 *
 * Only the family owner can call this. On success, the families list and the
 * individual family query are both invalidated so all consumers (FamilyContext,
 * TransactionForm preview, CurrencySettings) pick up the change immediately.
 *
 * @param familyId - The UUID of the family to update
 *
 * @example
 * const { mutate: updateFamilyCurrency, isPending } = useUpdateFamily(familyId);
 *
 * updateFamilyCurrency({ default_currency: 'USD' }, {
 *   onSuccess: () => toast.success('Default currency updated'),
 *   onError: (error) => toast.error(error.message),
 * });
 */
export function useUpdateFamily(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Call PATCH /tenants/{familyId} with the partial update payload
    mutationFn: (data: TenantUpdate): Promise<TenantRead> => {
      return updateFamily(familyId, data);
    },

    // Invalidate both the list and the individual record so all hooks that
    // depend on family data reflect the new default_currency without a full reload
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      queryClient.invalidateQueries({ queryKey: ['family', familyId] });
    },
  });
}
