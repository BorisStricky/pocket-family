// src/features/family/hooks/useDeleteCategory.ts
// React Query mutation hook for deleting categories

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCategory } from '../api/categoriesApi';

/**
 * Parameters for deleting a category
 */
export interface DeleteCategoryParams {
  /** UUID of the category to delete */
  categoryId: string;
  /** Optional UUID of category to reassign transactions to */
  reassignTo?: string | null;
}

/**
 * React Query hook for deleting a category
 *
 * Returns mutation function, loading state, and error state.
 * Automatically invalidates categories list queries on success.
 *
 * Important constraints enforced by backend:
 * - Cannot delete a category that has child categories
 * - Backend returns 409 Conflict if category has children
 * - Must delete all children first before deleting parent
 *
 * If the category has transactions, you can optionally reassign those transactions
 * to another category by providing the reassignTo parameter.
 *
 * The hook accepts a familyId parameter for cache invalidation, ensuring the
 * correct family's category list is refreshed after deletion.
 *
 * @param familyId UUID of family context (for cache invalidation)
 * @returns Mutation object with mutate function and status flags
 *
 * @example
 * const { mutate: deleteExistingCategory, isPending } = useDeleteCategory(familyId);
 *
 * const handleDelete = (categoryId: string, reassignTo?: string) => {
 *   deleteExistingCategory({ categoryId, reassignTo }, {
 *     onSuccess: () => {
 *       toast.success('Category deleted');
 *       navigate(`/app/${familyId}/categories`);
 *     },
 *     onError: (error) => {
 *       // Backend returns 409 if category has children
 *       if (error.status === 409) {
 *         toast.error('Cannot delete category with subcategories. Delete children first.');
 *       } else {
 *         toast.error(error.message || 'Failed to delete category');
 *       }
 *     },
 *   });
 * };
 *
 * @example
 * // Delete a category and reassign its transactions
 * deleteExistingCategory({ categoryId: 'category-uuid', reassignTo: 'other-category-uuid' });
 */
export function useDeleteCategory(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function calls API to delete category with optional reassignment
    mutationFn: (params: DeleteCategoryParams): Promise<void> => {
      return deleteCategory(params.categoryId, params.reassignTo);
    },

    // On success, invalidate categories queries to remove deleted category from UI
    onSuccess: (_, params) => {
      // Invalidate family-specific categories query
      // This refreshes the category list for the current family
      queryClient.invalidateQueries({
        queryKey: ['categories', familyId],
      });

      // Also invalidate the specific category query (in case detail view is still mounted)
      queryClient.invalidateQueries({
        queryKey: ['categories', params.categoryId],
      });

      // Invalidate transactions queries as they may reference the deleted category
      // This prevents showing stale transaction data with orphaned category references
      queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });
    },
  });
}
