// src/test/mocks/handlers/budgets.ts
// MSW handlers for budget endpoints (/budgets/*)
//
// Provides an in-memory store for budgets during tests. The store supports
// full CRUD operations and can be reset between tests via resetBudgetStore().
// Budget responses include a calculated "spent" field (always 0 in tests unless
// overridden per-test with server.use).

import { http, HttpResponse } from 'msw';
import type { BudgetRead, BudgetCreatePayload, BudgetUpdatePayload } from '@/features/budgets/types';
import { createMockCategoryList } from '../factories/category';
import type { CategoryRead } from '../factories/category';

// Base URL for API requests (matches vitest.config.ts define)
const API_BASE = 'http://localhost:8000';

// Default tenant ID matching setupAuthenticatedUser() default
const DEFAULT_TENANT_ID = 'tenant-uuid-456';

/**
 * Create default budget data for the in-memory store
 *
 * Returns a set of budgets with varying states:
 * - Budget with categories and moderate spending (under 80%)
 * - Budget with categories and high spending (80-99%)
 * - Universal budget (no categories) with over-budget spending (100%+)
 */
function createDefaultBudgets(): BudgetRead[] {
  // Get the default category list so we can reference real category objects
  const categories = createMockCategoryList(5, DEFAULT_TENANT_ID);

  return [
    {
      id: 'budget-uuid-1',
      tenant_id: DEFAULT_TENANT_ID,
      name: 'Monthly Entertainment',
      amount: 500,
      currency: 'BRL',
      categories: [categories[0], categories[1]],
      spent: 250,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
    },
    {
      id: 'budget-uuid-2',
      tenant_id: DEFAULT_TENANT_ID,
      name: 'Food & Groceries',
      amount: 1000,
      currency: 'BRL',
      categories: [categories[2]],
      spent: 850,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
    },
    {
      id: 'budget-uuid-3',
      tenant_id: DEFAULT_TENANT_ID,
      name: 'Total Spending',
      amount: 2000,
      currency: 'BRL',
      categories: [],
      spent: 2100,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
    },
  ];
}

// In-memory store for budgets during tests
let mockBudgetStore: BudgetRead[] = createDefaultBudgets();

/**
 * Reset the budget store to default state
 * Call this in beforeEach to ensure test isolation between tests
 */
export function resetBudgetStore(): void {
  mockBudgetStore = createDefaultBudgets();
}

/**
 * Budget endpoint handlers for MSW
 * These provide default successful responses that can be overridden per-test using server.use()
 */
export const budgetHandlers = [
  // GET /budgets - List all budgets for the authenticated user's tenant
  http.get(`${API_BASE}/budgets`, ({ request }) => {
    // Simulate 401 for unauthenticated requests (no Authorization header)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Return all budgets in the store (tenant filtering is simplified for tests)
    return HttpResponse.json(mockBudgetStore);
  }),

  // GET /budgets/:id - Get single budget by ID
  http.get(`${API_BASE}/budgets/:id`, ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Find budget in the in-memory store
    const existingBudget = mockBudgetStore.find(
      (budget) => budget.id === id
    );

    if (existingBudget) {
      return HttpResponse.json(existingBudget);
    }

    // Return 404 if budget not found
    return HttpResponse.json(
      { detail: 'Budget not found' },
      { status: 404 }
    );
  }),

  // POST /budgets - Create a new budget
  http.post(`${API_BASE}/budgets`, async ({ request }) => {
    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Partial<BudgetCreatePayload>;

    // Validate required fields
    if (!body.name || body.name.trim() === '') {
      return HttpResponse.json(
        { detail: 'Budget name is required' },
        { status: 400 }
      );
    }

    if (body.amount === undefined || body.amount <= 0) {
      return HttpResponse.json(
        { detail: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Resolve category objects from IDs if provided
    // In the real backend, categories are fetched from the database
    const allCategories = createMockCategoryList(5, DEFAULT_TENANT_ID);
    const resolvedCategories: CategoryRead[] = [];

    if (body.category_ids && body.category_ids.length > 0) {
      for (const categoryId of body.category_ids) {
        const foundCategory = allCategories.find(
          (category) => category.id === categoryId
        );
        if (foundCategory) {
          resolvedCategories.push(foundCategory);
        }
      }
    }

    // Create the new budget with a generated ID and timestamps
    const newBudget: BudgetRead = {
      id: `budget-uuid-new-${Date.now()}`,
      tenant_id: DEFAULT_TENANT_ID,
      name: body.name,
      amount: body.amount,
      currency: body.currency || 'BRL',
      categories: resolvedCategories,
      spent: 0,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add to the in-memory store so subsequent GET requests include it
    mockBudgetStore.push(newBudget);

    return HttpResponse.json(newBudget, { status: 201 });
  }),

  // PATCH /budgets/:id - Update an existing budget
  http.patch(`${API_BASE}/budgets/:id`, async ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Partial<BudgetUpdatePayload>;

    // Find budget in store
    const budgetIndex = mockBudgetStore.findIndex(
      (budget) => budget.id === id
    );

    if (budgetIndex === -1) {
      return HttpResponse.json(
        { detail: 'Budget not found' },
        { status: 404 }
      );
    }

    const existingBudget = mockBudgetStore[budgetIndex];

    // Resolve category objects if category_ids is provided (full replacement)
    let updatedCategories = existingBudget.categories;
    if (body.category_ids !== undefined) {
      const allCategories = createMockCategoryList(5, DEFAULT_TENANT_ID);
      updatedCategories = body.category_ids
        .map((categoryId) =>
          allCategories.find((category) => category.id === categoryId)
        )
        .filter((category): category is CategoryRead => category !== undefined);
    }

    // Merge updates into the existing budget, preserving unchanged fields
    const updatedBudget: BudgetRead = {
      ...existingBudget,
      name: body.name ?? existingBudget.name,
      amount: body.amount ?? existingBudget.amount,
      currency: body.currency ?? existingBudget.currency,
      categories: updatedCategories,
      updated_at: new Date().toISOString(),
    };

    // Update the store entry so subsequent GET requests return the updated version
    mockBudgetStore[budgetIndex] = updatedBudget;

    return HttpResponse.json(updatedBudget);
  }),

  // DELETE /budgets/:id - Delete a budget
  http.delete(`${API_BASE}/budgets/:id`, ({ params, request }) => {
    const { id } = params;

    // Simulate 401 for unauthenticated requests
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Find and remove budget from the in-memory store
    const budgetIndex = mockBudgetStore.findIndex(
      (budget) => budget.id === id
    );

    if (budgetIndex === -1) {
      return HttpResponse.json(
        { detail: 'Budget not found' },
        { status: 404 }
      );
    }

    // Remove from store so subsequent GET requests no longer include it
    mockBudgetStore.splice(budgetIndex, 1);

    // Return 204 No Content matching the backend behavior
    return new HttpResponse(null, { status: 204 });
  }),
];
