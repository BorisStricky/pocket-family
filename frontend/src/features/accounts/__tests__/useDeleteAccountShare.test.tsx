// src/features/accounts/__tests__/useDeleteAccountShare.test.ts
// Tests for useDeleteAccountShare mutation hook

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteAccountShare } from '../hooks/useDeleteAccountShare';
import * as accountSharesApi from '../api/accountSharesApi';

// Mock the API module
vi.mock('../api/accountSharesApi');

describe('useDeleteAccountShare', () => {
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

  const renderUseDeleteAccountShareHook = () => {
    return renderHook(() => useDeleteAccountShare(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });
  };

  it('should successfully delete an account share', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';

    vi.mocked(accountSharesApi.deleteAccountShare).mockResolvedValue(undefined);

    const { result } = renderUseDeleteAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(accountSharesApi.deleteAccountShare).toHaveBeenCalledWith(accountId, tenantId);
  });

  it('should invalidate account shares query cache on success', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';

    vi.mocked(accountSharesApi.deleteAccountShare).mockResolvedValue(undefined);

    const queryKey = ['accountShares', accountId];
    queryClient.setQueryData(queryKey, []);

    const { result } = renderUseDeleteAccountShareHook();

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ accountId, tenantId });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['accountShares', accountId],
    });
  });

  it('should handle error when deletion fails', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';
    const mockError = new Error('Failed to delete share');

    vi.mocked(accountSharesApi.deleteAccountShare).mockRejectedValue(mockError);

    const { result } = renderUseDeleteAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should handle permission error (403)', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';
    const permissionError = new Error('Not authorized');
    (permissionError as any).status = 403;

    vi.mocked(accountSharesApi.deleteAccountShare).mockRejectedValue(permissionError);

    const { result } = renderUseDeleteAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should handle not found error (404)', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';
    const notFoundError = new Error('Share not found');
    (notFoundError as any).status = 404;

    vi.mocked(accountSharesApi.deleteAccountShare).mockRejectedValue(notFoundError);

    const { result } = renderUseDeleteAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should support deleting multiple shares sequentially', async () => {
    const accountId = 'account-1';
    const tenantId1 = 'tenant-1';
    const tenantId2 = 'tenant-2';

    vi.mocked(accountSharesApi.deleteAccountShare).mockResolvedValue(undefined);

    const { result } = renderUseDeleteAccountShareHook();

    // Delete first share
    await act(async () => {
      result.current.mutate({ accountId, tenantId: tenantId1 });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(accountSharesApi.deleteAccountShare).toHaveBeenCalledWith(accountId, tenantId1);

    // Reset and delete second share
    act(() => {
      result.current.reset();
    });

    await act(async () => {
      result.current.mutate({ accountId, tenantId: tenantId2 });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(accountSharesApi.deleteAccountShare).toHaveBeenCalledWith(accountId, tenantId2);
  });

  it('should not have data after successful deletion (void return)', async () => {
    const accountId = 'account-1';
    const tenantId = 'tenant-1';

    vi.mocked(accountSharesApi.deleteAccountShare).mockResolvedValue(undefined);

    const { result } = renderUseDeleteAccountShareHook();

    await act(async () => {
      result.current.mutate({ accountId, tenantId });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // DELETE endpoints return void, so data should be undefined
    expect(result.current.data).toBeUndefined();
  });
});
