// src/features/budgets/api/budgetsApi.ts
// API functions for budget CRUD operations
//
// Budgets are monthly spending limits scoped to a tenant. Each budget can
// track one or more categories (many-to-many). The "spent" amount is
// calculated on-read by the backend from expense transactions matching
// the budget's currency for the requested calendar month.

import { apiFetch } from '@/lib/apiClient';
import type {
  BudgetRead,
  BudgetCreatePayload,
  BudgetUpdatePayload,
} from '../types';

/**
 * Fetch list of budgets for the current tenant with optional month/year filter
 * GET /budgets?month=N&year=YYYY
 *
 * Returns all budgets belonging to the user's active tenant (from JWT).
 * Each budget includes its categories and a "spent" amount calculated by
 * aggregating expense transactions matching the budget's currency for the
 * specified month. Month and year default to the current month on the backend
 * when not provided.
 *
 * @param familyId Tenant UUID - currently unused in URL (backend reads tenant from JWT)
 *   but kept as parameter for consistency with other API functions and future use
 * @param month Optional calendar month (1-12) for spent calculation
 * @param year Optional calendar year for spent calculation
 * @returns Array of BudgetRead objects with spent amounts and category lists
 */
export async function getBudgets(
  familyId: string,
  month?: number,
  year?: number
): Promise<BudgetRead[]> {
  // Build query parameters for optional month/year filtering
  // When omitted, backend defaults to current month/year
  const queryParameters = new URLSearchParams();

  if (month !== undefined) {
    queryParameters.append('month', String(month));
  }
  if (year !== undefined) {
    queryParameters.append('year', String(year));
  }

  const queryString = queryParameters.toString();
  const url = queryString ? `/budgets?${queryString}` : '/budgets';

  return apiFetch(url, {
    method: 'GET',
  });
}

/**
 * Fetch single budget by ID with optional month/year filter
 * GET /budgets/{budgetId}?month=N&year=YYYY
 *
 * Retrieves a specific budget with its categories and spent amount.
 * The backend validates that the budget belongs to the user's active tenant.
 * Month/year control which period the spent calculation covers.
 *
 * @param familyId Tenant UUID - kept for consistency (backend reads tenant from JWT)
 * @param budgetId UUID of the budget to fetch
 * @param month Optional calendar month (1-12) for spent calculation
 * @param year Optional calendar year for spent calculation
 * @returns Single BudgetRead object with spent amount and categories
 * @throws ApiError 404 if budget not found or doesn't belong to user's tenant
 */
export async function getBudget(
  familyId: string,
  budgetId: string,
  month?: number,
  year?: number
): Promise<BudgetRead> {
  // Build query parameters for optional month/year filtering
  const queryParameters = new URLSearchParams();

  if (month !== undefined) {
    queryParameters.append('month', String(month));
  }
  if (year !== undefined) {
    queryParameters.append('year', String(year));
  }

  const queryString = queryParameters.toString();
  const url = queryString
    ? `/budgets/${budgetId}?${queryString}`
    : `/budgets/${budgetId}`;

  return apiFetch(url, {
    method: 'GET',
  });
}

/**
 * Create a new budget
 * POST /budgets
 *
 * Creates a budget within the user's active tenant. The backend infers
 * tenant_id from the JWT token. Currency defaults to "BRL" if not provided.
 * Omitting category_ids creates a "universal budget" that tracks ALL
 * tenant expense transactions matching the budget's currency.
 *
 * Backend validates:
 * - All category_ids belong to the same tenant
 * - Amount is positive
 * - Name is not empty
 * - Only OWNER role can create budgets
 *
 * @param familyId Tenant UUID - kept for consistency (backend reads tenant from JWT)
 * @param data Budget creation payload with name, amount, optional currency and category_ids
 * @returns Created BudgetRead object with generated ID, timestamps, and spent=0
 * @throws ApiError 400 if validation fails (negative amount, empty name, etc.)
 * @throws ApiError 403 if user is not an OWNER of the tenant
 * @throws ApiError 404 if any category_id doesn't exist
 */
export async function createBudget(
  familyId: string,
  data: BudgetCreatePayload
): Promise<BudgetRead> {
  return apiFetch('/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing budget
 * PATCH /budgets/{budgetId}
 *
 * Updates a budget with partial data. Only provided fields are modified.
 * When category_ids is provided, it REPLACES the entire category set
 * (not additive). Omitting category_ids leaves current categories unchanged.
 *
 * Backend validates:
 * - Budget belongs to user's tenant
 * - New category_ids (if provided) belong to same tenant
 * - Amount is positive (if provided)
 * - Only OWNER role can update budgets
 *
 * @param familyId Tenant UUID - kept for consistency (backend reads tenant from JWT)
 * @param budgetId UUID of the budget to update
 * @param data Partial budget update payload
 * @returns Updated BudgetRead object with new updated_at timestamp
 * @throws ApiError 404 if budget not found or doesn't belong to user's tenant
 * @throws ApiError 400 if validation fails
 * @throws ApiError 403 if user is not an OWNER of the tenant
 */
export async function updateBudget(
  familyId: string,
  budgetId: string,
  data: BudgetUpdatePayload
): Promise<BudgetRead> {
  return apiFetch(`/budgets/${budgetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Delete a budget
 * DELETE /budgets/{budgetId}
 *
 * Permanently deletes a budget and its category associations (CASCADE).
 * The budget_category join table rows are automatically removed.
 * The categories themselves are NOT deleted.
 *
 * @param familyId Tenant UUID - kept for consistency (backend reads tenant from JWT)
 * @param budgetId UUID of the budget to delete
 * @returns Success response (204 No Content mapped to { ok: true } by apiFetch)
 * @throws ApiError 404 if budget not found or doesn't belong to user's tenant
 * @throws ApiError 403 if user is not an OWNER of the tenant
 */
export async function deleteBudget(
  familyId: string,
  budgetId: string
): Promise<{ ok: boolean }> {
  return apiFetch(`/budgets/${budgetId}`, {
    method: 'DELETE',
  });
}
