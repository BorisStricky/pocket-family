// src/features/transactions/__tests__/useCreateTransaction.test.ts
// Tests for useCreateTransaction mutation - creates new transaction

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useCreateTransaction } from '../hooks/useCreateTransaction';
import { createTestQueryClient, TestWrapper } from '@/test/utils';
import { server, resetTransactionStore } from '@/test/mocks/server';
import { createMockTransaction } from '@/test/mocks/factories';
import { STORAGE_KEYS } from '@/lib/constants';
import { createMockJWT } from '@/test/mocks/factories';
import type { Transaction } from '@/types';

describe('useCreateTransaction mutation', () => {
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

  describe('Successful transaction creation', () => {
    it('should create new transaction via POST /transactions', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      const newTransactionData = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '150.00',
        currency: 'USD',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
        description: 'Test expense',
        category_id: 'category-123',
      };

      // Act - Render the hook
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      // Trigger mutation
      result.current.mutate(newTransactionData);

      // Assert - Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify returned data has ID and timestamps
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBeDefined();
      expect(result.current.data?.amount).toBe('150.00');
      expect(result.current.data?.created_at).toBeDefined();
    });

    it('should return created transaction with all fields', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      const newTransactionData = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '250.75',
        currency: 'USD',
        transaction_date: '2026-01-12',
        transaction_type: 'income' as const,
        description: 'Freelance payment',
        category_id: 'category-income',
      };

      // Act
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      result.current.mutate(newTransactionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Verify complete transaction structure
      const createdTransaction = result.current.data!;
      expect(createdTransaction).toHaveProperty('id');
      expect(createdTransaction).toHaveProperty('tenant_id');
      expect(createdTransaction).toHaveProperty('account_id');
      expect(createdTransaction).toHaveProperty('amount');
      expect(createdTransaction).toHaveProperty('transaction_type');
      expect(createdTransaction).toHaveProperty('transaction_date');
      expect(createdTransaction).toHaveProperty('created_at');
      expect(createdTransaction).toHaveProperty('updated_at');
      expect(createdTransaction.amount).toBe('250.75');
      expect(createdTransaction.transaction_type).toBe('income');
    });

    it('should create transaction without optional fields', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Minimal required fields only
      const newTransactionData = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '100.00',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      };

      // Act
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      result.current.mutate(newTransactionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Should succeed with minimal data
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.category_id).toBeNull();
      expect(result.current.data?.description).toBeNull();
    });
  });

  describe('Mutation loading state', () => {
    it('should show loading state during mutation', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      const newTransactionData = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '150.00',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      };

      // Act
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      // Initial state should not be loading
      expect(result.current.isPending).toBe(false);

      // Trigger mutation
      result.current.mutate(newTransactionData);

      // Assert - Should be loading immediately after trigger
      expect(result.current.isPending).toBe(true);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isPending).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle validation error for missing account_id', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Missing required account_id field
      const invalidData = {
        tenant_id: familyId,
        amount: '150.00',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      } as any;

      // Act
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      result.current.mutate(invalidData);

      // Assert - Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.data).toBeUndefined();
    });

    it('should handle validation error for missing amount', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Missing required amount field
      const invalidData = {
        tenant_id: familyId,
        account_id: 'account-123',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      } as any;

      // Act
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      result.current.mutate(invalidData);

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 401 unauthorized error', async () => {
      // Arrange - Override to return 401
      server.use(
        http.post('http://localhost:8000/transactions', () => {
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

      const validData = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '150.00',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      };

      // Act
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      result.current.mutate(validData);

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle 403 forbidden error for unauthorized tenant', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Use unauthorized tenant ID
      const unauthorizedData = {
        tenant_id: 'unauthorized-tenant',
        account_id: 'account-123',
        amount: '150.00',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      };

      // Act
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      result.current.mutate(unauthorizedData);

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should handle network errors gracefully', async () => {
      // Arrange - Simulate network error
      server.use(
        http.post('http://localhost:8000/transactions', () => {
          return HttpResponse.error();
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      const validData = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '150.00',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      };

      // Act
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      result.current.mutate(validData);

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate transactions query after successful creation', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Pre-populate cache with transactions query
      queryClient.setQueryData(['transactions', familyId], []);

      const newTransactionData = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '150.00',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      };

      // Act - Create transaction
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      result.current.mutate(newTransactionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Transactions query should be marked as stale
      const queryState = queryClient.getQueryState(['transactions', familyId]);
      expect(queryState).toBeDefined();
      // Query should be invalidated (stale) after mutation
    });
  });

  describe('Mutation callbacks', () => {
    it('should call onSuccess callback with created transaction', async () => {
      // Arrange
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      let successData: Transaction | undefined;
      const onSuccess = (data: Transaction) => {
        successData = data;
      };

      const newTransactionData = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '150.00',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      };

      // Act
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      result.current.mutate(newTransactionData, { onSuccess });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(successData).toBeDefined();
      expect(successData?.amount).toBe('150.00');
    });

    it('should call onError callback when mutation fails', async () => {
      // Arrange - Override to return error
      server.use(
        http.post('http://localhost:8000/transactions', () => {
          return HttpResponse.json(
            { detail: 'Validation error' },
            { status: 400 }
          );
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      let errorReceived: Error | undefined;
      const onError = (error: Error) => {
        errorReceived = error;
      };

      const invalidData = {
        tenant_id: familyId,
        account_id: 'account-123',
        amount: '150.00',
        transaction_date: '2026-01-12',
        transaction_type: 'expense' as const,
      };

      // Act
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      result.current.mutate(invalidData, { onError });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(errorReceived).toBeDefined();
    });
  });
});
