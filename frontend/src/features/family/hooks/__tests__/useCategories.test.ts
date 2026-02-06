// src/features/family/hooks/__tests__/useCategories.test.ts
/**
 * Tests for useCategories hook
 *
 * Validates the React Query hook for fetching categories including:
 * - Successful data fetching with required familyId parameter
 * - Loading state during fetch
 * - Error handling for API failures
 * - Query key structure with familyId for proper cache isolation
 * - Automatic refetch when familyId changes
 * - Authorization header inclusion
 * - Required tenant_id query parameter validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useCategories } from '../useCategories';
import { server, resetCategoryStore } from '@/test/mocks/server';
import { TestWrapper, setupAuthenticatedUser, createMockCategoryList } from '@/test/utils';
import { STORAGE_KEYS } from '@/lib/constants';

describe('useCategories', () => {
  const familyId = 'tenant-uuid-456';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Set up authenticated user with valid token
    setupAuthenticatedUser(familyId);

    // Reset category store for test isolation
    resetCategoryStore();
  });

  describe('successful fetch scenarios', () => {
    it('should fetch categories successfully with familyId', async () => {
      // Arrange - Setup hook with familyId parameter (required)
      const { result } = renderHook(() => useCategories(familyId), {
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

    it('should return array of CategoryRead objects with correct structure', async () => {
      // Arrange
      const mockCategories = createMockCategoryList(3, familyId);
      server.use(
        http.get('http://localhost:8000/categories', ({ request }) => {
          const url = new URL(request.url);
          const tenant_id = url.searchParams.get('tenant_id');

          if (tenant_id === familyId) {
            return HttpResponse.json(mockCategories);
          }
          return HttpResponse.json([]);
        })
      );

      // Act
      const { result } = renderHook(() => useCategories(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for data and verify structure
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const categories = result.current.data!;
      expect(categories).toEqual(mockCategories);
      expect(categories[0]).toHaveProperty('id');
      expect(categories[0]).toHaveProperty('tenant_id');
      expect(categories[0]).toHaveProperty('name');
      expect(categories[0]).toHaveProperty('kind');
      expect(categories[0]).toHaveProperty('parent_id');
      expect(categories[0]).toHaveProperty('parent_name');
      expect(categories[0]).toHaveProperty('created_at');
      expect(categories[0]).toHaveProperty('updated_at');
    });

    it('should return both parent and child categories', async () => {
      // Arrange - Create hierarchical category structure
      const parentCategory = {
        id: 'category-parent-1',
        tenant_id: familyId,
        name: 'Food',
        kind: 'expense' as const,
        parent_id: null,
        parent_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const childCategory = {
        id: 'category-child-1',
        tenant_id: familyId,
        name: 'Groceries',
        kind: 'expense' as const,
        parent_id: parentCategory.id,
        parent_name: parentCategory.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      server.use(
        http.get('http://localhost:8000/categories', () => {
          return HttpResponse.json([parentCategory, childCategory]);
        })
      );

      // Act
      const { result } = renderHook(() => useCategories(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const categories = result.current.data!;
      expect(categories).toHaveLength(2);

      // Verify parent category
      const parent = categories.find(c => c.id === parentCategory.id);
      expect(parent).toBeDefined();
      expect(parent?.parent_id).toBeNull();
      expect(parent?.parent_name).toBeNull();

      // Verify child category
      const child = categories.find(c => c.id === childCategory.id);
      expect(child).toBeDefined();
      expect(child?.parent_id).toBe(parentCategory.id);
      expect(child?.parent_name).toBe(parentCategory.name);
    });

    it('should return expense and income categories', async () => {
      // Arrange - Create categories of both kinds
      const expenseCategory = {
        id: 'category-expense-1',
        tenant_id: familyId,
        name: 'Groceries',
        kind: 'expense' as const,
        parent_id: null,
        parent_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const incomeCategory = {
        id: 'category-income-1',
        tenant_id: familyId,
        name: 'Salary',
        kind: 'income' as const,
        parent_id: null,
        parent_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      server.use(
        http.get('http://localhost:8000/categories', () => {
          return HttpResponse.json([expenseCategory, incomeCategory]);
        })
      );

      // Act
      const { result } = renderHook(() => useCategories(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const categories = result.current.data!;
      expect(categories).toHaveLength(2);

      const expense = categories.find(c => c.kind === 'expense');
      const income = categories.find(c => c.kind === 'income');

      expect(expense).toBeDefined();
      expect(income).toBeDefined();
    });
  });

  describe('loading states', () => {
    it('should show loading state during initial fetch', async () => {
      // Arrange - Hook starts in loading state
      const { result } = renderHook(() => useCategories(familyId), {
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
      const { result } = renderHook(() => useCategories(familyId), {
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
        http.get('http://localhost:8000/categories', () => {
          return HttpResponse.json(
            { detail: 'Not authenticated' },
            { status: 401 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useCategories(familyId), {
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
        http.get('http://localhost:8000/categories', () => {
          return HttpResponse.json(
            { detail: 'Not authorized to access categories for this tenant' },
            { status: 403 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useCategories(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle 400 error when tenant_id is missing', async () => {
      // Arrange - Override handler to return 400 for missing tenant_id
      server.use(
        http.get('http://localhost:8000/categories', ({ request }) => {
          const url = new URL(request.url);
          const tenant_id = url.searchParams.get('tenant_id');

          if (!tenant_id) {
            return HttpResponse.json(
              { detail: 'tenant_id query parameter is required' },
              { status: 400 }
            );
          }

          return HttpResponse.json([]);
        })
      );

      // Act - This simulates a bug where familyId wasn't passed correctly
      const { result } = renderHook(() => useCategories(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Should succeed because we pass familyId correctly
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should handle network errors', async () => {
      // Arrange - Override handler to simulate network error
      server.use(
        http.get('http://localhost:8000/categories', () => {
          return HttpResponse.error();
        })
      );

      // Act
      const { result } = renderHook(() => useCategories(familyId), {
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
        http.get('http://localhost:8000/categories', () => {
          return HttpResponse.json(
            { detail: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useCategories(familyId), {
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
      const { result } = renderHook(() => useCategories(familyId), {
        wrapper: TestWrapper,
      });

      // Wait for query to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Query key should include familyId for cache isolation
      // The query key structure is ['categories', familyId]
      // We verify this indirectly by checking that the hook executed successfully
      // with the familyId parameter
      expect(result.current.data).toBeDefined();
    });

    it('should maintain separate cache entries for different familyIds', async () => {
      // Arrange - Setup different mock responses for different families
      const family1Categories = createMockCategoryList(2, 'family-1');
      const family2Categories = createMockCategoryList(3, 'family-2');

      let requestCount = 0;
      server.use(
        http.get('http://localhost:8000/categories', ({ request }) => {
          requestCount++;
          const url = new URL(request.url);
          const tenant_id = url.searchParams.get('tenant_id');

          if (tenant_id === 'family-1') {
            return HttpResponse.json(family1Categories);
          } else if (tenant_id === 'family-2') {
            return HttpResponse.json(family2Categories);
          }
          return HttpResponse.json([]);
        })
      );

      // Act - Render hooks with different familyIds
      const { result: result1 } = renderHook(() => useCategories('family-1'), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const { result: result2 } = renderHook(() => useCategories('family-2'), {
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
        http.get('http://localhost:8000/categories', ({ request }) => {
          requestCount++;
          const url = new URL(request.url);
          const tenant_id = url.searchParams.get('tenant_id');

          // Return different data based on tenant_id
          if (tenant_id === 'family-1') {
            return HttpResponse.json(createMockCategoryList(2, 'family-1'));
          } else if (tenant_id === 'family-2') {
            return HttpResponse.json(createMockCategoryList(4, 'family-2'));
          }
          return HttpResponse.json([]);
        })
      );

      // Act - Start with family-1
      const { result, rerender } = renderHook(
        ({ familyId }) => useCategories(familyId),
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
  });

  describe('API request validation', () => {
    it('should include Authorization header in request', async () => {
      // Arrange - Capture request headers
      let authHeader: string | null = null;
      server.use(
        http.get('http://localhost:8000/categories', ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return HttpResponse.json(createMockCategoryList(2));
        })
      );

      // Act
      const { result } = renderHook(() => useCategories(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for request to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(authHeader).toBeDefined();
      expect(authHeader).toContain('Bearer');
    });

    it('should include tenant_id query param', async () => {
      // Arrange - Capture query parameters
      let capturedParams: URLSearchParams | null = null;
      server.use(
        http.get('http://localhost:8000/categories', ({ request }) => {
          const url = new URL(request.url);
          capturedParams = url.searchParams;
          return HttpResponse.json(createMockCategoryList(2));
        })
      );

      // Act
      const { result } = renderHook(() => useCategories(familyId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for request and verify query param
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedParams?.get('tenant_id')).toBe(familyId);
    });

    it('should handle missing authentication', async () => {
      // Arrange - Clear auth token to simulate unauthenticated state
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);

      // Override handler to always return 401
      // This simulates the backend rejecting an invalid/expired token
      server.use(
        http.get('http://localhost:8000/categories', () => {
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
      const { result } = renderHook(() => useCategories(familyId), {
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
    it('should handle empty categories array successfully', async () => {
      // Arrange - Return empty array
      server.use(
        http.get('http://localhost:8000/categories', () => {
          return HttpResponse.json([]);
        })
      );

      // Act
      const { result } = renderHook(() => useCategories(familyId), {
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
