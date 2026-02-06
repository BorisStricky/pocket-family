// src/features/family/hooks/useCreateFamily.ts
// React Query mutation hook for creating new families/tenants

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFamily } from '../api/familyApi';
import type { TenantCreate, TenantRead } from '@/types/family';

/**
 * React Query hook for creating a new family/tenant
 *
 * Returns mutation function, loading state, and error state.
 * On success, invalidates the families list query so the new family
 * appears immediately in the family selector.
 *
 * The creating user automatically becomes the owner of the new family.
 * After creation, the caller typically switches to the new family context.
 *
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: createNewFamily, isPending } = useCreateFamily();
 *
 * const handleSubmit = (name: string) => {
 *   createNewFamily({ name }, {
 *     onSuccess: (family) => {
 *       // Switch to the newly created family
 *       switchFamily(family.id);
 *       toast.success(`Family "${family.name}" created!`);
 *     },
 *     onError: (error) => {
 *       toast.error(error.message);
 *     },
 *   });
 * };
 */
export function useCreateFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to create a new family
    mutationFn: (data: TenantCreate): Promise<TenantRead> => {
      return createFamily(data);
    },

    // On success, invalidate families list so the new family appears in selectors
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['families'],
      });
    },
  });
}
