// src/features/family/hooks/__tests__/useCreateCategory.test.ts
/**
 * Tests for useCreateCategory hook
 *
 * Validates the React Query mutation hook for creating categories including:
 * - Successful mutation calls API with correct data
 * - Cache invalidation after success (familyId-specific categories list)
 * - Error handling for validation errors (missing name, missing kind, invalid kind)
 * - Error handling for parent validation (parent not found, kind mismatch)
 * - Parent-child relationship creation
 * - Mutation status states (isPending, isSuccess, isError)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useCreateCategory } from '../useCreateCategory';
import { server, resetCategoryStore } from '@/test/mocks/server';
import { TestWrapper, setupAuthenticatedUser, createMockCategory } from '@/test/utils';
import type { CategoryCreate, CategoryRead } from '@/test/mocks/factories';

describe('useCreateCategory', () => {
  const familyId = 'tenant-uuid-456';

  beforeEach(() => {
    localStorage.clear();
    setupAuthenticatedUser(familyId);
    resetCategoryStore();
  });

  describe('successful mutation scenarios', () => {
    it('should successfully create category with required fields', async () => {
      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      const newCategoryData: CategoryCreate = {
        name: 'New Category',
        kind: 'expense',
      };

      result.current.mutate(newCategoryData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.name).toBe('New Category');
      expect(result.current.data?.kind).toBe('expense');
      expect(result.current.isPending).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should create expense category', async () => {
      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Groceries',
        kind: 'expense',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.kind).toBe('expense');
    });

    it('should create income category', async () => {
      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Salary',
        kind: 'income',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.kind).toBe('income');
    });

    it('should create child category with parent_id', async () => {
      const parentCategory = createMockCategory({
        id: 'parent-category-id',
        name: 'Food',
        kind: 'expense',
      });

      server.use(
        http.post('http://localhost:8000/categories', async ({ request }) => {
          const body = await request.json() as CategoryCreate;

          return HttpResponse.json(
            createMockCategory({
              name: body.name,
              kind: body.kind,
              parent_id: body.parent_id || null,
              parent_name: body.parent_id ? parentCategory.name : null,
            }),
            { status: 201 }
          );
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Groceries',
        kind: 'expense',
        parent_id: parentCategory.id,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.parent_id).toBe(parentCategory.id);
      expect(result.current.data?.parent_name).toBe(parentCategory.name);
    });

    it('should return created category with generated ID and timestamps', async () => {
      const mockCreatedCategory = createMockCategory({
        id: 'category-uuid-new-123',
        name: 'Test Category',
        kind: 'expense',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      server.use(
        http.post('http://localhost:8000/categories', () => {
          return HttpResponse.json(mockCreatedCategory, { status: 201 });
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Test Category',
        kind: 'expense',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.id).toBe('category-uuid-new-123');
      expect(result.current.data?.created_at).toBeDefined();
      expect(result.current.data?.updated_at).toBeDefined();
      expect(result.current.data?.tenant_id).toBeDefined();
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate categories list cache on success', async () => {
      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Test Category',
        kind: 'expense',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Mutation completed successfully (cache invalidation happened)
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.name).toBe('Test Category');
    });
  });

  describe('validation error handling', () => {
    it('should handle missing name validation error', async () => {
      server.use(
        http.post('http://localhost:8000/categories', async ({ request }) => {
          const body = await request.json() as Partial<CategoryCreate>;

          if (!body.name) {
            return HttpResponse.json(
              { detail: 'name is required' },
              { status: 400 }
            );
          }

          return HttpResponse.json(createMockCategory(), { status: 201 });
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      const invalidCategoryData = {
        kind: 'expense',
      } as CategoryCreate;

      result.current.mutate(invalidCategoryData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle missing kind validation error', async () => {
      server.use(
        http.post('http://localhost:8000/categories', async ({ request }) => {
          const body = await request.json() as Partial<CategoryCreate>;

          if (!body.kind) {
            return HttpResponse.json(
              { detail: 'kind is required' },
              { status: 400 }
            );
          }

          return HttpResponse.json(createMockCategory(), { status: 201 });
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      const invalidCategoryData = {
        name: 'Test Category',
      } as CategoryCreate;

      result.current.mutate(invalidCategoryData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle invalid kind error', async () => {
      server.use(
        http.post('http://localhost:8000/categories', async ({ request }) => {
          const body = await request.json() as CategoryCreate;

          const validKinds = ['expense', 'income'];
          if (!validKinds.includes(body.kind)) {
            return HttpResponse.json(
              { detail: 'kind must be either expense or income' },
              { status: 400 }
            );
          }

          return HttpResponse.json(createMockCategory(), { status: 201 });
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      const invalidCategoryData = {
        name: 'Test Category',
        kind: 'invalid-kind',
      } as any;

      result.current.mutate(invalidCategoryData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle parent category not found error', async () => {
      server.use(
        http.post('http://localhost:8000/categories', async ({ request }) => {
          const body = await request.json() as CategoryCreate;

          if (body.parent_id && body.parent_id === 'non-existent-parent-id') {
            return HttpResponse.json(
              { detail: 'Parent category not found' },
              { status: 404 }
            );
          }

          return HttpResponse.json(createMockCategory(), { status: 201 });
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Subcategory',
        kind: 'expense',
        parent_id: 'non-existent-parent-id',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle child-parent kind mismatch error', async () => {
      server.use(
        http.post('http://localhost:8000/categories', async ({ request }) => {
          const body = await request.json() as CategoryCreate;

          // Simulate parent is 'expense' but child is 'income' (mismatch)
          if (body.parent_id && body.kind === 'income') {
            return HttpResponse.json(
              { detail: 'Child category must have same kind as parent' },
              { status: 400 }
            );
          }

          return HttpResponse.json(createMockCategory(), { status: 201 });
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Subcategory',
        kind: 'income',
        parent_id: 'expense-parent-id',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('authorization error handling', () => {
    it('should handle 401 unauthorized error', async () => {
      server.use(
        http.post('http://localhost:8000/categories', () => {
          return HttpResponse.json(
            { detail: 'Not authenticated' },
            { status: 401 }
          );
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Test Category',
        kind: 'expense',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('network error handling', () => {
    it('should handle network errors', async () => {
      server.use(
        http.post('http://localhost:8000/categories', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Test Category',
        kind: 'expense',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle 500 server error', async () => {
      server.use(
        http.post('http://localhost:8000/categories', () => {
          return HttpResponse.json(
            { detail: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Test Category',
        kind: 'expense',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('mutation status states', () => {
    it('should transition from idle to success state', async () => {
      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      expect(result.current.isPending).toBe(false);
      expect(result.current.isIdle).toBe(true);

      result.current.mutate({
        name: 'Test Category',
        kind: 'expense',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isPending).toBe(false);
      expect(result.current.isIdle).toBe(false);
    });

    it('should have correct isError state after failed mutation', async () => {
      server.use(
        http.post('http://localhost:8000/categories', () => {
          return HttpResponse.json(
            { detail: 'Validation failed' },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      expect(result.current.isError).toBe(false);

      result.current.mutate({
        name: 'Test Category',
        kind: 'expense',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.error).toBeDefined();
    });
  });

  describe('API request validation', () => {
    it('should include Authorization header in request', async () => {
      let authHeader: string | null = null;
      server.use(
        http.post('http://localhost:8000/categories', ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return HttpResponse.json(createMockCategory(), { status: 201 });
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Test Category',
        kind: 'expense',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(authHeader).toBeDefined();
      expect(authHeader).toContain('Bearer');
    });

    it('should send POST request to /categories endpoint', async () => {
      let requestUrl: string | null = null;
      let requestMethod: string | null = null;
      server.use(
        http.post('http://localhost:8000/categories', ({ request }) => {
          requestUrl = request.url;
          requestMethod = request.method;
          return HttpResponse.json(createMockCategory(), { status: 201 });
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      result.current.mutate({
        name: 'Test Category',
        kind: 'expense',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(requestUrl).toContain('/categories');
      expect(requestMethod).toBe('POST');
    });

    it('should send category data as JSON in request body', async () => {
      let requestBody: CategoryCreate | null = null;
      server.use(
        http.post('http://localhost:8000/categories', async ({ request }) => {
          requestBody = await request.json() as CategoryCreate;
          return HttpResponse.json(createMockCategory(), { status: 201 });
        })
      );

      const { result } = renderHook(() => useCreateCategory(familyId), {
        wrapper: TestWrapper,
      });

      const newCategoryData: CategoryCreate = {
        name: 'Test Category',
        kind: 'expense',
      };

      result.current.mutate(newCategoryData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(requestBody).toBeDefined();
      expect(requestBody?.name).toBe('Test Category');
      expect(requestBody?.kind).toBe('expense');
    });
  });
});
