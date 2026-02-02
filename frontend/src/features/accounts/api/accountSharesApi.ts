// src/features/accounts/api/accountSharesApi.ts
// API functions for account share management operations

import { apiFetch } from '@/lib/apiClient';
import type {
  AccountShareRead,
  AccountShareCreate,
  AccountShareUpdate,
} from '@/types/account';

/**
 * Fetch list of shares for a specific account
 * GET /accounts/{accountId}/shares
 *
 * Retrieves all families (tenants) that the specified account is shared with
 * Only account owners can view shares for their accounts
 * The backend validates ownership before returning share data
 *
 * @param accountId UUID of the account to fetch shares for
 * @returns Array of AccountShareRead objects with tenant info and visibility settings
 * @throws ApiError 403 if user is not the account owner
 * @throws ApiError 404 if account not found
 */
export async function getAccountShares(
  accountId: string
): Promise<AccountShareRead[]> {
  return apiFetch(`/accounts/${accountId}/shares`, {
    method: 'GET',
  });
}

/**
 * Create new account share
 * POST /accounts/{accountId}/shares
 *
 * Shares an existing account with another family (tenant)
 * Only account owners can create shares for their accounts
 * Validates that:
 * - User owns the account
 * - Target tenant exists
 * - User is member of target tenant
 * - Share doesn't already exist
 *
 * @param accountId UUID of the account to share
 * @param data Share creation data including tenant_id and optional visibility
 * @returns Created AccountShareRead object with generated ID and timestamps
 * @throws ApiError 403 if user is not the account owner or not member of target tenant
 * @throws ApiError 404 if account or tenant not found
 * @throws ApiError 400 if share already exists (duplicate)
 */
export async function createAccountShare(
  accountId: string,
  data: AccountShareCreate
): Promise<AccountShareRead> {
  return apiFetch(`/accounts/${accountId}/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Update existing account share
 * PATCH /accounts/{accountId}/shares/{tenantId}
 *
 * Updates visibility settings for an existing account share
 * Only account owners can update shares for their accounts
 * Currently only visibility field can be modified
 *
 * @param accountId UUID of the account
 * @param tenantId UUID of the tenant the account is shared with
 * @param data Update data containing new visibility setting
 * @returns Updated AccountShareRead object
 * @throws ApiError 403 if user is not the account owner
 * @throws ApiError 404 if account, tenant, or share not found
 */
export async function updateAccountShare(
  accountId: string,
  tenantId: string,
  data: AccountShareUpdate
): Promise<AccountShareRead> {
  return apiFetch(`/accounts/${accountId}/shares/${tenantId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Delete account share
 * DELETE /accounts/{accountId}/shares/{tenantId}
 *
 * Removes account sharing with specified family (tenant)
 * Only account owners can delete shares for their accounts
 * The shared family will immediately lose access to the account
 *
 * @param accountId UUID of the account
 * @param tenantId UUID of the tenant to stop sharing with
 * @returns void (204 No Content on success)
 * @throws ApiError 403 if user is not the account owner
 * @throws ApiError 404 if account, tenant, or share not found
 */
export async function deleteAccountShare(
  accountId: string,
  tenantId: string
): Promise<void> {
  return apiFetch(`/accounts/${accountId}/shares/${tenantId}`, {
    method: 'DELETE',
  });
}
