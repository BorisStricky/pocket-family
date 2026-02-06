// src/features/family/hooks/__tests__/useCategory.test.ts
/**
 * Tests for useCategory hook
 *
 * Validates the React Query hook for fetching a single category including:
 * - Successful data fetching with categoryId parameter
 * - Loading state during fetch
 * - Error handling for 404 (category not found)
 * - Error handling for 403 (unauthorized access)
 * - Query key structure with categoryId for proper cache isolation
 * - Authorization header inclusion
 * - Parent category relationship data
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useCategory } from '../useCategory';
import { server, resetCategoryStore } from '@/test/mocks/server';
import { TestWrapper, setupAuthenticatedUser, createMockCategory } from '@/test/utils';

describe('useCategory', () => {
  const familyId = 'tenant-uuid-456';
  const testCategoryId = 'category-uuid-1'; // Use ID that exists in mock store

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Set up authenticated user with valid token
    setupAuthenticatedUser(familyId);

    // Reset category store for test isolation
    resetCategoryStore();
  });

  describe('successful fetch scenarios', () => {
    it('should fetch category successfully with categoryId', async () => {
      // Arrange - Setup hook with categoryId parameter
      const { result } = renderHook(() => useCategory(testCategoryId), {
        wrapper: TestWrapper,
      });

      // Assert - Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Act & Assert - Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Data is returned as single object
      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveProperty('id');
      expect(result.current.data).toHaveProperty('name');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return CategoryRead object with correct structure', async () => {
      // Arrange
      const mockCategory = createMockCategory({
        id: testCategoryId,
        name: 'Test Category',
        kind: 'expense',
      });

      server.use(
        http.get(`http://localhost:8000/categories/${testCategoryId}`, () => {
          return HttpResponse.json(mockCategory);
        })
      );

      // Act
      const { result } = renderHook(() => useCategory(testCategoryId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for data and verify structure
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const category = result.current.data!;
      expect(category).toEqual(mockCategory);
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('tenant_id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('kind');
      expect(category).toHaveProperty('parent_id');
      expect(category).toHaveProperty('parent_name');
      expect(category).toHaveProperty('created_at');
      expect(category).toHaveProperty('updated_at');
    });

    it('should fetch parent category with null parent_id', async () => {
      // Arrange - Create parent category (no parent)
      const parentCategory = createMockCategory({
        id: testCategoryId,
        name: 'Food',
        kind: 'expense',
        parent_id: null,
        parent_name: null,
      });

      server.use(
        http.get(`http://localhost:8000/categories/${testCategoryId}`, () => {
          return HttpResponse.json(parentCategory);
        })
      );

      // Act
      const { result } = renderHook(() => useCategory(testCategoryId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.parent_id).toBeNull();
      expect(result.current.data?.parent_name).toBeNull();
    });

    it('should fetch child category with parent relationship', async () => {
      // Arrange - Create child category with parent
      const childCategory = createMockCategory({
        id: testCategoryId,
        name: 'Groceries',
        kind: 'expense',
        parent_id: 'category-parent-uuid',
        parent_name: 'Food',
      });

      server.use(
        http.get(`http://localhost:8000/categories/${testCategoryId}`, () => {
          return HttpResponse.json(childCategory);
        })
      );

      // Act
      const { result } = renderHook(() => useCategory(testCategoryId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.parent_id).toBe('category-parent-uuid');
      expect(result.current.data?.parent_name).toBe('Food');
    });

    it('should fetch expense category', async () => {
      // Arrange
      const expenseCategory = createMockCategory({
        id: testCategoryId,
        kind: 'expense',
      });

      server.use(
        http.get(`http://localhost:8000/categories/${testCategoryId}`, () => {
          return HttpResponse.json(expenseCategory);
        })
      );

      // Act
      const { result } = renderHook(() => useCategory(testCategoryId), {
        wrapper: TestWrapper,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.kind).toBe('expense');
    });

    it('should fetch income category', async () => {
      // Arrange
      const incomeCategory = createMockCategory({
        id: testCategoryId,
        kind: 'income',
      });

      server.use(
        http.get(`http://localhost:8000/categories/${testCategoryId}`, () => {
          return HttpResponse.json(incomeCategory);
        })
      );

      // Act
      const { result } = renderHook(() => useCategory(testCategoryId), {
        wrapper: TestWrapper,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.kind).toBe('income');
    });
  });

  describe('loading states', () => {
    it('should show loading state during initial fetch', async () => {
      // Arrange - Hook starts in loading state
      const { result } = renderHook(() => useCategory(testCategoryId), {
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
      const { result } = renderHook(() => useCategory(testCategoryId), {
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
    it('should handle 404 not found error', async () => {
      // Arrange - Override handler to return 404
      server.use(
        http.get('http://localhost:8000/categories/:id', () => {
          return HttpResponse.json(
            { detail: 'Category not found' },
            { status: 404 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useCategory('non-existent-id'), {
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
        http.get('http://localhost:8000/categories/:id', () => {
          return HttpResponse.json(
            { detail: 'Not authorized to access this category' },
            { status: 403 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useCategory('unauthorized-id'), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle 401 unauthorized error', async () => {
      // Arrange - Override handler to return 401
      server.use(
        http.get('http://localhost:8000/categories/:id', () => {
          return HttpResponse.json(
            { detail: 'Not authenticated' },
            { status: 401 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useCategory(testCategoryId), {
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
        http.get('http://localhost:8000/categories/:id', () => {
          return HttpResponse.error();
        })
      );

      // Act
      const { result } = renderHook(() => useCategory(testCategoryId), {
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
        http.get('http://localhost:8000/categories/:id', () => {
          return HttpResponse.json(
            { detail: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      // Act
      const { result } = renderHook(() => useCategory(testCategoryId), {
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
    it('should use correct query key with categoryId', async () => {
      // Arrange
      const { result } = renderHook(() => useCategory(testCategoryId), {
        wrapper: TestWrapper,
      });

      // Wait for query to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Query key should include categoryId for cache isolation
      // The query key structure is ['category', categoryId]
      // We verify this indirectly by checking that the hook executed successfully
      expect(result.current.data).toBeDefined();
    });

    it('should maintain separate cache entries for different categoryIds', async () => {
      // Arrange - Create different categories
      const category1 = createMockCategory({
        id: 'category-1',
        name: 'Category 1',
      });

      const category2 = createMockCategory({
        id: 'category-2',
        name: 'Category 2',
      });

      let requestCount = 0;
      server.use(
        http.get('http://localhost:8000/categories/:id', ({ params }) => {
          requestCount++;
          const { id } = params;

          if (id === 'category-1') {
            return HttpResponse.json(category1);
          } else if (id === 'category-2') {
            return HttpResponse.json(category2);
          }
          return HttpResponse.json(
            { detail: 'Category not found' },
            { status: 404 }
          );
        })
      );

      // Act - Render hooks with different categoryIds
      const { result: result1 } = renderHook(() => useCategory('category-1'), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const { result: result2 } = renderHook(() => useCategory('category-2'), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Assert - Each category gets its own cached data
      expect(result1.current.data?.id).toBe('category-1');
      expect(result2.current.data?.id).toBe('category-2');
      expect(requestCount).toBe(2); // Two separate API calls made
    });
  });

  describe('API request validation', () => {
    it('should include Authorization header in request', async () => {
      // Arrange - Capture request headers
      let authHeader: string | null = null;
      server.use(
        http.get(`http://localhost:8000/categories/${testCategoryId}`, ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return HttpResponse.json(createMockCategory({ id: testCategoryId }));
        })
      );

      // Act
      const { result } = renderHook(() => useCategory(testCategoryId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for request to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(authHeader).toBeDefined();
      expect(authHeader).toContain('Bearer');
    });

    it('should send GET request to correct endpoint', async () => {
      // Arrange - Capture request URL and method
      let requestUrl: string | null = null;
      let requestMethod: string | null = null;
      server.use(
        http.get(`http://localhost:8000/categories/${testCategoryId}`, ({ request }) => {
          requestUrl = request.url;
          requestMethod = request.method;
          return HttpResponse.json(createMockCategory({ id: testCategoryId }));
        })
      );

      // Act
      const { result } = renderHook(() => useCategory(testCategoryId), {
        wrapper: TestWrapper,
      });

      // Assert - Wait for request to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(requestUrl).toContain(`/categories/${testCategoryId}`);
      expect(requestMethod).toBe('GET');
    });
  });

  describe('refetch on parameter change', () => {
    it('should refetch when categoryId changes', async () => {
      // Arrange - Track API calls
      let requestCount = 0;
      server.use(
        http.get('http://localhost:8000/categories/:id', ({ params }) => {
          requestCount++;
          const { id } = params;

          return HttpResponse.json(
            createMockCategory({
              id: id as string,
              name: `Category ${id}`,
            })
          );
        })
      );

      // Act - Start with category-1
      const { result, rerender } = renderHook(
        ({ categoryId }) => useCategory(categoryId),
        {
          wrapper: TestWrapper,
          initialProps: { categoryId: 'category-1' },
        }
      );

      // Assert - Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data?.id).toBe('category-1');
      expect(requestCount).toBe(1);

      // Act - Change to category-2
      rerender({ categoryId: 'category-2' });

      // Assert - Should trigger new fetch
      await waitFor(() => {
        expect(result.current.data?.id).toBe('category-2');
      });
      expect(requestCount).toBe(2); // Second API call made
    });
  });
});
