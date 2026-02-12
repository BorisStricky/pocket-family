// src/features/budgets/hooks/useBudgets.ts
// React Query hook for fetching list of budgets with optional month/year filter

import { useQuery } from '@tanstack/react-query';
import { getBudgets } from '../api/budgetsApi';

/**
 * React Query hook for fetching budgets for a tenant
 *
 * Query key structure: ['budgets', familyId, month, year]
 * This structure ensures proper cache isolation per family and month/year combination.
 * Different month/year selections create separate cache entries so navigating
 * between months is instant after the first fetch.
 *
 * The query is only enabled when familyId is provided, preventing unnecessary
 * API calls before the family context is loaded.
 *
 * @param familyId UUID of the family/tenant to fetch budgets for
 * @param month Optional calendar month (1-12) for spent calculation
 * @param year Optional calendar year for spent calculation
 * @returns TanStack Query result with budgets data, loading, and error states
 *
 * @example
 * // Fetch budgets for current month (backend defaults)
 * const { data: budgets, isLoading } = useBudgets(familyId);
 *
 * @example
 * // Fetch budgets for a specific month
 * const { data: budgets } = useBudgets(familyId, 3, 2026);
 */
export function useBudgets(familyId: string, month?: number, year?: number) {
  return useQuery({
    // Query key includes familyId and month/year to ensure proper cache segregation
    // Each month/year combination gets its own cache entry for the same family
    queryKey: ['budgets', familyId, month, year],

    // Query function calls API with optional month/year parameters
    queryFn: () => getBudgets(familyId, month, year),

    // Only run query if familyId is provided to avoid calls before family context loads
    enabled: !!familyId,
  });
}
