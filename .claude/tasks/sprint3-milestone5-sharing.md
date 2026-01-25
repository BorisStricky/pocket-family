# Sprint 3 - Milestone 5: Account Sharing Feature

## Overview
Implement account sharing functionality allowing users to share their accounts with other families and manage share visibility.

## Agent Assignments
- **Primary**: `frontend-dev`
- **Validation**: `frontend-test`
- **Fallback**: `frontend-dev`

## Dependencies
- Milestone 4 (Global Accounts View) - Global detail pages must exist for sharing UI

## Success Criteria
- [ ] Account shares API functions work correctly
- [ ] React Query hooks manage share state
- [ ] AccountShareList displays shares for account owners
- [ ] ShareAccountDialog allows creating new shares
- [ ] EditShareDialog allows updating share visibility
- [ ] Only account owners see sharing UI
- [ ] All sharing tests pass

---

## Tasks

### Step 10: Account Sharing Feature

#### Task 10.1: Account Share Types
**File**: `frontend/src/types/accountShare.ts`

- [ ] Define share types:
  ```typescript
  export type ShareVisibility = 'hidden' | 'visible';

  export interface AccountShareRead {
    id: string;
    account_id: string;
    tenant_id: string;
    tenant_name?: string; // May need to fetch separately
    visibility: ShareVisibility;
    granted_by: string;
    granted_at: string;
  }

  export interface AccountShareCreate {
    tenant_id: string;
    visibility?: ShareVisibility;
  }

  export interface AccountShareUpdate {
    visibility?: ShareVisibility | null;
  }
  ```

#### Task 10.2: Account Shares API Functions
**File**: `frontend/src/features/accounts/api/accountSharesApi.ts`

- [ ] Implement `getAccountShares(accountId: string): Promise<AccountShareRead[]>`
  - GET `/accounts/{account_id}/shares`
- [ ] Implement `createAccountShare(accountId: string, data: AccountShareCreate): Promise<AccountShareRead>`
  - POST `/accounts/{account_id}/shares`
- [ ] Implement `updateAccountShare(accountId: string, tenantId: string, data: AccountShareUpdate): Promise<AccountShareRead>`
  - PATCH `/accounts/{account_id}/shares/{tenant_id}`
- [ ] Implement `deleteAccountShare(accountId: string, tenantId: string): Promise<void>`
  - DELETE `/accounts/{account_id}/shares/{tenant_id}`

#### Task 10.3: useAccountShares Hook
**File**: `frontend/src/features/accounts/hooks/useAccountShares.ts`

- [ ] Create hook with query key `['accountShares', accountId]`
- [ ] Call `getAccountShares(accountId)`
- [ ] Only enabled when user is account owner
- [ ] Handle loading/error states

#### Task 10.4: useCreateAccountShare Hook
**File**: `frontend/src/features/accounts/hooks/useCreateAccountShare.ts`

- [ ] Create mutation hook calling `createAccountShare`
- [ ] Invalidate `['accountShares', accountId]` on success
- [ ] Handle errors (duplicate share, invalid tenant)

#### Task 10.5: useUpdateAccountShare Hook
**File**: `frontend/src/features/accounts/hooks/useUpdateAccountShare.ts`

- [ ] Create mutation hook calling `updateAccountShare`
- [ ] Invalidate account share queries on success

#### Task 10.6: useDeleteAccountShare Hook
**File**: `frontend/src/features/accounts/hooks/useDeleteAccountShare.ts`

- [ ] Create mutation hook calling `deleteAccountShare`
- [ ] Invalidate `['accountShares', accountId]` on success

#### Task 10.7: AccountShareList Component
**File**: `frontend/src/features/accounts/components/AccountShareList.tsx`

- [ ] Props: `accountId: string`, `isOwner: boolean`
- [ ] Only render content if `isOwner` is true
- [ ] Fetch shares with `useAccountShares`
- [ ] Display list of families account is shared with:
  - Family/Tenant name
  - Visibility status chip (hidden: gray, visible: green)
  - Edit button → opens EditShareDialog
  - Delete button → confirmation → delete share
- [ ] Empty state: "This account is not shared with any families"
- [ ] Add "Share Account" button at bottom

#### Task 10.8: ShareAccountDialog Component
**File**: `frontend/src/features/accounts/components/ShareAccountDialog.tsx`

- [ ] Props: `accountId`, `open`, `onClose`
- [ ] MUI Dialog component
- [ ] Form fields:
  - Family dropdown (select from user's families)
    - Fetch families with `useFamilies` hook
    - Exclude current family (if in family context)
    - Exclude families already shared with
  - Visibility select: hidden (default) / visible
- [ ] On submit:
  - Call `useCreateAccountShare` mutation
  - Show success toast
  - Close dialog
- [ ] Validation: Family selection is required
- [ ] Handle errors (display in dialog)

#### Task 10.9: EditShareDialog Component
**File**: `frontend/src/features/accounts/components/EditShareDialog.tsx`

- [ ] Props: `accountId`, `share: AccountShareRead`, `open`, `onClose`
- [ ] MUI Dialog component
- [ ] Form fields:
  - Display family name (read-only)
  - Visibility select: hidden / visible
- [ ] On submit:
  - Call `useUpdateAccountShare` mutation
  - Show success toast
  - Close dialog
- [ ] Handle errors

#### Task 10.10: Integrate Sharing UI into Detail Pages
**Files**:
- `frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx`
- `frontend/src/features/accounts/pages/GlobalAccountDetailPage.tsx`

- [ ] Determine ownership by comparing `account.user_id` with current user id
  - Get current user from auth context
- [ ] Conditionally render sharing section:
  ```tsx
  {isOwner && (
    <>
      <Typography variant="h6">Account Sharing</Typography>
      <AccountShareList accountId={accountId} isOwner={isOwner} />
    </>
  )}
  ```
- [ ] Add "Share Account" button that opens ShareAccountDialog
- [ ] Position sharing section below AccountSummary, above transactions

---

### Step 11: Account Sharing Testing

#### Task 11.1: useAccountShares Tests
**File**: `frontend/src/features/accounts/__tests__/useAccountShares.test.ts`

- [ ] Test successful fetch returns shares array
- [ ] Test loading state
- [ ] Test error handling
- [ ] Test query is disabled when not owner

#### Task 11.2: useCreateAccountShare Tests
**File**: `frontend/src/features/accounts/__tests__/useCreateAccountShare.test.ts`

- [ ] Test successful share creation
- [ ] Test cache invalidation
- [ ] Test error handling for duplicate share

#### Task 11.3: useUpdateAccountShare Tests
**File**: `frontend/src/features/accounts/__tests__/useUpdateAccountShare.test.ts`

- [ ] Test visibility update
- [ ] Test cache invalidation

#### Task 11.4: useDeleteAccountShare Tests
**File**: `frontend/src/features/accounts/__tests__/useDeleteAccountShare.test.ts`

- [ ] Test successful deletion
- [ ] Test cache invalidation

#### Task 11.5: AccountShareList Tests
**File**: `frontend/src/features/accounts/__tests__/AccountShareList.test.tsx`

- [ ] Test renders nothing when not owner
- [ ] Test renders shares list when owner
- [ ] Test visibility chips display correctly
- [ ] Test edit button opens dialog
- [ ] Test delete button with confirmation
- [ ] Test empty state

#### Task 11.6: ShareAccountDialog Tests
**File**: `frontend/src/features/accounts/__tests__/ShareAccountDialog.test.tsx`

- [ ] Test dialog opens and closes
- [ ] Test family dropdown populates correctly
- [ ] Test already-shared families are excluded
- [ ] Test form validation (family required)
- [ ] Test successful submission
- [ ] Test error display

#### Task 11.7: EditShareDialog Tests
**File**: `frontend/src/features/accounts/__tests__/EditShareDialog.test.tsx`

- [ ] Test dialog displays share info
- [ ] Test visibility select changes
- [ ] Test successful update
- [ ] Test error handling

#### Task 11.8: Integration Tests
**File**: `frontend/src/features/accounts/__tests__/accountSharing.integration.test.tsx`

- [ ] Test full sharing flow:
  1. View account detail as owner
  2. Click "Share Account"
  3. Select family and visibility
  4. Submit share
  5. Verify share appears in list
  6. Edit visibility
  7. Delete share
  8. Verify share removed from list

---

## Validation Commands

```bash
# Run all accounts tests
cd frontend && npm run test:run -- --grep "account"

# Run sharing-specific tests
cd frontend && npm run test:run -- --grep "share"

# Run with coverage
cd frontend && npm run test:coverage

# Manual testing:
# 1. Create account as User A
# 2. Share with Family B
# 3. Verify Family B members can see account
# 4. Edit share visibility
# 5. Remove share
# 6. Verify non-owners don't see sharing UI

# Type check
cd frontend && npm run build
```

---

## Notes
- Sharing UI should only be visible to account owners
- Use `account.user_id === currentUser.id` to determine ownership
- Family dropdown should show user-friendly family names
- Consider loading states for all async operations
- Visibility "hidden" means family members see account but not balance
- Visibility "visible" means family members see full account details
- Follow MUI Dialog patterns for consistency
- Use React Query for all data fetching and mutations
