// src/features/budgets/hooks/useUpdateBudget.ts
// React Query mutation hook for updating existing budgets

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBudget } from '../api/budgetsApi';
import type { BudgetUpdatePayload } from '../types';

/**
 * React Query mutation hook for updating an existing budget
 *
 * Automatically invalidates all budget queries for the family on success.
 * Uses partial query key matching ['budgets', familyId] to invalidate all
 * month/year combinations, since updating a budget's amount or categories
 * affects the spent-vs-limit display across all months.
 *
 * @param familyId UUID of the family/tenant the budget belongs to
 * @param budgetId UUID of the budget to update
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example
 * const { mutate: editBudget, isPending } = useUpdateBudget(familyId, budgetId);
 *
 * // Update budget amount and replace categories
 * editBudget(
 *   { amount: 750, category_ids: ['cat-1', 'cat-3'] },
 *   {
 *     onSuccess: () => toast.success('Budget updated'),
 *     onError: (error) => toast.error(error.message),
 *   }
 * );
 */
export function useUpdateBudget(familyId: string, budgetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function accepts partial BudgetUpdatePayload
    // Only provided fields will be updated on the backend
    mutationFn: (data: BudgetUpdatePayload) =>
      updateBudget(familyId, budgetId, data),

    // On success, invalidate all budget queries for this family to trigger refetch
    // This ensures budget lists across all months reflect the updated data
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budgets', familyId],
      });
    },
  });
}
