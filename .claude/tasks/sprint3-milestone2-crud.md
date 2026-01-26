# Sprint 3 - Milestone 2: CRUD Operations

## Overview
Complete the account CRUD flow with add/edit pages and delete functionality with confirmation dialogs.

## Agent Assignments
- **Primary**: `frontend-dev`
- **Validation**: `frontend-test`
- **Fallback**: `frontend-dev`

## Dependencies
- Milestone 1 (Accounts Page) - AccountForm, hooks, and pages must exist

## Success Criteria
- [x] Users can create new accounts via AddAccountPage
- [x] Users can edit existing accounts
- [x] Users can delete accounts with confirmation
- [x] Success/error messages show appropriate content (using Alert components instead of toasts)
- [x] Delete warns if account has transactions

---

## Tasks

### Step 6: Add/Edit Flow

#### Task 6.1: AddAccountPage
**File**: `frontend/src/features/accounts/pages/AddAccountPage.tsx`

- [x] Route: `/app/:familyId/accounts/new`
- [x] Render `AccountForm` in create mode
- [x] On submit:
  - Call `useCreateAccount` mutation
  - Include `share_with: { tenant_id: familyId, visibility: 'visible' }` when creating within family context
  - Show success message (using Alert component)
  - Navigate back to accounts list
- [x] On cancel: Navigate back to accounts list
- [x] Handle error states with Alert component

#### Task 6.2: Add Create Route to Router
**File**: `frontend/src/router/index.tsx`

- [x] Add route for AddAccountPage at `/app/:familyId/accounts/new`
- [x] Ensure route order: `/new` before `/:accountId` to avoid conflicts

#### Task 6.3: Edit Account Modal/Page
**File**: `frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx`

- [x] Add edit functionality to detail page:
  - Option B: Navigate to `/app/:familyId/accounts/:accountId/edit` (implemented)
- [x] Pre-populate `AccountForm` with account data
- [x] Call `useUpdateAccount` mutation on submit
- [x] Show success message on update (using Alert component)
- [x] Refresh account data after update (via React Query cache invalidation)

#### Task 6.4: EditAccountPage (if using separate page)
**File**: `frontend/src/features/accounts/pages/EditAccountPage.tsx`

- [x] Route: `/app/:familyId/accounts/:accountId/edit`
- [x] Fetch account with `useAccount`
- [x] Render `AccountForm` in edit mode with initialData
- [x] Handle submit with `useUpdateAccount`
- [x] Navigate back to detail page on success/cancel

---

### Step 7: Delete Flow

#### Task 7.1: DeleteConfirmDialog Enhancement
**File**: `frontend/src/components/ui/molecules/DeleteConfirmDialog.tsx`

- [x] Ensure dialog component exists and supports:
  - Custom title and message
  - Warning messages handled via custom message text
  - Loading state handled in parent component (button disabled state)
  - onConfirm and onCancel callbacks

#### Task 7.2: Account Delete in Detail Page
**File**: `frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx`

- [x] Add Delete button to account detail page
- [x] On click: Open `DeleteConfirmDialog`
- [x] Check if account has transactions:
  - If yes: Show warning message about cascade delete
  - Backend may prevent deletion or cascade
- [x] On confirm:
  - Call `useDeleteAccount` mutation
  - Navigate to accounts list (Alert message shown on error)
  - Navigate to accounts list on success
- [x] Handle error responses (including 409 Conflict if backend returns it)

#### Task 7.3: Transaction Count Check (Optional Enhancement)
**File**: `frontend/src/features/accounts/hooks/useAccountTransactionCount.ts`

- [ ] Create hook to check if account has transactions
- [ ] Query key: `['account', accountId, 'transactionCount']`
- [ ] Used to show appropriate delete warning

---

## Validation Commands

```bash
# Run frontend tests
cd frontend && npm run test:run

# Manual testing checklist:
# 1. Create new account from accounts page
# 2. Edit account from detail page
# 3. Delete account (with and without transactions)
# 4. Verify toasts appear correctly
# 5. Verify navigation works after operations

# Type check
cd frontend && npm run build
```

---

## Notes
- Reuse DeleteConfirmDialog from existing components if available
- Follow MUI dialog patterns for consistency
- Use React Query's `invalidateQueries` for cache updates
- Handle optimistic updates if desired (optional)
- Error messages should be user-friendly
