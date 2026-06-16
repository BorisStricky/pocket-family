// src/features/transactions/api/transactionsApi.ts
// API functions for transaction CRUD operations

import { apiFetch } from '@/lib/apiClient';
import type {
  TransactionCreate,
  TransactionRead,
  TransactionUpdate,
  TransactionFilters,
} from '../types';

/**
 * Fetch list of transactions with optional filters
 * GET /transactions?scope={scope}&...filters
 *
 * Retrieves transactions based on context:
 * - With familyId: returns only transactions for that family/tenant (scope=tenant)
 * - Without familyId: returns all user's transactions across all families (scope=global)
 *
 * The backend uses the scope parameter to determine whether to filter by a single tenant
 * or query across all tenants where the user has active membership
 *
 * @param familyId Optional UUID of the family/tenant to fetch transactions for
 * @param filters Optional filters to narrow down results (date range, account, category, etc.)
 * @returns Array of TransactionRead objects with joined account and category names
 */
export async function fetchTransactions(
  familyId?: string,
  filters?: TransactionFilters
): Promise<TransactionRead[]> {
  // Build query parameters with scope based on whether familyId is provided
  const queryParameters = new URLSearchParams();

  // Set scope parameter: "tenant" for family-scoped, "global" for all user's transactions
  // The backend will filter accordingly using the user's active memberships
  if (familyId) {
    queryParameters.append('scope', 'tenant');
    queryParameters.append('tenant_id', familyId);
  } else {
    queryParameters.append('scope', 'global');
  }

  if (filters?.account_id) {
    queryParameters.append('account_id', filters.account_id);
  }
  if (filters?.category_id) {
    queryParameters.append('category_id', filters.category_id);
  }
  if (filters?.transaction_type) {
    queryParameters.append('transaction_type', filters.transaction_type);
  }
  // Date filters use 'start' and 'end' parameter names to match backend API
  // Backend expects these exact names (see transactions.py router)
  if (filters?.start_date) {
    queryParameters.append('start', filters.start_date);
  }
  if (filters?.end_date) {
    queryParameters.append('end', filters.end_date);
  }
  if (filters?.search) {
    queryParameters.append('search', filters.search);
  }
  // Pagination params (optional). When omitted the backend applies its bounded
  // default page size, so existing callers keep working unchanged.
  if (filters?.limit !== undefined) {
    queryParameters.append('limit', String(filters.limit));
  }
  if (filters?.offset !== undefined) {
    queryParameters.append('offset', String(filters.offset));
  }

  // Construct URL with query string
  const url = `/transactions?${queryParameters.toString()}`;

  return apiFetch(url, {
    method: 'GET',
  });
}

/**
 * Fetch single transaction by ID
 * GET /transactions/{transactionId}
 *
 * Retrieves a specific transaction by its ID
 * The backend validates that the transaction belongs to the user's active tenant
 * using the JWT token's tenant_id claim
 *
 * @param transactionId UUID of the transaction to fetch
 * @returns Single TransactionRead object with joined account and category names
 * @throws ApiError 404 if transaction not found or doesn't belong to user's tenant
 */
export async function fetchTransactionById(
  transactionId: string
): Promise<TransactionRead> {
  return apiFetch(`/transactions/${transactionId}`, {
    method: 'GET',
  });
}

/**
 * Create new transaction
 * POST /transactions
 *
 * Creates a new transaction within the specified tenant
 * The tenant_id in the request body is validated against the user's active tenant
 * from the JWT token to prevent cross-tenant data creation
 *
 * @param data Transaction creation data including tenant_id, account_id, amount, etc.
 * @returns Created TransactionRead object with generated ID and timestamps
 * @throws ApiError 400 if validation fails (missing required fields, invalid amounts, etc.)
 * @throws ApiError 404 if account or category doesn't exist
 */
export async function createTransaction(
  data: TransactionCreate
): Promise<TransactionRead> {
  return apiFetch('/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Update existing transaction
 * PUT /transactions/{transactionId}
 *
 * Updates an existing transaction with partial data
 * Only the fields provided in the update payload will be modified
 * The backend validates that the transaction belongs to the user's active tenant
 *
 * @param transactionId UUID of the transaction to update
 * @param data Partial transaction data to update (only changed fields)
 * @returns Updated TransactionRead object with new updated_at timestamp
 * @throws ApiError 404 if transaction not found or doesn't belong to user's tenant
 * @throws ApiError 400 if validation fails (invalid amounts, dates, etc.)
 */
export async function updateTransaction(
  transactionId: string,
  data: TransactionUpdate
): Promise<TransactionRead> {
  return apiFetch(`/transactions/${transactionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Delete transaction
 * DELETE /transactions/{transactionId}
 *
 * Permanently deletes a transaction from the database
 * The backend validates that the transaction belongs to the user's active tenant
 * before allowing deletion to prevent cross-tenant data manipulation
 *
 * @param transactionId UUID of the transaction to delete
 * @returns Success response { ok: true }
 * @throws ApiError 404 if transaction not found or doesn't belong to user's tenant
 * @throws ApiError 403 if user doesn't have permission to delete the transaction
 */
export async function deleteTransaction(
  transactionId: string
): Promise<{ ok: boolean }> {
  return apiFetch(`/transactions/${transactionId}`, {
    method: 'DELETE',
  });
}
