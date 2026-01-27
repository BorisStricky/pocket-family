// src/features/accounts/api/accountsApi.ts
// API functions for account CRUD operations

import { apiFetch } from '@/lib/apiClient';
import type {
  AccountRead,
  AccountCreate,
  AccountUpdate,
} from '@/types/account';

/**
 * Fetch list of accounts with optional tenant filter
 * GET /accounts?tenant_id={familyId}
 *
 * Retrieves accounts based on context:
 * - With tenant_id: returns only accounts shared with that family (validates membership)
 * - Without tenant_id: returns all user's accounts plus any shared accounts (global view)
 *
 * The backend validates tenant membership when tenant_id is provided
 *
 * @param tenantId Optional UUID of family/tenant to filter accounts for
 * @returns Array of AccountRead objects with current balances
 * @throws ApiError 403 if user is not a member of the specified tenant
 */
export async function getAccounts(
  tenantId?: string
): Promise<AccountRead[]> {
  // Build URL with optional tenant_id query parameter
  const url = tenantId
    ? `/accounts?tenant_id=${tenantId}`
    : '/accounts';

  return apiFetch(url, {
    method: 'GET',
  });
}

/**
 * Fetch single account by ID
 * GET /accounts/{accountId}
 *
 * Retrieves a specific account by its ID
 * The backend validates that the user either owns the account or has access via share
 *
 * @param accountId UUID of the account to fetch
 * @returns Single AccountRead object with current balance
 * @throws ApiError 404 if account not found or user doesn't have access
 */
export async function getAccount(
  accountId: string
): Promise<AccountRead> {
  return apiFetch(`/accounts/${accountId}`, {
    method: 'GET',
  });
}

/**
 * Create new account
 * POST /accounts
 *
 * Creates a new financial account owned by the current user
 * Optionally creates an AccountShare atomically if share_with is provided
 *
 * When share_with is provided:
 * - Validates user is member of target tenant
 * - Creates Account and AccountShare in single transaction
 * - Rolls back entire operation if either creation fails
 *
 * @param data Account creation data including name, type, currency, optional balance and share
 * @returns Created AccountRead object with generated ID and timestamps
 * @throws ApiError 400 if validation fails (missing required fields, invalid account type, etc.)
 * @throws ApiError 403 if user is not member of tenant specified in share_with
 */
export async function createAccount(
  data: AccountCreate
): Promise<AccountRead> {
  return apiFetch('/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Update existing account
 * PATCH /accounts/{accountId}
 *
 * Updates an existing account with partial data
 * Only the fields provided in the update payload will be modified
 * The backend validates that the user owns the account before allowing updates
 *
 * @param accountId UUID of the account to update
 * @param data Partial account data to update (only changed fields)
 * @returns Updated AccountRead object with new updated_at timestamp
 * @throws ApiError 404 if account not found or user doesn't own it
 * @throws ApiError 400 if validation fails (invalid account type, negative balance for non-credit, etc.)
 */
export async function updateAccount(
  accountId: string,
  data: AccountUpdate
): Promise<AccountRead> {
  return apiFetch(`/accounts/${accountId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Delete account
 * DELETE /accounts/{accountId}?from_family_context={true|false}
 *
 * Permanently deletes an account from the database
 * The backend validates that the user owns the account before allowing deletion
 *
 * When fromFamilyContext is true and the account is shared with multiple families:
 * - Backend returns 409 Conflict error
 * - User must delete from main accounts page instead
 *
 * When fromFamilyContext is false or account has only one share:
 * - Deletion proceeds normally
 * - All AccountShare records cascade deleted
 * - Linked Transaction records have account_id set to NULL (preserving history)
 *
 * @param accountId UUID of the account to delete
 * @param fromFamilyContext Whether deletion is from family context (default: false)
 * @returns void (204 No Content on success)
 * @throws ApiError 404 if account not found or user doesn't own it
 * @throws ApiError 409 if account is shared with multiple families and fromFamilyContext is true
 * @throws ApiError 403 if user doesn't have permission to delete the account
 */
export async function deleteAccount(
  accountId: string,
  fromFamilyContext = false
): Promise<void> {
  // Build URL with optional from_family_context query parameter
  const url = fromFamilyContext
    ? `/accounts/${accountId}?from_family_context=true`
    : `/accounts/${accountId}`;

  return apiFetch(url, {
    method: 'DELETE',
  });
}
