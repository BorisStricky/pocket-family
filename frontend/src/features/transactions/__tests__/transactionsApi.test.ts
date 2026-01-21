// src/features/transactions/__tests__/transactionsApi.test.ts
// Tests for transaction API functions - verifies correct endpoint calls

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  fetchTransactions,
  fetchTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../api/transactionsApi';
import { server, resetTransactionStore } from '@/test/mocks/server';
import { createMockTransaction, createMockTransactionList } from '@/test/mocks/factories';
import { STORAGE_KEYS } from '@/lib/constants';
import { createMockJWT } from '@/test/mocks/factories';

describe('Transactions API functions', () => {
  const familyId = 'tenant-uuid-456';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Set up authenticated user with valid token
    const token = createMockJWT({ tenant_id: familyId });
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);

    // Reset transaction store for test isolation
    resetTransactionStore();
  });

  describe('fetchTransactions', () => {
    it('should call GET /transactions with tenant_id param', async () => {
      // Arrange - Track request
      let requestUrl: string | null = null;
      server.use(
        http.get('http://localhost:8000/transactions', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(createMockTransactionList(5));
        })
      );

      // Act - Call API function
      const result = await fetchTransactions(familyId);

      // Assert - Verify request URL includes tenant_id
      expect(requestUrl).toContain('tenant_id=' + familyId);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return array of transactions', async () => {
      // Arrange
      const mockTransactions = createMockTransactionList(3);
      server.use(
        http.get('http://localhost:8000/transactions', () => {
          return HttpResponse.json(mockTransactions);
        })
      );

      // Act
      const result = await fetchTransactions(familyId);

      // Assert
      expect(result).toEqual(mockTransactions);
      expect(result.length).toBe(3);
    });

    it('should include Authorization header with token', async () => {
      // Arrange - Track request headers
      let authHeader: string | null = null;
      server.use(
        http.get('http://localhost:8000/transactions', ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return HttpResponse.json([]);
        })
      );

      // Act
      await fetchTransactions(familyId);

      // Assert - Verify Authorization header exists and has Bearer token
      expect(authHeader).toBeDefined();
      expect(authHeader).toContain('Bearer');
    });

    it('should include filter params when provided', async () => {
      // Arrange - Track query params
      let capturedParams: URLSearchParams | null = null;
      server.use(
        http.get('http://localhost:8000/transactions', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = url.searchParams;
          return HttpResponse.json([]);
        })
      );

      const filters = {
        account_id: 'account-123',
        category_id: 'category-456',
        transaction_type: 'expense' as const,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      };

      // Act
      await fetchTransactions(familyId, filters);

      // Assert - Verify all filters are in query params
      expect(capturedParams?.get('tenant_id')).toBe(familyId);
      expect(capturedParams?.get('account_id')).toBe('account-123');
      expect(capturedParams?.get('category_id')).toBe('category-456');
      expect(capturedParams?.get('transaction_type')).toBe('expense');
      expect(capturedParams?.get('start_date')).toBe('2026-01-01');
      expect(capturedParams?.get('end_date')).toBe('2026-01-31');
    });

    it('should handle 401 unauthorized error', async () => {
      // Arrange
      server.use(
        http.get('http://localhost:8000/transactions', () => {
          return HttpResponse.json(
            { detail: 'Not authenticated' },
            { status: 401 }
          );
        })
      );

      // Act & Assert - Should throw error
      await expect(fetchTransactions(familyId)).rejects.toThrow();
    });

    it('should handle 403 forbidden error', async () => {
      // Arrange
      server.use(
        http.get('http://localhost:8000/transactions', () => {
          return HttpResponse.json(
            { detail: 'Not authorized' },
            { status: 403 }
          );
        })
      );

      // Act & Assert
      await expect(fetchTransactions(familyId)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      // Arrange
      server.use(
        http.get('http://localhost:8000/transactions', () => {
          return HttpResponse.error();
        })
      );

      // Act & Assert
      await expect(fetchTransactions(familyId)).rejects.toThrow();
    });
  });

  describe('fetchTransactionById', () => {
    const transactionId = 'transaction-uuid-123';

    it('should call GET /transactions/:id', async () => {
      // Arrange - Track request
      let requestUrl: string | null = null;
      server.use(
        http.get('http://localhost:8000/transactions/:id', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(createMockTransaction({ id: transactionId }));
        })
      );

      // Act
      const result = await fetchTransactionById(transactionId);

      // Assert - Verify correct endpoint called
      expect(requestUrl).toContain(`/transactions/${transactionId}`);
      expect(result).toBeDefined();
      expect(result.id).toBe(transactionId);
    });

    it('should return single transaction', async () => {
      // Arrange
      const mockTransaction = createMockTransaction({ id: transactionId, amount: '250.00' });
      server.use(
        http.get('http://localhost:8000/transactions/:id', () => {
          return HttpResponse.json(mockTransaction);
        })
      );

      // Act
      const result = await fetchTransactionById(transactionId);

      // Assert
      expect(result).toEqual(mockTransaction);
      expect(result.amount).toBe('250.00');
    });

    it('should include Authorization header', async () => {
      // Arrange
      let authHeader: string | null = null;
      server.use(
        http.get('http://localhost:8000/transactions/:id', ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return HttpResponse.json(createMockTransaction());
        })
      );

      // Act
      await fetchTransactionById(transactionId);

      // Assert
      expect(authHeader).toBeDefined();
      expect(authHeader).toContain('Bearer');
    });

    it('should handle 404 not found error', async () => {
      // Arrange
      server.use(
        http.get('http://localhost:8000/transactions/:id', () => {
          return HttpResponse.json(
            { detail: 'Transaction not found' },
            { status: 404 }
          );
        })
      );

      // Act & Assert
      await expect(fetchTransactionById('non-existent')).rejects.toThrow();
    });
  });

  describe('createTransaction', () => {
    it('should call POST /transactions with transaction data', async () => {
      // Arrange - Track request body
      let requestBody: any = null;
      server.use(
        http.post('http://localhost:8000/transactions', async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json(
            createMockTransaction({ ...requestBody, id: 'new-id' }),
            { status: 201 }
          );
        })
      );

      const newTransaction = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '150.00',
        currency: 'USD',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
        description: 'Test transaction',
      };

      // Act
      const result = await createTransaction(newTransaction);

      // Assert - Verify request body matches input
      expect(requestBody).toMatchObject(newTransaction);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should return created transaction with ID', async () => {
      // Arrange
      const newTransaction = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '200.00',
        transaction_date: '2026-01-12',
        transaction_type: 'income' as const,
      };

      // Act
      const result = await createTransaction(newTransaction);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.amount).toBe('200.00');
      expect(result.created_at).toBeDefined();
    });

    it('should include Authorization header', async () => {
      // Arrange
      let authHeader: string | null = null;
      server.use(
        http.post('http://localhost:8000/transactions', async ({ request }) => {
          authHeader = request.headers.get('Authorization');
          const body = await request.json();
          return HttpResponse.json(createMockTransaction(body), { status: 201 });
        })
      );

      const newTransaction = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '150.00',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      };

      // Act
      await createTransaction(newTransaction);

      // Assert
      expect(authHeader).toBeDefined();
      expect(authHeader).toContain('Bearer');
    });

    it('should handle validation errors', async () => {
      // Arrange
      server.use(
        http.post('http://localhost:8000/transactions', () => {
          return HttpResponse.json(
            { detail: 'amount is required' },
            { status: 400 }
          );
        })
      );

      const invalidTransaction = {
        tenant_id: familyId,
        account_id: 'account-123',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      } as any;

      // Act & Assert
      await expect(createTransaction(invalidTransaction)).rejects.toThrow();
    });
  });

  describe('updateTransaction', () => {
    const transactionId = 'transaction-uuid-123';

    it('should call PUT /transactions/:id with update data', async () => {
      // Arrange - Track request
      let requestUrl: string | null = null;
      let requestBody: any = null;
      server.use(
        http.put('http://localhost:8000/transactions/:id', async ({ request, params }) => {
          requestUrl = request.url;
          requestBody = await request.json();
          return HttpResponse.json(
            createMockTransaction({ id: params.id as string, ...requestBody })
          );
        })
      );

      const updateData = {
        amount: '350.00',
        description: 'Updated description',
      };

      // Act
      const result = await updateTransaction(transactionId, updateData);

      // Assert
      expect(requestUrl).toContain(`/transactions/${transactionId}`);
      expect(requestBody).toMatchObject(updateData);
      expect(result.amount).toBe('350.00');
    });

    it('should return updated transaction', async () => {
      // Arrange
      const updateData = {
        amount: '500.00',
        category_id: 'new-category',
      };

      // Act
      const result = await updateTransaction(transactionId, updateData);

      // Assert
      expect(result.id).toBe(transactionId);
      expect(result.amount).toBe('500.00');
      expect(result.updated_at).toBeDefined();
    });

    it('should include Authorization header', async () => {
      // Arrange
      let authHeader: string | null = null;
      server.use(
        http.put('http://localhost:8000/transactions/:id', async ({ request }) => {
          authHeader = request.headers.get('Authorization');
          const body = await request.json();
          return HttpResponse.json(createMockTransaction(body));
        })
      );

      // Act
      await updateTransaction(transactionId, { amount: '250.00' });

      // Assert
      expect(authHeader).toBeDefined();
      expect(authHeader).toContain('Bearer');
    });

    it('should handle 404 not found error', async () => {
      // Arrange
      server.use(
        http.put('http://localhost:8000/transactions/:id', () => {
          return HttpResponse.json(
            { detail: 'Transaction not found' },
            { status: 404 }
          );
        })
      );

      // Act & Assert
      await expect(
        updateTransaction('non-existent', { amount: '250.00' })
      ).rejects.toThrow();
    });
  });

  describe('deleteTransaction', () => {
    const transactionId = 'transaction-uuid-123';

    it('should call DELETE /transactions/:id', async () => {
      // Arrange - Track request
      let requestUrl: string | null = null;
      server.use(
        http.delete('http://localhost:8000/transactions/:id', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({ ok: true });
        })
      );

      // Act
      const result = await deleteTransaction(transactionId);

      // Assert
      expect(requestUrl).toContain(`/transactions/${transactionId}`);
      expect(result).toEqual({ ok: true });
    });

    it('should return success response', async () => {
      // Arrange & Act
      const result = await deleteTransaction(transactionId);

      // Assert
      expect(result.ok).toBe(true);
    });

    it('should include Authorization header', async () => {
      // Arrange
      let authHeader: string | null = null;
      server.use(
        http.delete('http://localhost:8000/transactions/:id', ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return HttpResponse.json({ ok: true });
        })
      );

      // Act
      await deleteTransaction(transactionId);

      // Assert
      expect(authHeader).toBeDefined();
      expect(authHeader).toContain('Bearer');
    });

    it('should handle 404 not found error', async () => {
      // Arrange
      server.use(
        http.delete('http://localhost:8000/transactions/:id', () => {
          return HttpResponse.json(
            { detail: 'Transaction not found' },
            { status: 404 }
          );
        })
      );

      // Act & Assert
      await expect(deleteTransaction('non-existent')).rejects.toThrow();
    });

    it('should handle 403 forbidden error', async () => {
      // Arrange
      server.use(
        http.delete('http://localhost:8000/transactions/:id', () => {
          return HttpResponse.json(
            { detail: 'Not authorized' },
            { status: 403 }
          );
        })
      );

      // Act & Assert
      await expect(deleteTransaction('unauthorized-id')).rejects.toThrow();
    });
  });
});
