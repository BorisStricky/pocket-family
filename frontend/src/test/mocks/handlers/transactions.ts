// src/test/mocks/handlers/transactions.ts
// MSW handlers for transaction endpoints (/transactions/*)

import { http, HttpResponse } from 'msw';
import { createMockTransaction, createMockTransactionList } from '../factories/transaction';
import type { Transaction } from '@/types';

// Base URL for API requests (matches vitest.config.ts define)
const API_BASE = 'http://localhost:8000';

// In-memory store for transactions during tests
// This allows us to simulate CRUD operations across multiple handlers
let mockTransactionStore: Transaction[] = createMockTransactionList(10);

/**
 * Reset the transaction store to default state
 * Call this in beforeEach to ensure test isolation
 */
export function resetTransactionStore(): void {
  mockTransactionStore = createMockTransactionList(10);
}

/**
 * Transaction endpoint handlers for MSW
 * These provide default successful responses that can be overridden per-test
 */
export const transactionHandlers = [
  // GET /transactions - List transactions with optional filtering
  http.get(`${API_BASE}/transactions`, ({ request }) => {
    const url = new URL(request.url);
    const tenant_id = url.searchParams.get('tenant_id');
    const account_id = url.searchParams.get('account_id');
    const category_id = url.searchParams.get('category_id');
    const transaction_type = url.searchParams.get('transaction_type');
    const start_date = url.searchParams.get('start_date');
    const end_date = url.searchParams.get('end_date');

    // Simulate 401 for unauthenticated requests (no Authorization header)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Filter transactions based on query parameters
    let filteredTransactions = [...mockTransactionStore];

    if (tenant_id) {
      filteredTransactions = filteredTransactions.filter(
        (transaction) => transaction.tenant_id === tenant_id
      );
    }

    if (account_id) {
      filteredTransactions = filteredTransactions.filter(
        (transaction) => transaction.account_id === account_id
      );
    }

    if (category_id) {
      filteredTransactions = filteredTransactions.filter(
        (transaction) => transaction.category_id === category_id
      );
    }

    if (transaction_type) {
      filteredTransactions = filteredTransactions.filter(
        (transaction) => transaction.transaction_type === transaction_type
      );
    }

    if (start_date) {
      filteredTransactions = filteredTransactions.filter(
        (transaction) => transaction.transaction_date >= start_date
      );
    }

    if (end_date) {
      filteredTransactions = filteredTransactions.filter(
        (transaction) => transaction.transaction_date <= end_date
      );
    }

    // Sort by date descending (most recent first)
    filteredTransactions.sort((a, b) =>
      b.transaction_date.localeCompare(a.transaction_date)
    );

    return HttpResponse.json(filteredTransactions);
  }),

  // GET /transactions/:id - Get single transaction by ID
  http.get(`${API_BASE}/transactions/:id`, ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simulate 404 for non-existent transaction
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized access (different tenant)
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to access this transaction' },
        { status: 403 }
      );
    }

    // Find transaction in store or return mock
    const existingTransaction = mockTransactionStore.find(
      (transaction) => transaction.id === id
    );

    if (existingTransaction) {
      return HttpResponse.json(existingTransaction);
    }

    // Return mock transaction with provided ID
    return HttpResponse.json(createMockTransaction({ id: id as string }));
  }),

  // POST /transactions - Create new transaction
  http.post(`${API_BASE}/transactions`, async ({ request }) => {
    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Partial<Transaction>;

    // Simulate validation errors
    if (!body.account_id) {
      return HttpResponse.json(
        { detail: 'account_id is required' },
        { status: 400 }
      );
    }

    if (!body.amount) {
      return HttpResponse.json(
        { detail: 'amount is required' },
        { status: 400 }
      );
    }

    if (!body.transaction_date) {
      return HttpResponse.json(
        { detail: 'transaction_date is required' },
        { status: 400 }
      );
    }

    if (!body.transaction_type) {
      return HttpResponse.json(
        { detail: 'transaction_type is required' },
        { status: 400 }
      );
    }

    // Simulate 403 for tenant mismatch
    if (body.tenant_id === 'unauthorized-tenant') {
      return HttpResponse.json(
        { detail: 'Not authorized to create transaction for this tenant' },
        { status: 403 }
      );
    }

    // Create new transaction with generated ID and timestamps
    const newTransaction: Transaction = {
      id: `transaction-uuid-new-${Date.now()}`,
      tenant_id: body.tenant_id || 'tenant-uuid-456',
      account_id: body.account_id,
      account_name: body.account_name || 'Main Checking',
      category_id: body.category_id || null,
      category_name: body.category_name || null,
      amount: String(body.amount),
      currency: body.currency || 'USD',
      transaction_date: body.transaction_date,
      transaction_type: body.transaction_type,
      description: body.description || null,
      created_by: 'user-uuid-123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reconciled: false,
      source: body.source || 'manual',
    };

    // Add to store
    mockTransactionStore.push(newTransaction);

    return HttpResponse.json(newTransaction, { status: 201 });
  }),

  // PUT /transactions/:id - Update existing transaction
  http.put(`${API_BASE}/transactions/:id`, async ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Partial<Transaction>;

    // Simulate 404 for non-existent transaction
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized update
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to update this transaction' },
        { status: 403 }
      );
    }

    // Find and update transaction in store
    const transactionIndex = mockTransactionStore.findIndex(
      (transaction) => transaction.id === id
    );

    if (transactionIndex !== -1) {
      const existingTransaction = mockTransactionStore[transactionIndex];
      const updatedTransaction: Transaction = {
        ...existingTransaction,
        ...body,
        id: existingTransaction.id, // Preserve ID
        updated_at: new Date().toISOString(),
      };
      mockTransactionStore[transactionIndex] = updatedTransaction;
      return HttpResponse.json(updatedTransaction);
    }

    // If not in store, return mock with updates applied
    const mockTransaction = createMockTransaction({ id: id as string });
    const updatedTransaction: Transaction = {
      ...mockTransaction,
      ...body,
      id: mockTransaction.id,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(updatedTransaction);
  }),

  // DELETE /transactions/:id - Delete transaction
  http.delete(`${API_BASE}/transactions/:id`, ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simulate 404 for non-existent transaction
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized delete
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to delete this transaction' },
        { status: 403 }
      );
    }

    // Remove from store if exists
    const transactionIndex = mockTransactionStore.findIndex(
      (transaction) => transaction.id === id
    );

    if (transactionIndex !== -1) {
      mockTransactionStore.splice(transactionIndex, 1);
    }

    // Return success response
    return HttpResponse.json({ ok: true });
  }),
];
