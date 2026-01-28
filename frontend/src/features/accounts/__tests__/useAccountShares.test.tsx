// src/features/accounts/__tests__/useAccountShares.test.ts
// Tests for useAccountShares hook

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAccountShares } from '../hooks/useAccountShares';
import * as accountSharesApi from '../api/accountSharesApi';
import type { AccountShareRead } from '@/types/account';

// Mock the API module
vi.mock('../api/accountSharesApi');

describe('useAccountShares', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test to ensure isolation
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for tests
        },
      },
    });
    vi.clearAllMocks();
  });

  // Helper function to render hook with QueryClient wrapper
  const renderUseAccountSharesHook = (accountId: string, isOwner: boolean) => {
    return renderHook(() => useAccountShares(accountId, { isOwner }), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });
  };

  it('should successfully fetch and return shares array when user is owner', async () => {
    const mockShares: AccountShareRead[] = [
      {
        id: 'share-1',
        account_id: 'account-1',
        tenant_id: 'tenant-1',
        visibility: 'visible',
        granted_by: 'user-1',
        granted_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'share-2',
        account_id: 'account-1',
        tenant_id: 'tenant-2',
        visibility: 'hidden',
        granted_by: 'user-1',
        granted_at: '2024-01-02T00:00:00Z',
      },
    ];

    vi.mocked(accountSharesApi.getAccountShares).mockResolvedValue(mockShares);

    const { result } = renderUseAccountSharesHook('account-1', true);

    // Initially should be loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Wait for the query to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have the shares data
    expect(result.current.data).toEqual(mockShares);
    expect(result.current.error).toBeNull();
    expect(accountSharesApi.getAccountShares).toHaveBeenCalledWith('account-1');
  });

  it('should return empty array when no shares exist', async () => {
    vi.mocked(accountSharesApi.getAccountShares).mockResolvedValue([]);

    const { result } = renderUseAccountSharesHook('account-1', true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should handle loading state correctly', () => {
    vi.mocked(accountSharesApi.getAccountShares).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    const { result } = renderUseAccountSharesHook('account-1', true);

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should handle error state when API call fails', async () => {
    const mockError = new Error('Failed to fetch shares');
    vi.mocked(accountSharesApi.getAccountShares).mockRejectedValue(mockError);

    const { result } = renderUseAccountSharesHook('account-1', true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeUndefined();
  });

  it('should not fetch when isOwner is false (query disabled)', () => {
    vi.mocked(accountSharesApi.getAccountShares).mockResolvedValue([]);

    const { result } = renderUseAccountSharesHook('account-1', false);

    // Query should be disabled, so isLoading should be false and no API call made
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(accountSharesApi.getAccountShares).not.toHaveBeenCalled();
  });

  it('should not fetch when isOwner is undefined (defaults to false)', () => {
    vi.mocked(accountSharesApi.getAccountShares).mockResolvedValue([]);

    const { result } = renderHook(() => useAccountShares('account-1', {}), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(accountSharesApi.getAccountShares).not.toHaveBeenCalled();
  });

  it('should use correct query key for cache isolation', async () => {
    const mockShares: AccountShareRead[] = [];
    vi.mocked(accountSharesApi.getAccountShares).mockResolvedValue(mockShares);

    const { result } = renderUseAccountSharesHook('account-123', true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Query key should be ['accountShares', accountId]
    const queryKey = ['accountShares', 'account-123'];
    const cachedData = queryClient.getQueryData(queryKey);
    expect(cachedData).toEqual(mockShares);
  });
});
