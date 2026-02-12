// src/features/budgets/hooks/useCreateBudget.ts
// React Query mutation hook for creating new budgets

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBudget } from '../api/budgetsApi';
import type { BudgetCreatePayload } from '../types';

/**
 * React Query mutation hook for creating a new budget
 *
 * Automatically invalidates all budget queries for the family on success
 * to ensure list views reflect the newly created budget. Uses partial
 * query key matching ['budgets', familyId] to invalidate all month/year
 * combinations at once, since a new budget affects every month's view.
 *
 * @param familyId UUID of the family/tenant to create the budget in
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example
 * const { mutate: addBudget, isPending } = useCreateBudget(familyId);
 *
 * addBudget(
 *   { name: 'Entertainment', amount: 500, category_ids: ['cat-1', 'cat-2'] },
 *   {
 *     onSuccess: (budget) => toast.success(`Budget "${budget.name}" created`),
 *     onError: (error) => toast.error(error.message),
 *   }
 * );
 */
export function useCreateBudget(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function accepts BudgetCreatePayload
    // Backend infers tenant_id from JWT; familyId kept for API function signature consistency
    mutationFn: (data: BudgetCreatePayload) => createBudget(familyId, data),

    // On success, invalidate all budget queries for this family to trigger refetch
    // Partial key ['budgets', familyId] matches all month/year cache entries
    // so every visible budget list updates automatically
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['budgets', familyId],
      });
    },
  });
}
