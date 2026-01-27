# Sprint 3 - Milestone 3: Testing & Polish

## Overview
Write tests for accounts feature, add polish like empty states, and integrate account selection into transaction form.

## Agent Assignments
- **Primary**: `frontend-test`
- **Validation**: `code-reviewer`
- **Fallback**: `frontend-dev`

## Dependencies
- Milestone 2 (CRUD Operations) - Full CRUD functionality must be complete

## Success Criteria
- [x] All account hooks have test coverage
- [x] AccountForm has validation tests
- [x] AgAccountsGrid has rendering tests
- [x] Empty state displays when no accounts
- [x] Transaction form uses dynamic account dropdown
- [x] All tests pass

---

## Tasks

### Step 8: Testing & Polish

#### Task 8.1: useAccounts Tests
**File**: `frontend/src/features/accounts/__tests__/useAccounts.test.ts`

- [x] Test successful fetch returns accounts array
- [x] Test loading state during fetch
- [x] Test error handling for API failures
- [x] Test query key includes familyId
- [x] Test refetch on familyId change
- [x] Mock API responses with MSW

#### Task 8.2: useCreateAccount Tests
**File**: `frontend/src/features/accounts/__tests__/useCreateAccount.test.ts`

- [x] Test successful mutation calls API with correct data
- [x] Test cache invalidation after success
- [x] Test error handling for validation errors
- [x] Test share_with field is included when provided

#### Task 8.3: useUpdateAccount Tests
**File**: `frontend/src/features/accounts/__tests__/useUpdateAccount.test.ts`

- [x] Test successful update calls PATCH endpoint
- [x] Test cache invalidation for both list and detail queries
- [x] Test error handling (404, 403)

#### Task 8.4: useDeleteAccount Tests
**File**: `frontend/src/features/accounts/__tests__/useDeleteAccount.test.ts`

- [x] Test successful deletion
- [x] Test cache invalidation after delete
- [x] Test error handling for 409 Conflict (has transactions)

#### Task 8.5: AccountForm Tests
**File**: `frontend/src/features/accounts/__tests__/AccountForm.test.tsx`

- [x] Test form renders all fields
- [x] Test name field is required (show error when empty)
- [x] Test type field is required
- [x] Test balance validation (>= 0)
- [x] Test submit button disabled during loading
- [x] Test cancel button calls onCancel
- [x] Test edit mode pre-populates fields
- [x] Test submit calls onSubmit with correct data

#### Task 8.6: AgAccountsGrid Tests
**File**: `frontend/src/components/domain/ag/__tests__/AgAccountsGrid.test.tsx`

- [x] Test grid renders with mock data
- [x] Test all columns display correctly
- [x] Test currency formatting
- [x] Test account type badge rendering
- [x] Test row click calls onRowClick
- [x] Test loading overlay during fetch
- [x] Test empty state when no accounts

#### Task 8.7: Empty State for AccountsPage
**File**: `frontend/src/features/accounts/pages/AccountsPage.tsx`

- [x] Add empty state component when accounts array is empty
- [x] Display friendly message: "No accounts yet"
- [x] Include "Add your first account" button
- [x] Use consistent empty state styling

#### Task 8.8: Transaction Form Account Select
**File**: `frontend/src/features/transactions/components/TransactionForm.tsx`

- [x] Replace placeholder account select (lines ~142-144) with dynamic dropdown
- [x] Import and use `useAccounts` hook
- [x] Populate select with account options from hook
- [x] Format options: `{account.name} ({account.type})`
- [x] Handle loading state for account options
- [x] Validate account_id is required

---

## Validation Commands

```bash
# Run all frontend tests
cd frontend && npm run test:run

# Run only accounts tests
cd frontend && npm run test:run -- --grep "accounts"

# Run with coverage
cd frontend && npm run test:coverage

# Manual testing:
# 1. Verify empty state shows when no accounts
# 2. Verify transaction form account dropdown works
# 3. Test full CRUD flow end-to-end

# Type check
cd frontend && npm run build
```

---

## Test File Structure

```
frontend/src/features/accounts/__tests__/
├── useAccounts.test.ts
├── useAccount.test.ts
├── useCreateAccount.test.ts
├── useUpdateAccount.test.ts
├── useDeleteAccount.test.ts
└── AccountForm.test.tsx

frontend/src/components/domain/ag/__tests__/
└── AgAccountsGrid.test.tsx
```

---

## Notes
- Follow existing test patterns from transactions feature
- Use MSW (Mock Service Worker) for API mocking
- Use React Testing Library for component tests
- Use @testing-library/react-hooks for hook tests
- Ensure tests are isolated and don't depend on each other
- Add descriptive test names explaining the behavior being tested
