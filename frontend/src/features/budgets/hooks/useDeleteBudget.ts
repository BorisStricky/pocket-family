// src/features/budgets/hooks/useDeleteBudget.ts
// React Query mutation hook for deleting budgets

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteBudget } from '../api/budgetsApi';

/**
 * React Query mutation hook for deleting a budget
 *
 * Automatically invalidates all budget queries for the family on success
 * to ensure the deleted budget is removed from all list views. Uses partial
 * query key matching ['budgets', familyId] to invalidate all month/year
 * cache entries at once.
 *
 * The mutation accepts budgetId as a variable parameter, allowing the same
 * hook instance to delete different budgets without re-instantiating.
 *
 * @param familyId UUID of the family/tenant the budget belongs to
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example
 * const { mutate: removeBudget, isPending } = useDeleteBudget(familyId);
 *
 * const handleDelete = (budgetId: string) => {
 *   removeBudget(budgetId, {
 *     onSuccess: () => toast.success('Budget deleted'),
 *     onError: (error) => toast.error(error.message),
 *   });
 * };
 */
export function useDeleteBudget(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function accepts budgetId as parameter
    // This allows the same hook instance to delete any budget in the family
    mutationFn: (budgetId: string) => deleteBudget(familyId, budgetId),

    // On success, invalidate all budget queries for this family to trigger refetch
    // This ensures the deleted budget disappears from all month/year views
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budgets', familyId],
      });
    },
  });
}
