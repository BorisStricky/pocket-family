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
 * GET /transactions?tenant_id={familyId}&...filters
 *
 * Retrieves all transactions for the specified family/tenant
 * While the backend uses the JWT token's tenant_id claim from the Authorization header
 * for validation, we also send tenant_id as a query parameter for explicit filtering
 *
 * @param familyId UUID of the family/tenant to fetch transactions for
 * @param filters Optional filters to narrow down results (date range, account, category, etc.)
 * @returns Array of TransactionRead objects with joined account and category names
 */
export async function fetchTransactions(
  familyId: string,
  filters?: TransactionFilters
): Promise<TransactionRead[]> {
  // Build query parameters starting with tenant_id
  const queryParameters = new URLSearchParams({
    tenant_id: familyId,
  });

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
    method: 'PUT',
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
