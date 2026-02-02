// src/features/accounts/__tests__/useUpdateAccountShare.test.ts
// Tests for useUpdateAccountShare mutation hook

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdateAccountShare } from '../hooks/useUpdateAccountShare';
import * as accountSharesApi from '../api/accountSharesApi';
import type { AccountShareUpdate, AccountShareRead } from '@/types/account';

// Mock the API module
vi.mock('../api/accountSharesApi');

describe('useUpdateAccountShare', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
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

  const renderUseUpdateAccountShareHook = () => {
    return renderHook(() => useUpdateAccountShare(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });
  };

  it('should successfully update share visibility', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';
    const updateData: AccountShareUpdate = {
      visibility: 'visible',
    };
    const mockUpdatedShare: AccountShareRead = {
      id: 'share-1',
      account_id: accountId,
      tenant_id: tenantId,
      visibility: 'visible',
      granted_by: 'user-1',
      granted_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(accountSharesApi.updateAccountShare).mockResolvedValue(mockUpdatedShare);

    const { result } = renderUseUpdateAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId, data: updateData });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockUpdatedShare);
    expect(accountSharesApi.updateAccountShare).toHaveBeenCalledWith(
      accountId,
      tenantId,
      updateData
    );
  });

  it('should invalidate account shares query cache on success', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';
    const updateData: AccountShareUpdate = {
      visibility: 'hidden',
    };
    const mockUpdatedShare: AccountShareRead = {
      id: 'share-1',
      account_id: accountId,
      tenant_id: tenantId,
      visibility: 'hidden',
      granted_by: 'user-1',
      granted_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(accountSharesApi.updateAccountShare).mockResolvedValue(mockUpdatedShare);

    const queryKey = ['accountShares', accountId];
    queryClient.setQueryData(queryKey, [mockUpdatedShare]);

    const { result } = renderUseUpdateAccountShareHook();

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ accountId, tenantId, data: updateData });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['accountShares', accountId],
    });
  });

  it('should handle error when update fails', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';
    const updateData: AccountShareUpdate = {
      visibility: 'visible',
    };
    const mockError = new Error('Failed to update share');

    vi.mocked(accountSharesApi.updateAccountShare).mockRejectedValue(mockError);

    const { result } = renderUseUpdateAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId, data: updateData });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeUndefined();
  });

  it('should handle permission error (403)', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';
    const updateData: AccountShareUpdate = {
      visibility: 'visible',
    };
    const permissionError = new Error('Not authorized');
    (permissionError as any).status = 403;

    vi.mocked(accountSharesApi.updateAccountShare).mockRejectedValue(permissionError);

    const { result } = renderUseUpdateAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId, data: updateData });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should handle not found error (404)', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';
    const updateData: AccountShareUpdate = {
      visibility: 'visible',
    };
    const notFoundError = new Error('Share not found');
    (notFoundError as any).status = 404;

    vi.mocked(accountSharesApi.updateAccountShare).mockRejectedValue(notFoundError);

    const { result } = renderUseUpdateAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId, data: updateData });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should support changing visibility from hidden to visible', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';
    const updateData: AccountShareUpdate = {
      visibility: 'visible',
    };
    const mockUpdatedShare: AccountShareRead = {
      id: 'share-1',
      account_id: accountId,
      tenant_id: tenantId,
      visibility: 'visible',
      granted_by: 'user-1',
      granted_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(accountSharesApi.updateAccountShare).mockResolvedValue(mockUpdatedShare);

    const { result } = renderUseUpdateAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId, data: updateData });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.visibility).toBe('visible');
  });

  it('should support changing visibility from visible to hidden', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';
    const updateData: AccountShareUpdate = {
      visibility: 'hidden',
    };
    const mockUpdatedShare: AccountShareRead = {
      id: 'share-1',
      account_id: accountId,
      tenant_id: tenantId,
      visibility: 'hidden',
      granted_by: 'user-1',
      granted_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(accountSharesApi.updateAccountShare).mockResolvedValue(mockUpdatedShare);

    const { result } = renderUseUpdateAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId, data: updateData });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.visibility).toBe('hidden');
  });
});
