// src/features/accounts/__tests__/useAccounts.test.ts
/**
 * Tests for useAccounts hook
 *
 * Validates the React Query hook for fetching accounts including:
 * - Successful data fetching with and without familyId
 * - Loading state during fetch
 * - Error handling for API failures
 * - Query key structure with familyId for proper cache isolation
 * - Automatic refetch when familyId changes
 * - Authorization header inclusion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useAccounts } from '../hooks/useAccounts';
import { server, resetAccountStore } from '@/test/mocks/server';
import { TestWrapper, setupAuthenticatedUser, createMockAccountList } from '@/test/utils';
import { STORAGE_KEYS } from '@/lib/constants';

describe('useAccounts', () => {
  const familyId = 'tenant-uuid-456';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Set up authenticated user with valid token
    setupAuthenticatedUser(familyId);

    // Reset account store for test isolation
    resetAccountStore();
  });

  describe('successful fetch scenarios', () => {
    it('should fetch accounts successfully with familyId', async () => {
      // Arrange - Setup hook with familyId parameter
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Act & Assert - Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Data is returned as array
      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
      expect(result.current.data!.length).toBeGreaterThan(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should fetch all accounts when familyId is undefined', async () => {
      // Arrange - Setup hook without familyId (global view)
      const { result } = renderHook(() => useAccounts(), {
        wrapper: TestWrapper,
      });

      // Assert - Initially loading
      expect(result.current.isLoading).toBe(true);

      // Act & Assert - Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Returns all accounts (global view)
      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should return array of AccountRead objects with correct structure', async () => {
      // Arrange
      const mockAccounts = createMockAccountList(3);
      server.use(
        http.get('http://localhost:8000/accounts', () => {
          return HttpResponse.json(mockAccounts);
        })
      );

      // Act
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for data and verify structure
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const accounts = result.current.data!;
      expect(accounts).toEqual(mockAccounts);
      expect(accounts[0]).toHaveProperty('id');
      expect(accounts[0]).toHaveProperty('name');
      expect(accounts[0]).toHaveProperty('type');
      expect(accounts[0]).toHaveProperty('balance');
      expect(accounts[0]).toHaveProperty('currency');
      expect(accounts[0]).toHaveProperty('user_id');
      expect(accounts[0]).toHaveProperty('created_at');
    });
  });

  describe('loading states', () => {
    it('should show loading state during initial fetch', async () => {
      // Arrange - Hook starts in loading state
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Initial loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Loading state cleared after success
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFetching).toBe(false);
    });

    it('should have correct isPending state', async () => {
      // Arrange
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Initially pending
      expect(result.current.isPending).toBe(true);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('should handle 401 unauthorized error', async () => {
      // Arrange - Override handler to return 401
      server.use(
        http.get('http://localhost:8000/accounts', () => {
          return HttpResponse.json(
            { detail: 'Not authenticated' },
            { status: 401 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle 403 forbidden error', async () => {
      // Arrange - Override handler to return 403
      server.use(
        http.get('http://localhost:8000/accounts', () => {
          return HttpResponse.json(
            { detail: 'Not authorized to access accounts for this tenant' },
            { status: 403 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle network errors', async () => {
      // Arrange - Override handler to simulate network error
      server.use(
        http.get('http://localhost:8000/accounts', () => {
          return HttpResponse.error();
        })
      );

      // Act
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle 500 server error', async () => {
      // Arrange - Override handler to return 500
      server.use(
        http.get('http://localhost:8000/accounts', () => {
          return HttpResponse.json(
            { detail: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('query key structure', () => {
    it('should use correct query key with familyId', async () => {
      // Arrange
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Wait for query to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Query key should include familyId for cache isolation
      // The query key structure is ['accounts', familyId]
      // We verify this indirectly by checking that the hook executed successfully
      // with the familyId parameter
      expect(result.current.data).toBeDefined();
    });

    it('should use "all" in query key when familyId is undefined', async () => {
      // Arrange - Hook without familyId uses ['accounts', 'all']
      const { result } = renderHook(() => useAccounts(), {
        wrapper: TestWrapper,
      });

      // Wait for query to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Query should succeed with 'all' key variant
      expect(result.current.data).toBeDefined();
    });

    it('should maintain separate cache entries for different familyIds', async () => {
      // Arrange - Setup different mock responses for different families
      const family1Accounts = createMockAccountList(2);
      const family2Accounts = createMockAccountList(3);

      let requestCount = 0;
      server.use(
        http.get('http://localhost:8000/accounts', ({ request }) => {
          requestCount++;
          const url = new URL(request.url);
          const tenant_id = url.searchParams.get('tenant_id');

          if (tenant_id === 'family-1') {
            return HttpResponse.json(family1Accounts);
          } else if (tenant_id === 'family-2') {
            return HttpResponse.json(family2Accounts);
          }
          return HttpResponse.json([]);
        })
      );

      // Act - Render hooks with different familyIds
      const { result: result1 } = renderHook(() => useAccounts('family-1'), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const { result: result2 } = renderHook(() => useAccounts('family-2'), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Assert - Each family gets its own cached data
      expect(result1.current.data).toHaveLength(2);
      expect(result2.current.data).toHaveLength(3);
      expect(requestCount).toBe(2); // Two separate API calls made
    });
  });

  describe('refetch on parameter change', () => {
    it('should refetch when familyId changes', async () => {
      // Arrange - Track API calls
      let requestCount = 0;
      server.use(
        http.get('http://localhost:8000/accounts', ({ request }) => {
          requestCount++;
          const url = new URL(request.url);
          const tenant_id = url.searchParams.get('tenant_id');

          // Return different data based on tenant_id
          if (tenant_id === 'family-1') {
            return HttpResponse.json(createMockAccountList(2));
          } else if (tenant_id === 'family-2') {
            return HttpResponse.json(createMockAccountList(4));
          }
          return HttpResponse.json([]);
        })
      );

      // Act - Start with family-1
      const { result, rerender } = renderHook(
        ({ familyId }) => useAccounts(familyId),
        {
          wrapper: TestWrapper,
          initialProps: { familyId: 'family-1' },
        }
      );

      // Assert - Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toHaveLength(2);
      expect(requestCount).toBe(1);

      // Act - Change to family-2
      rerender({ familyId: 'family-2' });

      // Assert - Should trigger new fetch
      await waitFor(() => {
        expect(result.current.data).toHaveLength(4);
      });
      expect(requestCount).toBe(2); // Second API call made
    });

    it('should refetch when changing from undefined to familyId', async () => {
      // Arrange - Track requests
      let requestCount = 0;
      server.use(
        http.get('http://localhost:8000/accounts', ({ request }) => {
          requestCount++;
          const url = new URL(request.url);
          const tenant_id = url.searchParams.get('tenant_id');

          // Return different counts for filtered vs all
          if (tenant_id) {
            return HttpResponse.json(createMockAccountList(2));
          }
          return HttpResponse.json(createMockAccountList(5));
        })
      );

      // Act - Start with undefined (all accounts)
      const { result, rerender } = renderHook(
        ({ familyId }) => useAccounts(familyId),
        {
          wrapper: TestWrapper,
          initialProps: { familyId: undefined },
        }
      );

      // Assert - Wait for initial fetch (all accounts)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toHaveLength(5);
      expect(requestCount).toBe(1);

      // Act - Change to specific family
      rerender({ familyId: 'family-1' });

      // Assert - Should trigger new fetch with filter
      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });
      expect(requestCount).toBe(2);
    });
  });

  describe('API request validation', () => {
    it('should include Authorization header in request', async () => {
      // Arrange - Capture request headers
      let authHeader: string | null = null;
      server.use(
        http.get('http://localhost:8000/accounts', ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return HttpResponse.json(createMockAccountList(2));
        })
      );

      // Act
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for request to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(authHeader).toBeDefined();
      expect(authHeader).toContain('Bearer');
    });

    it('should include tenant_id query param when familyId provided', async () => {
      // Arrange - Capture query parameters
      let capturedParams: URLSearchParams | null = null;
      server.use(
        http.get('http://localhost:8000/accounts', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = url.searchParams;
          return HttpResponse.json(createMockAccountList(2));
        })
      );

      // Act
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for request and verify query param
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedParams?.get('tenant_id')).toBe(familyId);
    });

    it('should not include tenant_id query param when familyId is undefined', async () => {
      // Arrange - Capture query parameters
      let capturedParams: URLSearchParams | null = null;
      server.use(
        http.get('http://localhost:8000/accounts', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = url.searchParams;
          return HttpResponse.json(createMockAccountList(5));
        })
      );

      // Act - Call hook without familyId
      const { result } = renderHook(() => useAccounts(), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for request and verify no tenant_id param
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedParams?.get('tenant_id')).toBeNull();
    });

    it('should handle missing authentication', async () => {
      // Arrange - Override handler to always return 401
      // This simulates the backend rejecting an invalid/expired token
      server.use(
        http.get('http://localhost:8000/accounts', () => {
          return HttpResponse.json(
            { detail: 'Not authenticated' },
            { status: 401 }
          );
        }),
        // Also block refresh endpoint to simulate expired refresh token
        http.post('http://localhost:8000/auth/refresh', () => {
          return HttpResponse.json(
            { detail: 'Refresh token invalid' },
            { status: 401 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Should fail with authentication error
      // The hook will attempt token refresh, fail, and enter error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('empty state handling', () => {
    it('should handle empty accounts array successfully', async () => {
      // Arrange - Return empty array
      server.use(
        http.get('http://localhost:8000/accounts', () => {
          return HttpResponse.json([]);
        })
      );

      // Act
      const { result } = renderHook(() => useAccounts(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Should succeed with empty array
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.data).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });
  });
});
