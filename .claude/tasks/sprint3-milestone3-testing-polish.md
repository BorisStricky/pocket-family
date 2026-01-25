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
- [ ] All account hooks have test coverage
- [ ] AccountForm has validation tests
- [ ] AgAccountsGrid has rendering tests
- [ ] Empty state displays when no accounts
- [ ] Transaction form uses dynamic account dropdown
- [ ] All tests pass

---

## Tasks

### Step 8: Testing & Polish

#### Task 8.1: useAccounts Tests
**File**: `frontend/src/features/accounts/__tests__/useAccounts.test.ts`

- [ ] Test successful fetch returns accounts array
- [ ] Test loading state during fetch
- [ ] Test error handling for API failures
- [ ] Test query key includes familyId
- [ ] Test refetch on familyId change
- [ ] Mock API responses with MSW

#### Task 8.2: useCreateAccount Tests
**File**: `frontend/src/features/accounts/__tests__/useCreateAccount.test.ts`

- [ ] Test successful mutation calls API with correct data
- [ ] Test cache invalidation after success
- [ ] Test error handling for validation errors
- [ ] Test share_with field is included when provided

#### Task 8.3: useUpdateAccount Tests
**File**: `frontend/src/features/accounts/__tests__/useUpdateAccount.test.ts`

- [ ] Test successful update calls PATCH endpoint
- [ ] Test cache invalidation for both list and detail queries
- [ ] Test error handling (404, 403)

#### Task 8.4: useDeleteAccount Tests
**File**: `frontend/src/features/accounts/__tests__/useDeleteAccount.test.ts`

- [ ] Test successful deletion
- [ ] Test cache invalidation after delete
- [ ] Test error handling for 409 Conflict (has transactions)

#### Task 8.5: AccountForm Tests
**File**: `frontend/src/features/accounts/__tests__/AccountForm.test.tsx`

- [ ] Test form renders all fields
- [ ] Test name field is required (show error when empty)
- [ ] Test type field is required
- [ ] Test balance validation (>= 0)
- [ ] Test submit button disabled during loading
- [ ] Test cancel button calls onCancel
- [ ] Test edit mode pre-populates fields
- [ ] Test submit calls onSubmit with correct data

#### Task 8.6: AgAccountsGrid Tests
**File**: `frontend/src/components/domain/ag/__tests__/AgAccountsGrid.test.tsx`

- [ ] Test grid renders with mock data
- [ ] Test all columns display correctly
- [ ] Test currency formatting
- [ ] Test account type badge rendering
- [ ] Test row click calls onRowClick
- [ ] Test loading overlay during fetch
- [ ] Test empty state when no accounts

#### Task 8.7: Empty State for AccountsPage
**File**: `frontend/src/features/accounts/pages/AccountsPage.tsx`

- [ ] Add empty state component when accounts array is empty
- [ ] Display friendly message: "No accounts yet"
- [ ] Include "Add your first account" button
- [ ] Use consistent empty state styling

#### Task 8.8: Transaction Form Account Select
**File**: `frontend/src/features/transactions/components/TransactionForm.tsx`

- [ ] Replace placeholder account select (lines ~142-144) with dynamic dropdown
- [ ] Import and use `useAccounts` hook
- [ ] Populate select with account options from hook
- [ ] Format options: `{account.name} ({account.type})`
- [ ] Handle loading state for account options
- [ ] Validate account_id is required

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
