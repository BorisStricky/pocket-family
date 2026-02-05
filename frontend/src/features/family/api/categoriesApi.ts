// src/features/family/api/categoriesApi.ts
// API functions for category CRUD operations

import { apiFetch } from '@/lib/apiClient';
import type {
  CategoryRead,
  CategoryCreate,
  CategoryUpdate,
} from '@/types/category';

/**
 * Fetch list of categories for a specific family
 * GET /categories?tenant_id={familyId}
 *
 * Retrieves all categories (expense and income) for the specified family/tenant.
 * Returns both parent categories (parent_id=null) and child categories (parent_id set).
 * Backend validates that the user is a member of the tenant before returning data.
 *
 * Categories are tenant-scoped, so each family has its own isolated set of categories.
 * The tenant_id query parameter is required by the backend.
 *
 * @param familyId UUID of family/tenant to fetch categories for
 * @returns Array of CategoryRead objects representing both parent and child categories
 * @throws ApiError 400 if tenant_id is missing
 * @throws ApiError 401 if user is not authenticated
 * @throws ApiError 403 if user is not a member of the specified tenant
 */
export async function getCategories(
  familyId: string
): Promise<CategoryRead[]> {
  // Build URL with required tenant_id query parameter
  const url = `/categories?tenant_id=${familyId}`;

  return apiFetch(url, {
    method: 'GET',
  });
}

/**
 * Fetch single category by ID
 * GET /categories/{categoryId}
 *
 * Retrieves a specific category by its ID.
 * The backend validates that the user has access to this category
 * (user must be a member of the tenant that owns the category).
 *
 * @param categoryId UUID of the category to fetch
 * @returns Single CategoryRead object with parent relationship info
 * @throws ApiError 404 if category not found or user doesn't have access
 * @throws ApiError 401 if user is not authenticated
 * @throws ApiError 403 if user is not authorized to access this category
 */
export async function getCategory(
  categoryId: string
): Promise<CategoryRead> {
  return apiFetch(`/categories/${categoryId}`, {
    method: 'GET',
  });
}

/**
 * Create new category
 * POST /categories
 *
 * Creates a new expense or income category for the current user's tenant.
 * Can create either a parent category (no parent_id) or child category (with parent_id).
 *
 * When creating a child category:
 * - Backend validates that parent category exists
 * - Backend validates that child kind matches parent kind (expense child must have expense parent)
 * - Backend sets parent_name automatically based on parent_id
 *
 * The tenant_id is inferred from the user's JWT token on the backend.
 *
 * @param data Category creation data including name, kind, and optional parent_id
 * @returns Created CategoryRead object with generated ID, timestamps, and parent info
 * @throws ApiError 400 if validation fails (missing name/kind, invalid kind, kind mismatch with parent)
 * @throws ApiError 401 if user is not authenticated
 * @throws ApiError 404 if parent_id provided but parent category not found
 */
export async function createCategory(
  data: CategoryCreate
): Promise<CategoryRead> {
  return apiFetch('/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Update existing category
 * PATCH /categories/{categoryId}
 *
 * Updates an existing category with partial data.
 * Only the fields provided in the update payload will be modified.
 * The backend validates that the user has permission to update this category.
 *
 * When updating parent_id:
 * - Set to null to convert child category to parent category
 * - Set to valid parent ID to change parent or convert parent to child
 * - Backend validates kind matches if setting new parent
 *
 * When updating kind:
 * - Backend validates that if category has children, all children also get updated
 * - Or backend may reject kind changes for categories with children (implementation dependent)
 *
 * @param categoryId UUID of the category to update
 * @param data Partial category data to update (only changed fields)
 * @returns Updated CategoryRead object with new updated_at timestamp
 * @throws ApiError 404 if category not found or user doesn't have access
 * @throws ApiError 400 if validation fails (invalid kind, kind mismatch with parent, etc.)
 * @throws ApiError 401 if user is not authenticated
 * @throws ApiError 403 if user is not authorized to update this category
 */
export async function updateCategory(
  categoryId: string,
  data: CategoryUpdate
): Promise<CategoryRead> {
  return apiFetch(`/categories/${categoryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Delete category
 * DELETE /categories/{categoryId}
 *
 * Permanently deletes a category from the database.
 * The backend validates that the user has permission to delete this category.
 *
 * Important constraints:
 * - Cannot delete a category that has child categories (must delete children first)
 * - Backend returns 409 Conflict if category has children
 * - Transactions linked to this category may have category_id set to NULL or deletion blocked
 *   (depends on backend implementation - check backend constraints)
 *
 * @param categoryId UUID of the category to delete
 * @returns void (204 No Content on success)
 * @throws ApiError 404 if category not found or user doesn't have access
 * @throws ApiError 401 if user is not authenticated
 * @throws ApiError 403 if user is not authorized to delete this category
 * @throws ApiError 409 if category has child categories (cannot delete parent with children)
 */
export async function deleteCategory(
  categoryId: string
): Promise<void> {
  return apiFetch(`/categories/${categoryId}`, {
    method: 'DELETE',
  });
}
