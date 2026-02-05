// src/test/mocks/handlers/categories.ts
// MSW handlers for category endpoints (/categories/*)

import { http, HttpResponse } from 'msw';
import { createMockCategoryList } from '../factories/category';
import type { CategoryRead, CategoryCreate, CategoryUpdate } from '../factories/category';

// Base URL for API requests (matches vitest.config.ts define)
const API_BASE = 'http://localhost:8000';

// In-memory store for categories during tests
// This allows us to simulate CRUD operations across multiple handlers
let mockCategoryStore: CategoryRead[] = createMockCategoryList(5);

/**
 * Reset the category store to default state
 * Call this in beforeEach to ensure test isolation
 */
export function resetCategoryStore(): void {
  mockCategoryStore = createMockCategoryList(5);
}

/**
 * Category endpoint handlers for MSW
 * These provide default successful responses that can be overridden per-test
 */
export const categoryHandlers = [
  // GET /categories - List categories with required tenant filter
  http.get(`${API_BASE}/categories`, ({ request }) => {
    const url = new URL(request.url);
    const tenant_id = url.searchParams.get('tenant_id');

    // Simulate 401 for unauthenticated requests (no Authorization header)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Backend requires tenant_id query parameter for categories
    if (!tenant_id) {
      return HttpResponse.json(
        { detail: 'tenant_id query parameter is required' },
        { status: 400 }
      );
    }

    // Filter categories by tenant_id
    const filteredCategories = mockCategoryStore.filter(
      (category) => category.tenant_id === tenant_id
    );

    // Sort by name for consistent ordering
    filteredCategories.sort((a, b) => a.name.localeCompare(b.name));

    return HttpResponse.json(filteredCategories);
  }),

  // GET /categories/:id - Get single category by ID
  http.get(`${API_BASE}/categories/:id`, ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simulate 404 for non-existent category
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Category not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized access
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to access this category' },
        { status: 403 }
      );
    }

    // Find category in store
    const existingCategory = mockCategoryStore.find(
      (category) => category.id === id
    );

    if (existingCategory) {
      return HttpResponse.json(existingCategory);
    }

    // Return 404 if not in store
    return HttpResponse.json(
      { detail: 'Category not found' },
      { status: 404 }
    );
  }),

  // POST /categories - Create new category
  http.post(`${API_BASE}/categories`, async ({ request }) => {
    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Partial<CategoryCreate>;

    // Simulate validation errors
    if (!body.name) {
      return HttpResponse.json(
        { detail: 'name is required' },
        { status: 400 }
      );
    }

    if (!body.kind) {
      return HttpResponse.json(
        { detail: 'kind is required' },
        { status: 400 }
      );
    }

    // Validate kind is either 'expense' or 'income'
    const validKinds = ['expense', 'income'];
    if (!validKinds.includes(body.kind)) {
      return HttpResponse.json(
        { detail: 'kind must be either expense or income' },
        { status: 400 }
      );
    }

    // If parent_id provided, validate parent exists
    if (body.parent_id) {
      const parentCategory = mockCategoryStore.find(
        (category) => category.id === body.parent_id
      );

      if (!parentCategory) {
        return HttpResponse.json(
          { detail: 'Parent category not found' },
          { status: 404 }
        );
      }

      // Validate child category has same kind as parent
      if (parentCategory.kind !== body.kind) {
        return HttpResponse.json(
          { detail: 'Child category must have same kind as parent' },
          { status: 400 }
        );
      }

      // Create new category with parent relationship
      const newCategory: CategoryRead = {
        id: `category-uuid-new-${Date.now()}`,
        tenant_id: 'tenant-uuid-456',
        name: body.name,
        kind: body.kind,
        parent_id: body.parent_id,
        parent_name: parentCategory.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add to store
      mockCategoryStore.push(newCategory);

      return HttpResponse.json(newCategory, { status: 201 });
    }

    // Create new parent category (no parent_id)
    const newCategory: CategoryRead = {
      id: `category-uuid-new-${Date.now()}`,
      tenant_id: 'tenant-uuid-456',
      name: body.name,
      kind: body.kind,
      parent_id: null,
      parent_name: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add to store
    mockCategoryStore.push(newCategory);

    return HttpResponse.json(newCategory, { status: 201 });
  }),

  // PATCH /categories/:id - Update existing category
  http.patch(`${API_BASE}/categories/:id`, async ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Partial<CategoryUpdate>;

    // Simulate 404 for non-existent category
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Category not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized update
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to update this category' },
        { status: 403 }
      );
    }

    // Validate kind if provided
    if (body.kind) {
      const validKinds = ['expense', 'income'];
      if (!validKinds.includes(body.kind)) {
        return HttpResponse.json(
          { detail: 'kind must be either expense or income' },
          { status: 400 }
        );
      }
    }

    // Find and update category in store
    const categoryIndex = mockCategoryStore.findIndex(
      (category) => category.id === id
    );

    if (categoryIndex !== -1) {
      const existingCategory = mockCategoryStore[categoryIndex];

      // If updating parent_id, validate parent exists and kind matches
      let parentName = existingCategory.parent_name;
      if (body.parent_id !== undefined) {
        if (body.parent_id === null) {
          // Removing parent relationship
          parentName = null;
        } else {
          const parentCategory = mockCategoryStore.find(
            (category) => category.id === body.parent_id
          );

          if (!parentCategory) {
            return HttpResponse.json(
              { detail: 'Parent category not found' },
              { status: 404 }
            );
          }

          const categoryKind = body.kind || existingCategory.kind;
          if (parentCategory.kind !== categoryKind) {
            return HttpResponse.json(
              { detail: 'Child category must have same kind as parent' },
              { status: 400 }
            );
          }

          parentName = parentCategory.name;
        }
      }

      const updatedCategory: CategoryRead = {
        ...existingCategory,
        ...body,
        id: existingCategory.id, // Preserve ID
        tenant_id: existingCategory.tenant_id, // Preserve tenant_id
        parent_name: parentName,
        updated_at: new Date().toISOString(),
      };

      mockCategoryStore[categoryIndex] = updatedCategory;
      return HttpResponse.json(updatedCategory);
    }

    // Return 404 if not in store
    return HttpResponse.json(
      { detail: 'Category not found' },
      { status: 404 }
    );
  }),

  // DELETE /categories/:id - Delete category
  http.delete(`${API_BASE}/categories/:id`, ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simulate 404 for non-existent category
    if (id === 'non-existent-id') {
      return HttpResponse.json(
        { detail: 'Category not found' },
        { status: 404 }
      );
    }

    // Simulate 403 for unauthorized delete
    if (id === 'unauthorized-id') {
      return HttpResponse.json(
        { detail: 'Not authorized to delete this category' },
        { status: 403 }
      );
    }

    // Simulate 409 for category with children (cannot delete parent with children)
    const hasChildren = mockCategoryStore.some(
      (category) => category.parent_id === id
    );

    if (hasChildren) {
      return HttpResponse.json(
        { detail: 'Cannot delete category with subcategories' },
        { status: 409 }
      );
    }

    // Remove from store if exists
    const categoryIndex = mockCategoryStore.findIndex(
      (category) => category.id === id
    );

    if (categoryIndex !== -1) {
      mockCategoryStore.splice(categoryIndex, 1);
    }

    // Return 204 No Content on success (matches backend behavior)
    return new HttpResponse(null, { status: 204 });
  }),
];
