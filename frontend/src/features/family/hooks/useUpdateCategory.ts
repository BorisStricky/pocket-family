// src/features/family/hooks/useUpdateCategory.ts
// React Query mutation hook for updating existing categories

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCategory } from '../api/categoriesApi';
import type { CategoryUpdate, CategoryRead } from '@/types/category';

/**
 * React Query hook for updating an existing category
 *
 * Returns mutation function, loading state, and error state.
 * Automatically invalidates relevant query caches on success:
 * - The specific category query (for detail views)
 * - All categories list queries (for list views)
 *
 * The mutation accepts both categoryId and data as parameters, following
 * the pattern from accounts hooks for consistency.
 *
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: updateExistingCategory, isPending } = useUpdateCategory();
 *
 * const handleUpdate = (categoryId: string, data: CategoryUpdate) => {
 *   updateExistingCategory(
 *     { categoryId, data },
 *     {
 *       onSuccess: (category) => {
 *         toast.success('Category updated');
 *       },
 *       onError: (error) => {
 *         toast.error(error.message);
 *       },
 *     }
 *   );
 * };
 *
 * @example
 * // Update category name
 * updateExistingCategory({
 *   categoryId: 'category-uuid',
 *   data: { name: 'Updated Name' }
 * });
 *
 * @example
 * // Change parent relationship (convert to child category)
 * updateExistingCategory({
 *   categoryId: 'category-uuid',
 *   data: { parent_id: 'parent-uuid' }
 * });
 *
 * @example
 * // Remove parent relationship (convert to parent category)
 * updateExistingCategory({
 *   categoryId: 'category-uuid',
 *   data: { parent_id: null }
 * });
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to update category
    // Takes both categoryId and data as parameters
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: CategoryUpdate;
    }): Promise<CategoryRead> => {
      return updateCategory(categoryId, data);
    },

    // On success, invalidate queries to show updated data
    onSuccess: (updatedCategory) => {
      // Invalidate the specific category query (detail view)
      queryClient.invalidateQueries({
        queryKey: ['categories', updatedCategory.id],
      });

      // Invalidate all categories list queries
      // Using wildcard to catch ['categories', familyId] for all families
      // This ensures category lists are refreshed across all views
      queryClient.invalidateQueries({
        queryKey: ['categories'],
      });
    },
  });
}
