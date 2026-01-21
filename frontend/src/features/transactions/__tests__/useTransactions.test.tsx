// src/features/transactions/__tests__/useTransactions.test.ts
// Tests for useTransactions hook - fetches list of transactions with filters

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useTransactions } from '../hooks/useTransactions';
import { createTestQueryClient, TestWrapper } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { createMockTransactionList, createMockExpenseTransaction } from '@/test/mocks/factories';
import { STORAGE_KEYS } from '@/lib/constants';
import { createMockJWT } from '@/test/mocks/factories';

describe('useTransactions hook', () => {
  const familyId = 'tenant-uuid-456';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Set up authenticated user with valid token
    const token = createMockJWT({ tenant_id: familyId });
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  });

  describe('Successful data fetching', () => {
    it('should fetch list of transactions from GET /transactions', async () => {
      // Arrange - Create wrapper with fresh query client
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook with familyId
      const { result } = renderHook(() => useTransactions(familyId), { wrapper });

      // Assert - Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify transactions data structure
      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
      expect(result.current.data!.length).toBeGreaterThan(0);
    });

    it('should return transactions with correct structure', async () => {
      // Arrange - Override handler to return specific transactions
      const mockTransactions = createMockTransactionList(3, { tenant_id: familyId });
      server.use(
        http.get('http://localhost:8000/transactions', () => {
          return HttpResponse.json(mockTransactions);
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook
      const { result } = renderHook(() => useTransactions(familyId), { wrapper });

      // Assert - Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify structure matches mock
      expect(result.current.data).toEqual(mockTransactions);
      expect(result.current.data![0]).toHaveProperty('id');
      expect(result.current.data![0]).toHaveProperty('amount');
      expect(result.current.data![0]).toHaveProperty('transaction_type');
      expect(result.current.data![0]).toHaveProperty('transaction_date');
    });

    it('should use correct query key with familyId', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook
      const { result } = renderHook(() => useTransactions(familyId), { wrapper });

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Verify the query key exists in cache
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.findAll({
        queryKey: ['transactions', familyId],
      });

      expect(queries.length).toBeGreaterThan(0);
    });

    it('should handle empty transaction list', async () => {
      // Arrange - Override handler to return empty array
      server.use(
        http.get('http://localhost:8000/transactions', () => {
          return HttpResponse.json([]);
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook
      const { result } = renderHook(() => useTransactions(familyId), { wrapper });

      // Assert - Wait for success with empty array
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('Query parameters and filtering', () => {
    it('should include tenant_id in query params', async () => {
      // Arrange - Track query params sent to API
      let capturedParams: URLSearchParams | null = null;
      server.use(
        http.get('http://localhost:8000/transactions', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = url.searchParams;
          return HttpResponse.json(createMockTransactionList(2));
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook with familyId
      const { result } = renderHook(() => useTransactions(familyId), { wrapper });

      // Wait for request to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Verify tenant_id was included in params
      expect(capturedParams?.get('tenant_id')).toBe(familyId);
    });

    it('should support filtering by account_id', async () => {
      // Arrange - Track query params
      const accountId = 'account-123';
      let capturedParams: URLSearchParams | null = null;
      server.use(
        http.get('http://localhost:8000/transactions', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = url.searchParams;
          return HttpResponse.json(createMockTransactionList(2));
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render hook with filters
      const { result } = renderHook(
        () => useTransactions(familyId, { account_id: accountId }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Verify account_id filter was sent
      expect(capturedParams?.get('account_id')).toBe(accountId);
    });

    it('should support filtering by date range', async () => {
      // Arrange
      const startDate = '2026-01-01';
      const endDate = '2026-01-31';
      let capturedParams: URLSearchParams | null = null;
      server.use(
        http.get('http://localhost:8000/transactions', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = url.searchParams;
          return HttpResponse.json(createMockTransactionList(2));
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render hook with date filters
      const { result } = renderHook(
        () => useTransactions(familyId, { start_date: startDate, end_date: endDate }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Verify date filters were sent with correct parameter names
      // Backend expects 'start' and 'end' (not 'start_date' and 'end_date')
      expect(capturedParams?.get('start')).toBe(startDate);
      expect(capturedParams?.get('end')).toBe(endDate);
    });

    it('should support filtering by transaction_type', async () => {
      // Arrange
      let capturedParams: URLSearchParams | null = null;
      server.use(
        http.get('http://localhost:8000/transactions', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = url.searchParams;
          return HttpResponse.json([createMockExpenseTransaction()]);
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Filter by expense type
      const { result } = renderHook(
        () => useTransactions(familyId, { transaction_type: 'expense' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert
      expect(capturedParams?.get('transaction_type')).toBe('expense');
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
      const { result } = renderHook(() => useTransactions(familyId), { wrapper });

      // Assert - Initial loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should handle 401 unauthorized error', async () => {
      // Arrange - Override to return 401
      server.use(
        http.get('http://localhost:8000/transactions', () => {
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

      // Act - Render the hook
      const { result } = renderHook(() => useTransactions(familyId), { wrapper });

      // Assert - Wait for error state (no retries in test config)
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle 403 forbidden error', async () => {
      // Arrange - Override to return 403
      server.use(
        http.get('http://localhost:8000/transactions', () => {
          return HttpResponse.json(
            { detail: 'Not authorized to access transactions for this tenant' },
            { status: 403 }
          );
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act
      const { result } = renderHook(() => useTransactions(familyId), { wrapper });

      // Assert - Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle network errors gracefully', async () => {
      // Arrange - Simulate network error
      server.use(
        http.get('http://localhost:8000/transactions', () => {
          return HttpResponse.error();
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act
      const { result } = renderHook(() => useTransactions(familyId), { wrapper });

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('Query key variations', () => {
    it('should use different query keys for different filters', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render with filter 1
      const { result: result1 } = renderHook(
        () => useTransactions(familyId, { account_id: 'account-1' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Act - Render with filter 2
      const { result: result2 } = renderHook(
        () => useTransactions(familyId, { account_id: 'account-2' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Assert - Both queries should exist in cache with different keys
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.findAll({
        predicate: (query) => {
          const key = query.queryKey;
          return key[0] === 'transactions' && key[1] === familyId;
        },
      });

      expect(queries.length).toBeGreaterThan(1);
    });

    it('should not refetch when familyId remains the same', async () => {
      // Arrange
      let fetchCount = 0;
      server.use(
        http.get('http://localhost:8000/transactions', () => {
          fetchCount++;
          return HttpResponse.json(createMockTransactionList(2));
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render hook twice with same familyId
      const { result: result1 } = renderHook(() => useTransactions(familyId), { wrapper });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const firstFetchCount = fetchCount;

      // Render again with same familyId - should use cache
      const { result: result2 } = renderHook(() => useTransactions(familyId), { wrapper });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Assert - Should not have made additional fetch (using cached data)
      expect(fetchCount).toBe(firstFetchCount);
    });
  });
});
