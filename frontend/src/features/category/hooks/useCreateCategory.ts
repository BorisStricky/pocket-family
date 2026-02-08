// src/features/category/hooks/useCreateCategory.ts
// React Query mutation hook for creating new categories

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCategory } from '../api/categoriesApi';
import type { CategoryCreate, CategoryRead } from '@/types/category';

/**
 * React Query hook for creating a new category
 *
 * Returns mutation function, loading state, and error state.
 * Automatically invalidates categories query cache on success to trigger refetch.
 * This ensures the category list shows the newly created category immediately.
 *
 * The hook accepts a familyId parameter for cache invalidation, ensuring the
 * correct family's category list is refreshed after creation.
 *
 * @param familyId UUID of family context (for cache invalidation)
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: createNewCategory, isPending } = useCreateCategory(familyId);
 *
 * const handleSubmit = (data: CategoryCreate) => {
 *   createNewCategory(data, {
 *     onSuccess: (category) => {
 *       toast.success('Category created');
 *       navigate(`/app/${familyId}/categories`);
 *     },
 *     onError: (error) => {
 *       toast.error(error.message);
 *     },
 *   });
 * };
 *
 * @example
 * // Create parent category
 * createNewCategory({
 *   name: 'Food',
 *   kind: 'expense',
 * });
 *
 * @example
 * // Create child category with parent relationship
 * createNewCategory({
 *   name: 'Groceries',
 *   kind: 'expense',
 *   parent_id: 'parent-category-uuid',
 * });
 */
export function useCreateCategory(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to create category
    mutationFn: (data: CategoryCreate): Promise<CategoryRead> => {
      return createCategory(data);
    },

    // On success, invalidate categories queries to trigger refetch
    // This ensures UI shows the new category in lists immediately
    onSuccess: () => {
      // Invalidate family-specific categories query
      // This refreshes the category list for the current family
      queryClient.invalidateQueries({
        queryKey: ['categories', familyId],
      });
    },
  });
}
