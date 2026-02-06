# Frontend Test Refactoring Plan

## Summary

Delete all 32 existing test files (~500 tests). Create 8 new test files (~62 tests) focused on user workflows instead of implementation details. Keep existing MSW handlers, factories, and test utilities.

---

## Phase 1: Delete All Existing Tests

Delete these 32 test files:

```
src/components/ProtectedRoute.test.tsx
src/components/domain/__tests__/CategorySelect.test.tsx
src/components/domain/__tests__/CategoryTree.test.tsx
src/components/domain/ag/__tests__/AgAccountsGrid.test.tsx
src/components/domain/ag/__tests__/AgTransactionsGrid.test.tsx
src/features/accounts/__tests__/AccountForm.test.tsx
src/features/accounts/__tests__/useAccountShares.test.tsx
src/features/accounts/__tests__/useAccounts.test.ts
src/features/accounts/__tests__/useCreateAccount.test.ts
src/features/accounts/__tests__/useCreateAccountShare.test.tsx
src/features/accounts/__tests__/useDeleteAccount.test.ts
src/features/accounts/__tests__/useDeleteAccountShare.test.tsx
src/features/accounts/__tests__/useUpdateAccount.test.ts
src/features/accounts/__tests__/useUpdateAccountShare.test.tsx
src/features/auth/context/AuthContext.test.tsx
src/features/auth/hooks/useLogin.test.tsx
src/features/auth/hooks/useLogout.test.tsx
src/features/auth/hooks/useSignup.test.tsx
src/features/family/__tests__/FamilyIntegration.test.tsx
src/features/family/hooks/__tests__/useCategories.test.ts
src/features/family/hooks/__tests__/useCategory.test.ts
src/features/family/hooks/__tests__/useCreateCategory.test.ts
src/features/transactions/__tests__/TransactionForm.test.tsx
src/features/transactions/__tests__/transactionsApi.test.ts
src/features/transactions/__tests__/useCreateTransaction.test.tsx
src/features/transactions/__tests__/useDeleteTransaction.test.tsx
src/features/transactions/__tests__/useTransaction.test.tsx
src/features/transactions/__tests__/useTransactions.test.tsx
src/features/transactions/__tests__/useUpdateTransaction.test.tsx
src/lib/apiClient.test.ts
src/lib/errorUtils.test.ts
src/lib/jwtUtils.test.ts
```

**KEEP** all infrastructure:

- `src/test/setup.ts`, `src/test/utils.tsx`
- `src/test/mocks/handlers/*.ts`, `src/test/mocks/factories/*.ts`, `src/test/mocks/server.ts`
- `vitest.config.ts`

---

## Phase 2: Create New Tests (8 files, ~62 tests)

### File Structure

```
src/__tests__/
  auth.integration.test.tsx            (8 tests)
  routing.integration.test.tsx         (6 tests)
  transactions.integration.test.tsx    (12 tests)
  accounts.integration.test.tsx        (12 tests)
  categories.integration.test.tsx      (8 tests)
  family-context.integration.test.tsx  (6 tests)

src/lib/__tests__/
  jwtUtils.test.ts                     (6 tests)
  apiClient.test.ts                    (4 tests)
```

### Implementation Order (by priority)

#### Priority 1: Unit Tests (foundation)

**`src/lib/__tests__/jwtUtils.test.ts`** (6 tests)

1. decodeJWT returns payload from valid token
2. decodeJWT handles expired token (still decodes)
3. decodeJWT returns null for malformed token
4. isTokenExpired returns false for future exp
5. isTokenExpired returns true for past exp
6. isTokenExpired returns true for missing exp

**`src/lib/__tests__/apiClient.test.ts`** (4 tests)

1. Includes Authorization header from localStorage
2. Handles 401 → triggers auth failure callback
3. Handles network error → throws with message
4. POST sends JSON body with Content-Type header
5. Errors display messages with meaning instead of generic Error 404

#### Priority 2: Auth & Routing (gate to app)

**`src/__tests__/auth.integration.test.tsx`** (8 tests)

1. Login success → token stored, redirects to /app
2. Login invalid credentials → error message, no redirect
3. Signup success → token stored, redirects
4. Signup duplicate email → error message
5. Logout → token cleared, redirects to /login
6. AuthContext provides user info from JWT
7. Unauthenticated visit to protected route → redirects to /login
8. Authenticated user sees loading then content

**`src/__tests__/routing.integration.test.tsx`** (6 tests)

1. FamilyGuard allows access for valid family member
2. FamilyGuard shows error for unauthorized family (403)
3. FamilyGuard shows error for nonexistent family (404)
4. AppRoot redirects to preferred family
5. SideNav links navigate between family-scoped pages
6. Family switcher triggers family switch

#### Priority 3: Main Features (user workflows)

**`src/__tests__/transactions.integration.test.tsx`** (12 tests)

1. Displays transactions in AG Grid after load
2. Filter by date range → grid updates
3. Filter by search text (debounced) → grid updates
4. Create transaction → fill form → submit → appears in list
5. Create transaction with validation errors → shows errors
6. Click transaction row → navigate to detail
7. Edit transaction → submit → updated in detail view
8. Delete transaction → confirm → removed, redirect to list
9. Empty state when no transactions
10. Loading state while fetching
11. Error state when API fails

**`src/__tests__/accounts.integration.test.tsx`** (12 tests)

1. List family accounts in AG Grid
2. List all accounts in global view (/app/accounts)
3. Create account in family context → shared automatically
4. Create account in global context → no auto-share
5. Edit account → submit → detail page updates
6. Delete account → confirm → removed, redirect
7. Family account detail shows family-filtered transactions
8. Global account detail shows all transactions
9. Share account with another family
10. Remove account share
11. Balance hidden for non-owner viewer
12. Empty state when no accounts

#### Priority 4: Supporting Features

**`src/__tests__/categories.integration.test.tsx`** (8 tests)

1. Settings page shows category tree (expense + income sections)
2. Add root expense category → appears in tree
3. Add root income category → appears in tree
4. Add child category under parent → nested in tree
5. Edit category name → updates in tree
6. Delete category with 0 transactions → removed
7. Delete category with transactions → shows reassignment dialog
8. Duplicate category name → validation error

**`src/__tests__/family-context.integration.test.tsx`** (6 tests)

1. FamilyContext provides currentFamily in nested components
2. FamilyContext provides families list
3. Preferred family stored in localStorage
4. switchFamily updates context and token
5. Family switcher dropdown shows all families
6. Loading state while fetching family data

---

## Phase 3: Verify

- Run `npm run test:run` → all 62 tests pass
- Run `npm run test:coverage` → verify critical paths covered
- Tests complete in <30 seconds
- No flaky tests

---

## Key Patterns

**Integration tests** render full pages with `renderWithProviders()`, interact via `userEvent`, and assert on visible UI changes. No testing of hook internals, React Query cache mechanics, or MUI component behavior.

**Semantic queries only**: `getByRole`, `getByLabelText`, `getByText` — never `getByTestId` unless absolutely necessary.

**Critical files to reference during implementation**:

- `src/test/utils.tsx` — renderWithProviders, setupAuthenticatedUser
- `src/test/mocks/handlers/` — MSW handler patterns
- `src/test/mocks/factories/` — test data factories
- `src/router/index.tsx` — route structure for navigation tests
- `src/features/transactions/pages/TransactionsPage.tsx` — primary page to test
- `src/features/accounts/pages/AccountsPage.tsx` — accounts workflow
- `src/features/settings/pages/SettingsPage.tsx` — categories via settings
