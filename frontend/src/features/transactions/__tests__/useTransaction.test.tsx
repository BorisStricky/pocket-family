// src/features/transactions/__tests__/useTransaction.test.ts
// Tests for useTransaction hook - fetches single transaction by ID

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import { useTransaction } from '../hooks/useTransaction';
import { createTestQueryClient, TestWrapper } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { createMockTransaction } from '@/test/mocks/factories';
import { STORAGE_KEYS } from '@/lib/constants';
import { createMockJWT } from '@/test/mocks/factories';

describe('useTransaction hook', () => {
  const transactionId = 'transaction-uuid-123';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Set up authenticated user with valid token
    const token = createMockJWT({ tenant_id: 'tenant-uuid-456' });
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  });

  describe('Successful data fetching', () => {
    it('should fetch single transaction from GET /transactions/:id', async () => {
      // Arrange - Create mock transaction
      const mockTransaction = createMockTransaction({
        id: transactionId,
        amount: '250.00',
        description: 'Test transaction',
      });
      server.use(
        http.get(`http://localhost:8000/transactions/:id`, ({ params }) => {
          if (params.id === transactionId) {
            return HttpResponse.json(mockTransaction);
          }
          return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook with transactionId
      const { result } = renderHook(() => useTransaction(transactionId), { wrapper });

      // Assert - Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockTransaction);
      expect(result.current.data?.id).toBe(transactionId);
      expect(result.current.data?.amount).toBe('250.00');
    });

    it('should return transaction with complete structure', async () => {
      // Arrange
      const mockTransaction = createMockTransaction({ id: transactionId });
      server.use(
        http.get(`http://localhost:8000/transactions/:id`, () => {
          return HttpResponse.json(mockTransaction);
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act
      const { result } = renderHook(() => useTransaction(transactionId), { wrapper });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify all expected fields exist
      expect(result.current.data).toHaveProperty('id');
      expect(result.current.data).toHaveProperty('tenant_id');
      expect(result.current.data).toHaveProperty('account_id');
      expect(result.current.data).toHaveProperty('amount');
      expect(result.current.data).toHaveProperty('currency');
      expect(result.current.data).toHaveProperty('transaction_date');
      expect(result.current.data).toHaveProperty('transaction_type');
      expect(result.current.data).toHaveProperty('created_at');
      expect(result.current.data).toHaveProperty('updated_at');
    });

    it('should use correct query key with transactionId', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook
      const { result } = renderHook(() => useTransaction(transactionId), { wrapper });

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Verify the query key exists in cache
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.findAll({
        queryKey: ['transactions', transactionId],
      });

      expect(queries.length).toBeGreaterThan(0);
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state initially', () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook
      const { result } = renderHook(() => useTransaction(transactionId), { wrapper });

      // Assert - Initial loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should handle 404 when transaction does not exist', async () => {
      // Arrange - Override to return 404
      server.use(
        http.get('http://localhost:8000/transactions/:id', () => {
          return HttpResponse.json(
            { detail: 'Transaction not found' },
            { status: 404 }
          );
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook with non-existent ID
      const { result } = renderHook(() => useTransaction('non-existent-id'), { wrapper });

      // Assert - Wait for error (no retries in test config)
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.data).toBeUndefined();
    });

    it('should handle 403 forbidden when user is not authorized', async () => {
      // Arrange - Override to return 403
      server.use(
        http.get('http://localhost:8000/transactions/:id', () => {
          return HttpResponse.json(
            { detail: 'Not authorized to access this transaction' },
            { status: 403 }
          );
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act
      const { result } = renderHook(() => useTransaction('unauthorized-id'), { wrapper });

      // Assert - Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 401 unauthorized error', async () => {
      // Arrange - Override to return 401
      server.use(
        http.get('http://localhost:8000/transactions/:id', () => {
          return HttpResponse.json(
            { detail: 'Not authenticated' },
            { status: 401 }
          );
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act
      const { result } = renderHook(() => useTransaction(transactionId), { wrapper });

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle network errors gracefully', async () => {
      // Arrange - Simulate network error
      server.use(
        http.get('http://localhost:8000/transactions/:id', () => {
          return HttpResponse.error();
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act
      const { result } = renderHook(() => useTransaction(transactionId), { wrapper });

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('Query caching and refetching', () => {
    it('should cache transaction data', async () => {
      // Arrange
      let fetchCount = 0;
      server.use(
        http.get('http://localhost:8000/transactions/:id', () => {
          fetchCount++;
          return HttpResponse.json(createMockTransaction({ id: transactionId }));
        })
      );

      // Create a query client with caching enabled for this test
      // Default test client has gcTime: 0 and staleTime: 0 which prevents caching
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: Infinity,     // Keep data in cache indefinitely
            staleTime: 60000,     // Data stays fresh for 60 seconds
          },
        },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render hook twice with same transactionId
      const { result: result1 } = renderHook(() => useTransaction(transactionId), { wrapper });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const firstFetchCount = fetchCount;

      // Render again with same transactionId - should use cache
      const { result: result2 } = renderHook(() => useTransaction(transactionId), { wrapper });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Assert - Should not have made additional fetch (using cached data)
      expect(fetchCount).toBe(firstFetchCount);
    });

    it('should fetch different transactions independently', async () => {
      // Arrange
      const transaction1 = createMockTransaction({ id: 'transaction-1', amount: '100.00' });
      const transaction2 = createMockTransaction({ id: 'transaction-2', amount: '200.00' });

      server.use(
        http.get('http://localhost:8000/transactions/:id', ({ params }) => {
          if (params.id === 'transaction-1') {
            return HttpResponse.json(transaction1);
          }
          if (params.id === 'transaction-2') {
            return HttpResponse.json(transaction2);
          }
          return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render hooks for two different transactions
      const { result: result1 } = renderHook(() => useTransaction('transaction-1'), { wrapper });
      const { result: result2 } = renderHook(() => useTransaction('transaction-2'), { wrapper });

      // Assert - Both should load successfully with different data
      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(result1.current.data?.id).toBe('transaction-1');
      expect(result1.current.data?.amount).toBe('100.00');
      expect(result2.current.data?.id).toBe('transaction-2');
      expect(result2.current.data?.amount).toBe('200.00');
    });
  });

  describe('Hook disabled state', () => {
    it('should not fetch when transactionId is undefined', () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render hook with undefined transactionId
      const { result } = renderHook(() => useTransaction(undefined as any), { wrapper });

      // Assert - Hook should not be loading or fetching
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when transactionId is empty string', () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render hook with empty transactionId
      const { result } = renderHook(() => useTransaction(''), { wrapper });

      // Assert - Hook should be disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });
});
