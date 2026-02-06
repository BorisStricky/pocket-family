---
name: frontend-test
description: Write comprehensive frontend tests using Vitest, React Testing Library, and MSW (Mock Service Worker) following project testing patterns and conventions.
model: inherit
---

# Frontend Test Agent

## Purpose

Write integration-first frontend tests using Vitest, React Testing Library, and MSW. Tests focus on **user workflows** (full page renders, real interactions, visible UI assertions) rather than implementation details (hook internals, React Query cache, MUI behavior).

## Test Philosophy (CRITICAL)

After a full test refactoring, this project follows these principles:

1. **Integration tests over unit tests** - Render full pages with `renderWithProviders()`, interact via `userEvent`, assert on visible UI changes
2. **No testing hook internals** - Don't test React Query cache mechanics, hook return values, or internal state
3. **Semantic queries only** - Use `getByRole`, `getByLabelText`, `getByText`. Never `getByTestId` unless absolutely necessary
4. **User workflow focused** - Each test simulates a real user action (click, type, submit) and verifies visible outcomes

## Current Test Suite

#TODO: Do not "hardcode" the current state here. Create a new file in the docs/fronted/test_suite_state.md that describes it and reference it here for the agent to read. This file is for strategy and direction
8 test files, ~55 tests total. All in centralized `src/__tests__/` and `src/lib/__tests__/`:

```
src/__tests__/
  auth.integration.test.tsx            # Login, signup, logout, AuthContext
  routing.integration.test.tsx         # FamilyGuard, navigation, family switching
  transactions.integration.test.tsx    # AG Grid list, search, CRUD, states
  accounts.integration.test.tsx        # AG Grid list, CRUD, sharing, states
  categories.integration.test.tsx      # Settings page, CategoryTree, CRUD
  family-context.integration.test.tsx  # FamilyContext, switcher, localStorage

src/lib/__tests__/
  jwtUtils.test.ts                     # JWT decode, expiry checks
  apiClient.test.ts                    # Auth headers, error handling
```

## Tech Stack

```json
{
  "testRunner": "Vitest",
  "componentTesting": "React Testing Library",
  "mocking": "MSW (Mock Service Worker) v2",
  "assertions": "Vitest expect + @testing-library/jest-dom",
  "coverage": "v8 (built into Vitest)",
  "dataGrid": "AG Grid Community"
}
```

## Commands

```bash
npm test              # Run all tests once (vitest run, no watch mode)
npm run test:watch    # Watch mode for development
npm run test:ui       # Vitest UI
npm run test:coverage # Coverage report
```

## Test Infrastructure

### File Structure (DO NOT co-locate tests with source)

Tests go in centralized directories, NOT next to implementation files:

```
src/
  __tests__/                          # Integration tests (page-level workflows)
    featureName.integration.test.tsx

  lib/__tests__/                      # Unit tests (pure utilities only)
    utilityName.test.ts

  test/                               # Shared test infrastructure (DO NOT modify without care)
    setup.ts                          # Global setup: MSW server, AG Grid, matchMedia mock
    utils.tsx                         # renderWithProviders, setupAuthenticatedUser, TestWrapper
    mocks/
      handlers/                       # MSW handlers with in-memory stores
        auth.ts                       # Auth endpoints
        family.ts                     # Family/tenant endpoints
        transactions.ts              # Transaction endpoints + resetTransactionStore()
        accounts.ts                  # Account endpoints + resetAccountStore()
        categories.ts               # Category endpoints + resetCategoryStore()
        index.ts                     # Combined export
      factories/                     # Test data factory functions
        index.ts
        transaction.ts               # createMockTransaction, createMockTransactionList
        category.ts                  # createMockCategory
        account.ts                   # createMockAccount
        auth.ts                      # createMockJWT
      server.ts                      # MSW server + reset function exports
```

### Test Utilities (`src/test/utils.tsx`)

Always use these instead of building custom wrappers:

```typescript
import {
  renderWithProviders, // Renders with QueryClient + AuthProvider + Router
  setupAuthenticatedUser, // Sets JWT in localStorage for authenticated tests
  clearAuthStorage, // Clears auth tokens
  createTestQueryClient, // Fresh QueryClient for hook tests
  TestWrapper, // Minimal wrapper (QueryClient + Auth, no Router)
  server, // MSW server for handler overrides
} from "@/test/utils";

// Also re-exports from @testing-library/react and factories:
import { screen, waitFor, within } from "@/test/utils";
import { createMockTransaction } from "@/test/utils";
```

### React Query Configuration (CRITICAL)

The test QueryClient uses these settings:

```typescript
{
  queries: {
    retry: false,           // No retries in tests
    staleTime: 30_000,      // Match production: data stays fresh during interactions
    // gcTime defaults to 5 minutes (DO NOT set gcTime: 0!)
  },
  mutations: {
    retry: false,
  },
}
```

**NEVER use `gcTime: 0` with `staleTime > 0`**. React Query requires `gcTime >= staleTime`. If gcTime < staleTime, data gets garbage collected while still "fresh", causing unexpected refetches on every re-render. This causes test timeouts with complex MUI components (SettingsPage: 7 useState + 4 useQuery + 3 modals).

Each test gets a fresh QueryClient via `renderWithProviders`, so test isolation is guaranteed without aggressive cache clearing.

### Vitest Configuration

```typescript
// vitest.config.ts key settings:
testTimeout: 20000,      // 20s per test (MUI + AG Grid integration tests need time)
hookTimeout: 20000,      // 20s for beforeEach/afterEach hooks
environment: 'jsdom',
globals: true,
```

Do NOT add per-test timeouts (e.g. `}, 15000)`). The global 20s timeout covers all tests.

### Global Test Setup (`src/test/setup.ts`)

Runs before all tests. Handles:

- MSW server lifecycle (`beforeAll` → listen, `afterEach` → resetHandlers, `afterAll` → close)
- AG Grid module registration
- `window.matchMedia` mock for MUI
- Cleanup: `cleanup()`, `localStorage.clear()`, `vi.clearAllMocks()` after each test

## Integration Test Pattern (Primary)

This is the main pattern for all feature tests:

```typescript
/**
 * Integration tests for [Feature] within [Page]
 *
 * Validates [workflow description] including:
 * - [Capability 1]
 * - [Capability 2]
 *
 * Uses MSW handlers from test/mocks/handlers/[domain].ts which provide
 * an in-memory store that persists across requests within a test.
 * The store is reset via reset[Domain]Store() in beforeEach.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import { resetTransactionStore } from '@/test/mocks/server';
import { TransactionsPage } from '@/features/transactions/pages';

const API_BASE = 'http://localhost:8000';
const TEST_TENANT_ID = 'tenant-uuid-456';

/**
 * Helper to render page with correct route structure.
 * Pages use useParams to extract familyId, so we must wrap
 * in Routes/Route to provide that param via MemoryRouter.
 */
function renderTransactionsPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/app/:familyId/transactions" element={<TransactionsPage />} />
    </Routes>,
    { initialEntries: [`/app/${TEST_TENANT_ID}/transactions`] }
  );
}

describe('TransactionsPage Integration', () => {
  beforeEach(() => {
    // Authenticate user so MSW handlers accept requests
    setupAuthenticatedUser(TEST_TENANT_ID);

    // Reset in-memory store to known state for test isolation
    resetTransactionStore();
  });

  it('displays transactions after loading', async () => {
    renderTransactionsPage();

    // Wait for API data to render in AG Grid
    await waitFor(() => {
      expect(screen.getByText('Supermarket purchase')).toBeInTheDocument();
    });
  });

  it('shows error state when API fails', async () => {
    // Override handler to return error for this test only
    server.use(
      http.get(`${API_BASE}/transactions`, () => {
        return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
      })
    );

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
```

### Key Integration Test Patterns

1. **Route params**: Always wrap page components in `<Routes><Route path="..." element={...} /></Routes>` with `initialEntries` to provide `useParams` values

2. **Authentication**: Call `setupAuthenticatedUser(tenantId)` in `beforeEach` — this sets a valid JWT in localStorage

3. **Store resets**: Call `reset[Domain]Store()` in `beforeEach` to reset MSW in-memory stores

4. **Handler overrides**: Use `server.use(...)` for test-specific API responses (errors, empty states, delays)

5. **AG Grid assertions**: AG Grid renders asynchronously. Always use `waitFor` to find grid content:

   ```typescript
   await waitFor(() => {
     expect(screen.getByText("Expected cell value")).toBeInTheDocument();
   });
   ```

6. **Modal interactions**: Click trigger button, wait for modal to appear, interact with form, submit:
   ```typescript
   const user = userEvent.setup();
   await user.click(screen.getByRole("button", { name: /add category/i }));
   await waitFor(() => {
     expect(screen.getByRole("dialog")).toBeInTheDocument();
   });
   ```

## Unit Test Pattern (Utilities Only)

Only use for pure functions in `src/lib/`:

```typescript
import { describe, it, expect } from "vitest";
import { decodeJWT, isTokenExpired } from "@/lib/jwtUtils";

describe("decodeJWT", () => {
  it("returns payload from valid token", () => {
    const token = createMockJWT({ email: "test@example.com" });
    const payload = decodeJWT(token);
    expect(payload?.email).toBe("test@example.com");
  });

  it("returns null for malformed token", () => {
    expect(decodeJWT("not-a-jwt")).toBeNull();
  });
});
```

## MSW Handler Patterns

Handlers use **in-memory stores** that persist within a test but reset between tests:

```typescript
// src/test/mocks/handlers/categories.ts
import { http, HttpResponse } from "msw";

const API_BASE = "http://localhost:8000";

// In-memory store — reset via resetCategoryStore()
let categoryStore: CategoryRead[] = [...defaultCategories];

export function resetCategoryStore() {
  categoryStore = [...defaultCategories];
}

export const categoryHandlers = [
  http.get(`${API_BASE}/categories`, ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return HttpResponse.json(
        { detail: "Not authenticated" },
        { status: 401 },
      );
    }
    return HttpResponse.json(categoryStore);
  }),

  http.post(`${API_BASE}/categories`, async ({ request }) => {
    const body = await request.json();
    const newCategory = { id: crypto.randomUUID(), ...body };
    categoryStore.push(newCategory);
    return HttpResponse.json(newCategory, { status: 201 });
  }),
];
```

## Naming Conventions (CRITICAL)

### Variable Names

NEVER abbreviate: `tx`, `q`, `acc`, `cat`, `temp`, `res`, `req`, `btn`, `hdl`

ALWAYS use full names: `transaction`, `query`, `account`, `category`, `response`, `request`, `button`, `handler`

### Test Names

```typescript
// Describe the expected behavior in plain English
it("displays error message when API call fails");
it("disables submit button while form is submitting");
it("navigates to transactions page after successful login");

// NOT:
it("works");
it("test1");
it("should handle error"); // avoid "should" — just state what it does
```

## Common Pitfalls

### 1. Using gcTime: 0 with staleTime > 0

```typescript
// BAD — causes test timeouts due to constant refetches
{ gcTime: 0, staleTime: 30_000 }

// GOOD — let gcTime default to 5 minutes
{ retry: false, staleTime: 30_000 }
```

### 2. Not wrapping pages in Routes

```typescript
// BAD — useParams returns undefined
renderWithProviders(<TransactionsPage />);

// GOOD — provides route params
renderWithProviders(
  <Routes>
    <Route path="/app/:familyId/transactions" element={<TransactionsPage />} />
  </Routes>,
  { initialEntries: [`/app/${TENANT_ID}/transactions`] }
);
```

### 3. Forgetting authentication setup

```typescript
// BAD — MSW handlers return 401
renderWithProviders(<TransactionsPage />);

// GOOD — JWT token set in localStorage before render
setupAuthenticatedUser(TENANT_ID);
renderWithProviders(/* ... */);
```

### 4. Not resetting in-memory stores

```typescript
// BAD — store has leftover data from previous test
it("creates a transaction", async () => {
  /* ... */
});

// GOOD — reset store in beforeEach
beforeEach(() => {
  resetTransactionStore();
  setupAuthenticatedUser(TENANT_ID);
});
```

### 5. Using getBy\* for elements that might not exist

```typescript
// BAD — throws if not found
expect(screen.getByText("Error")).not.toBeInTheDocument();

// GOOD — returns null if not found
expect(screen.queryByText("Error")).not.toBeInTheDocument();
```

### 6. Not waiting for async operations

```typescript
// BAD — data not loaded yet
render(<Component />);
expect(screen.getByText('Data')).toBeInTheDocument();

// GOOD — wait for API response
render(<Component />);
await waitFor(() => {
  expect(screen.getByText('Data')).toBeInTheDocument();
});
```

### 7. Adding per-test timeouts

```typescript
// BAD — use global 20s timeout from vitest.config.ts
it("submits form", async () => {
  /* ... */
}, 15000);

// GOOD — no explicit timeout
it("submits form", async () => {
  /* ... */
});
```

## Validation Checklist

Before marking test task complete:

- [ ] Tests in correct directory (`src/__tests__/` for integration, `src/lib/__tests__/` for unit)
- [ ] All tests pass (`npm test`)
- [ ] Uses `renderWithProviders` from `@/test/utils` (not custom wrappers)
- [ ] Uses `setupAuthenticatedUser()` for authenticated tests
- [ ] Resets in-memory stores in `beforeEach`
- [ ] No abbreviations in variable names
- [ ] Inline comments explain test purpose and non-obvious assertions
- [ ] Error states tested (API failures, validation errors)
- [ ] Loading states tested where relevant
- [ ] Uses `userEvent.setup()` per test (not shared across tests)
- [ ] No `gcTime: 0` in QueryClient configuration
- [ ] No per-test timeout overrides
- [ ] Semantic queries only (`getByRole`, `getByLabelText`, `getByText`)

## Notes

- Always use `userEvent` over `fireEvent` for realistic interaction simulation
- Use `screen.debug()` during development to inspect current DOM state
- `within()` is useful for scoping queries to a specific container (e.g., `within(dialog)`)
- MUI dialogs render via portals — use `screen.getByRole('dialog')` to find them
- AG Grid renders asynchronously — always `waitFor` grid content
- MSW handler order matters — more specific routes should come before catch-all routes
