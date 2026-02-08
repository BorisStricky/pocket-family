// src/features/category/hooks/useCategory.ts
// React Query hook for fetching a single category by ID

import { useQuery } from '@tanstack/react-query';
import { getCategory } from '../api/categoriesApi';

/**
 * React Query hook for fetching a single category
 *
 * Query key structure: ['categories', categoryId]
 * This allows caching individual categories separately from the list view.
 * When a category is updated, both this query and the list query are invalidated.
 *
 * Returns full category data including parent relationship info (parent_id, parent_name).
 * Useful for category detail views, edit forms, and displaying category hierarchies.
 *
 * The query is only enabled when categoryId is provided, preventing unnecessary
 * API calls when the hook is rendered without a category selected.
 *
 * @param categoryId UUID of the category to fetch (optional - query disabled if not provided)
 * @returns TanStack Query result with category data, loading, and error states
 *
 * @example
 * // Fetch single category for detail view
 * const { data: category, isLoading } = useCategory(categoryId);
 *
 * // Display category with parent info
 * if (category) {
 *   console.log(`${category.name} (${category.kind})`);
 *   if (category.parent_name) {
 *     console.log(`Parent: ${category.parent_name}`);
 *   }
 * }
 *
 * @example
 * // Conditional usage - only fetch when ID is available
 * const categoryId = useParams().id;
 * const { data: category } = useCategory(categoryId);
 * // Query automatically disabled if categoryId is undefined
 */
export function useCategory(categoryId?: string) {
  return useQuery({
    // Query key includes categoryId for individual category cache
    queryKey: ['categories', categoryId],

    // Query function calls API with categoryId
    queryFn: () => getCategory(categoryId!),

    // Only run query if categoryId is provided
    // This prevents errors when hook is rendered before category is selected
    enabled: !!categoryId,
  });
}
