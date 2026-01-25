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
- [ ] Users can create new accounts via AddAccountPage
- [ ] Users can edit existing accounts
- [ ] Users can delete accounts with confirmation
- [ ] Success/error toasts show appropriate messages
- [ ] Delete warns if account has transactions

---

## Tasks

### Step 6: Add/Edit Flow

#### Task 6.1: AddAccountPage
**File**: `frontend/src/features/accounts/pages/AddAccountPage.tsx`

- [ ] Route: `/app/:familyId/accounts/new`
- [ ] Render `AccountForm` in create mode
- [ ] On submit:
  - Call `useCreateAccount` mutation
  - Include `share_with: { tenant_id: familyId, visibility: 'visible' }` when creating within family context
  - Show success toast
  - Navigate back to accounts list
- [ ] On cancel: Navigate back to accounts list
- [ ] Handle error states with toast

#### Task 6.2: Add Create Route to Router
**File**: `frontend/src/router/index.tsx`

- [ ] Add route for AddAccountPage at `/app/:familyId/accounts/new`
- [ ] Ensure route order: `/new` before `/:accountId` to avoid conflicts

#### Task 6.3: Edit Account Modal/Page
**File**: `frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx`

- [ ] Add edit functionality to detail page:
  - Option A: Edit modal that opens on Edit button click
  - Option B: Navigate to `/app/:familyId/accounts/:accountId/edit`
- [ ] Pre-populate `AccountForm` with account data
- [ ] Call `useUpdateAccount` mutation on submit
- [ ] Show success toast on update
- [ ] Refresh account data after update

#### Task 6.4: EditAccountPage (if using separate page)
**File**: `frontend/src/features/accounts/pages/EditAccountPage.tsx`

- [ ] Route: `/app/:familyId/accounts/:accountId/edit`
- [ ] Fetch account with `useAccount`
- [ ] Render `AccountForm` in edit mode with initialData
- [ ] Handle submit with `useUpdateAccount`
- [ ] Navigate back to detail page on success/cancel

---

### Step 7: Delete Flow

#### Task 7.1: DeleteConfirmDialog Enhancement
**File**: `frontend/src/components/ui/molecules/DeleteConfirmDialog.tsx`

- [ ] Ensure dialog component exists and supports:
  - Custom title and message
  - Warning variant for cascade operations
  - Loading state during deletion
  - onConfirm and onCancel callbacks

#### Task 7.2: Account Delete in Detail Page
**File**: `frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx`

- [ ] Add Delete button to account detail page
- [ ] On click: Open `DeleteConfirmDialog`
- [ ] Check if account has transactions:
  - If yes: Show warning message about cascade delete
  - Backend may prevent deletion or cascade
- [ ] On confirm:
  - Call `useDeleteAccount` mutation
  - Show success toast
  - Navigate to accounts list
- [ ] Handle 409 Conflict error (account has transactions)

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
