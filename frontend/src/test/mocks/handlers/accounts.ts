// src/test/mocks/handlers/accounts.ts
// MSW handlers for account endpoints (/accounts/*)

import { http, HttpResponse } from 'msw';
import { createMockAccountList } from '../factories/account';
import type { AccountRead } from '@/types/account';

// Base URL for API requests (matches vitest.config.ts define)
const API_BASE = 'http://localhost:8000';

// In-memory store for accounts during tests
// This allows us to simulate CRUD operations across multiple handlers
let mockAccountStore: AccountRead[] = createMockAccountList(5);

/**
 * Reset the account store to default state
 * Call this in beforeEach to ensure test isolation
 */
export function resetAccountStore(): void {
  mockAccountStore = createMockAccountList(5);
}

/**
 * Account endpoint handlers for MSW
 * These provide default successful responses that can be overridden per-test
 */
export const accountHandlers = [
  // GET /accounts - List accounts with optional tenant filter
  http.get(`${API_BASE}/accounts`, ({ request }) => {
    const url = new URL(request.url);
    const tenant_id = url.searchParams.get('tenant_id');

    // Simulate 401 for unauthenticated requests (no Authorization header)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // If tenant_id is provided, return filtered accounts
    // In real API, this would return only accounts shared with that tenant
    // For tests, we return all accounts but allow test-specific overrides
    let filteredAccounts = [...mockAccountStore];

    if (tenant_id) {
      // Simulate tenant filtering - tests can override this behavior
      // For default behavior, return all accounts
      filteredAccounts = mockAccountStore;
    }

    // Sort by name for consistent ordering
    filteredAccounts.sort((a, b) => a.name.localeCompare(b.name));

    return HttpResponse.json(filteredAccounts);
  }),

  // GET /accounts/:id - Get single account by ID
  http.get(`${API_BASE}/accounts/:id`, ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simulate 404 for non-existent account
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Account not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized access
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to access this account' },
        { status: 403 }
      );
    }

    // Find account in store
    const existingAccount = mockAccountStore.find(
      (account) => account.id === id
    );

    if (existingAccount) {
      return HttpResponse.json(existingAccount);
    }

    // Return 404 if not in store
    return HttpResponse.json(
      { detail: 'Account not found' },
      { status: 404 }
    );
  }),

  // POST /accounts - Create new account
  http.post(`${API_BASE}/accounts`, async ({ request }) => {
    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Partial<AccountRead>;

    // Simulate validation errors
    if (!body.name) {
      return HttpResponse.json(
        { detail: 'name is required' },
        { status: 400 }
      );
    }

    if (!body.type) {
      return HttpResponse.json(
        { detail: 'type is required' },
        { status: 400 }
      );
    }

    // Create new account with generated ID and timestamps
    const newAccount: AccountRead = {
      id: `account-uuid-new-${Date.now()}`,
      user_id: 'user-uuid-789',
      user_name: 'Test User',
      name: body.name,
      type: body.type || 'debit',
      currency: body.currency || 'USD',
      balance: body.balance || '0.00',
      icon: body.icon ?? null,
      color: body.color ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add to store
    mockAccountStore.push(newAccount);

    return HttpResponse.json(newAccount, { status: 201 });
  }),

  // PATCH /accounts/:id - Update existing account
  http.patch(`${API_BASE}/accounts/:id`, async ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Partial<AccountRead>;

    // Simulate 404 for non-existent account
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Account not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized update
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to update this account' },
        { status: 403 }
      );
    }

    // Find and update account in store
    const accountIndex = mockAccountStore.findIndex(
      (account) => account.id === id
    );

    if (accountIndex !== -1) {
      const existingAccount = mockAccountStore[accountIndex];
      const updatedAccount: AccountRead = {
        ...existingAccount,
        ...body,
        id: existingAccount.id, // Preserve ID
        updated_at: new Date().toISOString(),
      };
      mockAccountStore[accountIndex] = updatedAccount;
      return HttpResponse.json(updatedAccount);
    }

    // Return 404 if not in store
    return HttpResponse.json(
      { detail: 'Account not found' },
      { status: 404 }
    );
  }),

  // DELETE /accounts/:id - Delete account
  http.delete(`${API_BASE}/accounts/:id`, ({ params, request }) => {
    const { id } = params;
    const url = new URL(request.url);
    const fromFamilyContext = url.searchParams.get('from_family_context') === 'true';

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simulate 404 for non-existent account
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Account not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized delete
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to delete this account' },
        { status: 403 }
      );
    }

    // Simulate 409 for multi-shared account deletion from family context
    if (id === 'multi-shared-id' && fromFamilyContext) {
      return HttpResponse.json(
        { detail: 'Account is shared with multiple families' },
        { status: 409 }
      );
    }

    // Remove from store if exists
    const accountIndex = mockAccountStore.findIndex(
      (account) => account.id === id
    );

    if (accountIndex !== -1) {
      mockAccountStore.splice(accountIndex, 1);
    }

    // Return 204 No Content on success (matches backend behavior)
    return new HttpResponse(null, { status: 204 });
  }),
];
