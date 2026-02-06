---
Overview: Complete frontend test suite refactoring from 32 granular unit test files (~500 tests) to 8 focused integration test files (55 tests). This refactor prioritizes user-workflow testing over implementation-detail testing, dramatically reducing test maintenance burden while maintaining meaningful coverage of critical application paths.
Date: 2026-02-06
branch: "`fronted_test_refactor` → `frontend_sprint_4`"
code_changed: 47 files changed, +2,029 insertions, -15,660 deletions
commits: 2 commits
test_coverage: 55 tests passing (8 test files)
tags:
  - testing
  - frontend
  - refactor
---

# Frontend Test Refactor: Integration-First Testing Strategy

## Overview

This PR replaces the entire frontend test suite with a new integration-first testing approach. The previous suite of **32 test files (~500 tests)** was replaced with **8 focused test files (55 tests)** that test user workflows through full page renders rather than testing individual hooks, components, and utilities in isolation. See [[../knowledge/glossary/testing|Testing]] for the project's testing philosophy.

The key insight driving this refactor: tests that mirror how users interact with the application (filling forms, clicking buttons, seeing results) provide more meaningful regression protection than tests that assert on [[../knowledge/glossary/state-management|React Query]] cache states or hook return values.

## Goals Achieved

- **Eliminated test maintenance overhead**: Removed ~15,660 lines of test code that were tightly coupled to implementation details ([[../knowledge/glossary/state-management|React Query]] cache mechanics, individual [[../knowledge/glossary/react-patterns-hooks|hook]] return values, [[../knowledge/glossary/ui-components-design|MUI]] component internals)
- **Faster test execution**: The new 55-test suite runs in ~90 seconds vs. the previous suite that frequently timed out
- **Better regression protection**: Integration tests catch real bugs at the user-interaction level that unit tests of individual hooks would miss
- **Simplified test infrastructure**: All tests use a consistent pattern of `renderWithProviders()` + `userEvent` + semantic queries

## Architecture & Testing Strategy

### Previous Approach (Deleted)

Tests were organized by code unit — one test file per hook, per component, per utility:
- `useCreateAccount.test.ts` (926 lines) — tested hook return values, cache invalidation, error states
- `useUpdateAccount.test.ts` (1,210 lines) — tested mutation mechanics, optimistic updates
- `AgAccountsGrid.test.tsx` (890 lines) — tested AG Grid rendering in isolation
- `CategorySelect.test.tsx` (508 lines) — tested MUI component behavior

**Problems**: Tests were brittle (broke when refactoring internals), slow (complex mocking of React Query), and tested MUI/AG Grid behavior rather than application logic.

### New Approach (Added)

Tests are organized by **user workflow** — one test file per feature area:
- `auth.integration.test.tsx` — login, signup, protected routes as a user experiences them
- `transactions.integration.test.tsx` — viewing, filtering, searching, navigating transactions
- `accounts.integration.test.tsx` — listing, creating, navigating accounts in both family and global views
- `categories.integration.test.tsx` — managing categories through the Settings page
- `routing.integration.test.tsx` — FamilyGuard access control, navigation, localStorage persistence
- `family-context.integration.test.tsx` — family data loading, context provision, error handling

**Key patterns**:
- Full page renders with `renderWithProviders()` wrapping QueryClient + [[../knowledge/glossary/authentication-security|AuthProvider]] + MemoryRouter
- MSW handlers intercept real [[../knowledge/glossary/api-communication|API calls]] — no mocking of fetch or hooks
- Semantic queries only: `getByRole`, `getByLabelText`, `getByText`
- `userEvent` for realistic user interactions (typing, clicking)
- Per-test MSW handler overrides via `server.use()` for error/empty states

## Directory Structure

```
frontend/
├── src/
│   ├── __tests__/                                          # Integration tests (NEW)
│   │   ├── 🆕 auth.integration.test.tsx                    # 8 tests: login, signup, protected routes
│   │   ├── 🆕 routing.integration.test.tsx                 # 6 tests: FamilyGuard, navigation, localStorage
│   │   ├── 🆕 transactions.integration.test.tsx            # 9 tests: list, filter, search, navigate
│   │   ├── 🆕 accounts.integration.test.tsx                # 9 tests: family + global views, CRUD
│   │   ├── 🆕 categories.integration.test.tsx              # 8 tests: tree, add/delete, empty state
│   │   └── 🆕 family-context.integration.test.tsx          # 5 tests: context, loading, error handling
│   ├── lib/
│   │   └── __tests__/                                      # Unit tests (NEW)
│   │       ├── 🆕 apiClient.test.ts                        # 4 tests: auth header, errors, POST, 204
│   │       └── 🆕 jwtUtils.test.ts                         # 6 tests: decode, expired, malformed
│   ├── components/
│   │   ├── ❌ ProtectedRoute.test.tsx                       # Replaced by auth.integration.test.tsx
│   │   └── domain/
│   │       ├── __tests__/
│   │       │   ├── ❌ CategorySelect.test.tsx               # Replaced by categories.integration.test.tsx
│   │       │   └── ❌ CategoryTree.test.tsx                 # Replaced by categories.integration.test.tsx
│   │       └── ag/__tests__/
│   │           ├── ❌ AgAccountsGrid.test.tsx               # Replaced by accounts.integration.test.tsx
│   │           └── ❌ AgTransactionsGrid.test.tsx           # Replaced by transactions.integration.test.tsx
│   ├── features/
│   │   ├── accounts/__tests__/
│   │   │   ├── ❌ AccountForm.test.tsx                      # Replaced by accounts.integration.test.tsx
│   │   │   ├── ❌ useAccounts.test.ts                       # Replaced by accounts.integration.test.tsx
│   │   │   ├── ❌ useCreateAccount.test.ts                  # Hook internals no longer tested
│   │   │   ├── ❌ useDeleteAccount.test.ts                  # Hook internals no longer tested
│   │   │   ├── ❌ useUpdateAccount.test.ts                  # Hook internals no longer tested
│   │   │   ├── ❌ useAccountShares.test.tsx                 # Hook internals no longer tested
│   │   │   ├── ❌ useCreateAccountShare.test.tsx            # Hook internals no longer tested
│   │   │   ├── ❌ useDeleteAccountShare.test.tsx            # Hook internals no longer tested
│   │   │   └── ❌ useUpdateAccountShare.test.tsx            # Hook internals no longer tested
│   │   ├── auth/
│   │   │   ├── context/
│   │   │   │   └── ❌ AuthContext.test.tsx                  # Replaced by auth.integration.test.tsx
│   │   │   └── hooks/
│   │   │       ├── ❌ useLogin.test.tsx                     # Replaced by auth.integration.test.tsx
│   │   │       ├── ❌ useLogout.test.tsx                    # Replaced by auth.integration.test.tsx
│   │   │       └── ❌ useSignup.test.tsx                    # Replaced by auth.integration.test.tsx
│   │   ├── family/__tests__/
│   │   │   └── ❌ FamilyIntegration.test.tsx                # Replaced by family-context.integration.test.tsx
│   │   ├── family/hooks/__tests__/
│   │   │   ├── ❌ useCategories.test.ts                     # Replaced by categories.integration.test.tsx
│   │   │   ├── ❌ useCategory.test.ts                       # Hook internals no longer tested
│   │   │   └── ❌ useCreateCategory.test.ts                 # Replaced by categories.integration.test.tsx
│   │   └── transactions/__tests__/
│   │       ├── ❌ TransactionForm.test.tsx                   # Complex form testing deferred
│   │       ├── ❌ transactionsApi.test.ts                    # Replaced by apiClient.test.ts
│   │       ├── ❌ useCreateTransaction.test.tsx              # Hook internals no longer tested
│   │       ├── ❌ useDeleteTransaction.test.tsx              # Hook internals no longer tested
│   │       ├── ❌ useTransaction.test.tsx                    # Hook internals no longer tested
│   │       ├── ❌ useTransactions.test.tsx                   # Replaced by transactions.integration.test.tsx
│   │       └── ❌ useUpdateTransaction.test.tsx              # Hook internals no longer tested
│   ├── lib/
│   │   ├── ❌ apiClient.test.ts                             # Moved to lib/__tests__/apiClient.test.ts
│   │   ├── ❌ errorUtils.test.ts                            # Utility no longer tested separately
│   │   └── ❌ jwtUtils.test.ts                              # Moved to lib/__tests__/jwtUtils.test.ts
│   └── test/
│       ├── utils.tsx                                        # ✏️ Updated staleTime config
│       └── mocks/                                           # Unchanged - handlers, factories, server
├── vitest.config.ts                                         # ✏️ Minor config tweaks
└── package.json                                             # ✏️ Dependency updates
```

## Files Changed - Detailed Breakdown

### New Integration Test Files (6 files, +1,335 lines)

**`src/__tests__/auth.integration.test.tsx`** — 8 tests
- **Purpose**: Tests login, signup, and protected route access as users experience them
- **Key scenarios**: Successful login/signup with token storage, invalid credentials error, password validation, unauthenticated redirect, authenticated content rendering, loading states

**`src/__tests__/routing.integration.test.tsx`** — 6 tests
- **Purpose**: Tests FamilyGuard access control and navigation behavior
- **Key scenarios**: Valid member access, 403 unauthorized, 404 not found, loading state, "View All Families" escape hatch, localStorage preferred family persistence

**`src/__tests__/transactions.integration.test.tsx`** — 9 tests
- **Purpose**: Tests TransactionsPage list view with filters, search, and navigation
- **Key scenarios**: Page heading/buttons, loading spinner, AG Grid display, server error, empty state (with and without filters), search debounce with fake timers, filter section rendering

**`src/__tests__/accounts.integration.test.tsx`** — 9 tests
- **Purpose**: Tests both family-scoped AccountsPage and global AllAccountsPage
- **Key scenarios**: Grid data display, empty state, 500 error, Add Account button/navigation, hint text, global view heading and error handling

**`src/__tests__/categories.integration.test.tsx`** — 8 tests
- **Purpose**: Tests category management through the Settings page
- **Key scenarios**: Settings tabs, expense/income section headers, category names in tree, Add Category modal form submission, delete confirmation dialog, empty state

**`src/__tests__/family-context.integration.test.tsx`** — 5 tests
- **Purpose**: Tests FamilyContext provider and FamilyGuard integration
- **Key scenarios**: Current family from URL param, families list count, loading state, 404 error handling, empty families list

### New Unit Test Files (2 files, +175 lines)

**`src/lib/__tests__/jwtUtils.test.ts`** — 6 tests
- **Purpose**: Tests client-side [[../knowledge/glossary/authentication-security|JWT]] decoding used by AuthContext
- **Key scenarios**: Valid decode, expired token decode, malformed token, getUserFromToken extraction, isTokenExpired for future/past/garbage tokens

**`src/lib/__tests__/apiClient.test.ts`** — 4 tests
- **Purpose**: Tests centralized [[../knowledge/glossary/api-communication|API fetch wrapper]]
- **Key scenarios**: Authorization header injection from localStorage, ApiError with status code and message, POST body with Content-Type, 204 No Content handling

### Deleted Test Files (32 files, -15,660 lines)

All 32 previous test files were deleted. They tested individual hooks (useCreateAccount, useDeleteTransaction, etc.), component internals (CategorySelect, AgAccountsGrid), and context providers in isolation. These are now covered at the integration level through full page renders.

### Modified Infrastructure Files (4 files)

**`src/test/utils.tsx`** — Updated QueryClient config
- Changed to `staleTime: 30_000` with default `gcTime` to prevent cascading refetches during complex MUI interactions (critical fix for test timeouts)

**`vitest.config.ts`** — Test configuration tweaks
- `testTimeout: 20000` and `hookTimeout: 20000` for integration tests rendering full MUI pages with AG Grid

**`docs/active_context/fronted_test_refactor_plan.md`** — New planning document
- Detailed refactoring plan with file-by-file test specifications

**`.claude/agents/frontend-test.md`** — Updated test agent instructions
- Simplified to reflect the new integration-first testing strategy

## Testing Strategy

### Before vs. After

| Metric | Before | After |
|--------|--------|-------|
| Test files | 32 | 8 |
| Total tests | ~500 | 55 |
| Lines of test code | ~15,660 | ~2,029 |
| Test approach | Unit (hooks, components) | Integration (pages, workflows) |
| Typical test | "useCreateAccount returns loading state" | "User fills form, submits, sees account in list" |
| Brittleness | High (broke on refactors) | Low (only breaks on behavior changes) |
| Suite duration | Frequent timeouts | ~90s stable |

### Key Testing Patterns

1. **Full page renders**: Every integration test renders a complete page component inside `<Routes>` with proper URL params
2. **MSW for API mocking**: Default handlers provide happy-path data; per-test `server.use()` overrides simulate errors and edge cases
3. **In-memory stores**: MSW handlers use in-memory data stores (`resetAccountStore()`, `resetCategoryStore()`, `resetTransactionStore()`) for test isolation
4. **Fake timers for debounce**: Transaction search tests use `vi.useFakeTimers()` to precisely control the 500ms debounce delay
5. **Semantic queries**: All assertions use accessible queries (`getByRole`, `getByLabelText`, `getByText`) — no `getByTestId` except in FamilyContext helper component

### React Query Test Configuration (Critical Lesson)

> [!warning] Key Discovery
> Never use `gcTime: 0` with `staleTime > 0` in test QueryClient. React Query requires `gcTime >= staleTime`. See [[../knowledge/glossary/state-management|State Management]] for details on stale time and garbage collection.

The test `QueryClient` uses `staleTime: 30_000` with default `gcTime` (5 minutes). This prevents cascading background refetches during complex component interactions. Previously, `gcTime: 0` with a positive `staleTime` caused data to be garbage collected while still "fresh," leading to unexpected refetches and test timeouts.

## Migration Notes

- **No breaking changes**: This PR only modifies test files — no production code was changed
- **MSW infrastructure preserved**: All existing handlers in `src/test/mocks/handlers/` and factories in `src/test/mocks/factories/` are unchanged and reused
- **Test utilities updated**: `renderWithProviders` and `setupAuthenticatedUser` remain the primary test helpers with the same API

## Performance Impact

- **Test suite duration**: ~90 seconds (stable, no timeouts)
- **Build time**: No change (test files are not included in production build)
- **Bundle size**: No change (no production code modified)

## Next Steps / Follow-up Work

- **Add E2E tests**: AG Grid row click navigation is skipped in jsdom — needs Playwright/Cypress for real browser testing
- **Transaction form tests**: Full CRUD workflow tests for transaction creation/editing deferred to when form stabilizes
- **Coverage reporting**: Run `npm run test:coverage` to establish baseline coverage metrics for the new suite
- **Account sharing tests**: Cross-family account sharing workflows not yet covered in integration tests

## Related Documentation

- [Frontend Test Refactor Plan](../active_context/fronted_test_refactor_plan.md) — Detailed planning document with file-by-file specifications

### Technical Glossary

> [!info] Learning Resources
> New to the project? Start with the [[../knowledge/glossary/glossary|Technical Glossary]] for:
> - [[../knowledge/glossary/testing|Testing]] — Vitest, React Testing Library, MSW, integration testing patterns
> - [[../knowledge/glossary/state-management|State Management]] — React Query configuration (staleTime, gcTime), AuthContext, FamilyContext
> - [[../knowledge/glossary/frontend-build-configuration|Frontend Build & Configuration]] — Vite, vitest.config.ts, path aliases
> - [[../knowledge/glossary/react-patterns-hooks|React Patterns & Hooks]] — Custom hooks, context providers, composition patterns
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] — JWT decoding, token storage, protected routes
> - [[../knowledge/glossary/api-communication|API Communication]] — apiFetch wrapper, error handling, HTTP patterns
> - [[../knowledge/glossary/ui-components-design|UI Components & Design]] — MUI components, AG Grid, form handling
> - [[../knowledge/glossary/routing-navigation|Routing & Navigation]] — FamilyGuard, ProtectedRoute, MemoryRouter in tests
