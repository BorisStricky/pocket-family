// src/features/accounts/__tests__/useCreateAccountShare.test.ts
// Tests for useCreateAccountShare mutation hook

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateAccountShare } from '../hooks/useCreateAccountShare';
import * as accountSharesApi from '../api/accountSharesApi';
import type { AccountShareCreate, AccountShareRead } from '@/types/account';

// Mock the API module
vi.mock('../api/accountSharesApi');

describe('useCreateAccountShare', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  // Helper function to render hook with QueryClient wrapper
  const renderUseCreateAccountShareHook = (accountId: string) => {
    return renderHook(() => useCreateAccountShare(accountId), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });
  };

  it('should successfully create a new account share', async () => {
    const accountId = 'account-1';
    const shareData: AccountShareCreate = {
      tenant_id: 'tenant-1',
      visibility: 'hidden',
    };
    const mockCreatedShare: AccountShareRead = {
      id: 'share-1',
      account_id: accountId,
      tenant_id: 'tenant-1',
      visibility: 'hidden',
      granted_by: 'user-1',
      granted_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(accountSharesApi.createAccountShare).mockResolvedValue(mockCreatedShare);

    const { result } = renderUseCreateAccountShareHook(accountId);

    // Initially not pending
    expect(result.current.isPending).toBe(false);

    // Trigger the mutation
    await act(async () => {
      result.current.mutate(shareData);
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockCreatedShare);
    expect(accountSharesApi.createAccountShare).toHaveBeenCalledWith(accountId, shareData);
  });

  it('should invalidate account shares query cache on success', async () => {
    const accountId = 'account-1';
    const shareData: AccountShareCreate = {
      tenant_id: 'tenant-1',
      visibility: 'visible',
    };
    const mockCreatedShare: AccountShareRead = {
      id: 'share-1',
      account_id: accountId,
      tenant_id: 'tenant-1',
      visibility: 'visible',
      granted_by: 'user-1',
      granted_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(accountSharesApi.createAccountShare).mockResolvedValue(mockCreatedShare);

    // Set up initial query data
    const queryKey = ['accountShares', accountId];
    queryClient.setQueryData(queryKey, []);

    const { result } = renderUseCreateAccountShareHook(accountId);

    // Spy on invalidateQueries
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Trigger the mutation
    await act(async () => {
      result.current.mutate(shareData);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Check that invalidateQueries was called with correct query key
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['accountShares', accountId],
    });
  });

  it('should handle error when share creation fails', async () => {
    const accountId = 'account-1';
    const shareData: AccountShareCreate = {
      tenant_id: 'tenant-1',
      visibility: 'hidden',
    };
    const mockError = new Error('Failed to create share');

    vi.mocked(accountSharesApi.createAccountShare).mockRejectedValue(mockError);

    const { result } = renderUseCreateAccountShareHook(accountId);

    // Trigger the mutation
    await act(async () => {
      result.current.mutate(shareData);
    });

    // Wait for mutation to complete with error
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeUndefined();
  });

  it('should handle duplicate share error (400)', async () => {
    const accountId = 'account-1';
    const shareData: AccountShareCreate = {
      tenant_id: 'tenant-1',
      visibility: 'hidden',
    };
    const duplicateError = new Error('Share already exists');
    (duplicateError as any).status = 400;

    vi.mocked(accountSharesApi.createAccountShare).mockRejectedValue(duplicateError);

    const { result } = renderUseCreateAccountShareHook(accountId);

    await act(async () => {
      result.current.mutate(shareData);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should handle permission error when user is not account owner (403)', async () => {
    const accountId = 'account-1';
    const shareData: AccountShareCreate = {
      tenant_id: 'tenant-1',
      visibility: 'hidden',
    };
    const permissionError = new Error('Not authorized');
    (permissionError as any).status = 403;

    vi.mocked(accountSharesApi.createAccountShare).mockRejectedValue(permissionError);

    const { result } = renderUseCreateAccountShareHook(accountId);

    await act(async () => {
      result.current.mutate(shareData);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should handle not found error (404)', async () => {
    const accountId = 'account-1';
    const shareData: AccountShareCreate = {
      tenant_id: 'tenant-1',
      visibility: 'hidden',
    };
    const notFoundError = new Error('Account or tenant not found');
    (notFoundError as any).status = 404;

    vi.mocked(accountSharesApi.createAccountShare).mockRejectedValue(notFoundError);

    const { result } = renderUseCreateAccountShareHook(accountId);

    await act(async () => {
      result.current.mutate(shareData);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should reset mutation state correctly', async () => {
    const accountId = 'account-1';
    const shareData: AccountShareCreate = {
      tenant_id: 'tenant-1',
      visibility: 'hidden',
    };
    const mockCreatedShare: AccountShareRead = {
      id: 'share-1',
      account_id: accountId,
      tenant_id: 'tenant-1',
      visibility: 'hidden',
      granted_by: 'user-1',
      granted_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(accountSharesApi.createAccountShare).mockResolvedValue(mockCreatedShare);

    const { result } = renderUseCreateAccountShareHook(accountId);

    // Trigger the mutation
    await act(async () => {
      result.current.mutate(shareData);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Reset mutation state
    act(() => {
      result.current.reset();
    });

    // Wait for reset to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
