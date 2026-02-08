// src/features/category/hooks/useCategories.ts
// React Query hook for fetching list of categories for a family

import { useQuery } from '@tanstack/react-query';
import { getCategories } from '../api/categoriesApi';

/**
 * React Query hook for fetching list of categories
 *
 * Query key structure: ['categories', familyId]
 * This structure ensures proper cache isolation per family, so each family's
 * categories are cached separately.
 *
 * Returns both parent categories (parent_id = null) and child categories (parent_id set).
 * Categories include kind (expense/income) for filtering and grouping in UI.
 *
 * The familyId parameter is required because categories are tenant-scoped.
 * Backend requires tenant_id query parameter and validates user membership.
 *
 * @param familyId UUID of family/tenant to fetch categories for (required)
 * @returns TanStack Query result with categories data, loading, and error states
 *
 * @example
 * // Fetch categories for a specific family
 * const { data: categories, isLoading, error } = useCategories(familyId);
 *
 * // Filter expense categories in UI
 * const expenseCategories = categories?.filter(c => c.kind === 'expense');
 *
 * // Find parent categories (top-level)
 * const parentCategories = categories?.filter(c => c.parent_id === null);
 */
export function useCategories(familyId: string) {
  return useQuery({
    // Query key includes familyId to ensure proper cache segregation per family
    // Different families will have different cached category lists
    queryKey: ['categories', familyId],

    // Query function calls API with required familyId parameter
    queryFn: () => getCategories(familyId),

    // Always enabled since familyId is required parameter
    // The hook should only be called when familyId is available
  });
}
