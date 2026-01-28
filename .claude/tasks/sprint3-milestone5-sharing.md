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
- [x] Account shares API functions work correctly
- [x] React Query hooks manage share state
- [x] AccountShareList displays shares for account owners
- [x] ShareAccountDialog allows creating new shares
- [x] EditShareDialog allows updating share visibility
- [x] Only account owners see sharing UI
- [x] All sharing tests pass (hook tests + backend tests)

---

## Tasks

### Step 10: Account Sharing Feature

#### Task 10.1: Account Share Types
**File**: `frontend/src/types/account.ts` (types defined here instead)

- [x] Define share types:
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

- [x] Implement `getAccountShares(accountId: string): Promise<AccountShareRead[]>`
  - GET `/accounts/{account_id}/shares`
- [x] Implement `createAccountShare(accountId: string, data: AccountShareCreate): Promise<AccountShareRead>`
  - POST `/accounts/{account_id}/shares`
- [x] Implement `updateAccountShare(accountId: string, tenantId: string, data: AccountShareUpdate): Promise<AccountShareRead>`
  - PATCH `/accounts/{account_id}/shares/{tenant_id}`
- [x] Implement `deleteAccountShare(accountId: string, tenantId: string): Promise<void>`
  - DELETE `/accounts/{account_id}/shares/{tenant_id}`

#### Task 10.3: useAccountShares Hook
**File**: `frontend/src/features/accounts/hooks/useAccountShares.ts`

- [x] Create hook with query key `['accountShares', accountId]`
- [x] Call `getAccountShares(accountId)`
- [x] Only enabled when user is account owner
- [x] Handle loading/error states

#### Task 10.4: useCreateAccountShare Hook
**File**: `frontend/src/features/accounts/hooks/useCreateAccountShare.ts`

- [x] Create mutation hook calling `createAccountShare`
- [x] Invalidate `['accountShares', accountId]` on success
- [x] Handle errors (duplicate share, invalid tenant)

#### Task 10.5: useUpdateAccountShare Hook
**File**: `frontend/src/features/accounts/hooks/useUpdateAccountShare.ts`

- [x] Create mutation hook calling `updateAccountShare`
- [x] Invalidate account share queries on success

#### Task 10.6: useDeleteAccountShare Hook
**File**: `frontend/src/features/accounts/hooks/useDeleteAccountShare.ts`

- [x] Create mutation hook calling `deleteAccountShare`
- [x] Invalidate `['accountShares', accountId]` on success

#### Task 10.7: AccountShareList Component
**File**: `frontend/src/features/accounts/components/AccountShareList.tsx`

- [x] Props: `accountId: string`, `isOwner: boolean`
- [x] Only render content if `isOwner` is true
- [x] Fetch shares with `useAccountShares`
- [x] Display list of families account is shared with:
  - Family/Tenant name (displays tenant_name from backend)
  - Visibility status chip (hidden: gray, visible: green)
  - Edit button → opens EditShareDialog
  - Delete button → confirmation → delete share
- [x] Empty state: "This account is not shared with any families"
- [x] Add "Share Account" button at bottom

#### Task 10.8: ShareAccountDialog Component
**File**: `frontend/src/features/accounts/components/ShareAccountDialog.tsx`

- [x] Props: `accountId`, `open`, `onClose`, `currentFamilyId`
- [x] MUI Dialog component
- [x] Form fields:
  - Family dropdown (select from user's families)
    - Fetch families with `useFamilies` hook
    - Exclude current family (if in family context)
    - Exclude families already shared with
  - Visibility select: hidden (default) / visible
- [x] On submit:
  - Call `useCreateAccountShare` mutation
  - Close dialog
- [x] Validation: Family selection is required
- [x] Handle errors (display in dialog)

#### Task 10.9: EditShareDialog Component
**File**: `frontend/src/features/accounts/components/EditShareDialog.tsx`

- [x] Props: `accountId`, `share: AccountShareRead`, `open`, `onClose`
- [x] MUI Dialog component
- [x] Form fields:
  - Display family name (read-only, shows tenant_name)
  - Visibility select: hidden / visible
- [x] On submit:
  - Call `useUpdateAccountShare` mutation
  - Close dialog
- [x] Handle errors

#### Task 10.10: Integrate Sharing UI into Detail Pages
**Files**:
- `frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx`
- `frontend/src/features/accounts/pages/GlobalAccountDetailPage.tsx`

- [x] Determine ownership by comparing `account.user_id` with current user id
  - Get current user from auth context using `useAuth()`
- [x] Conditionally render sharing section:
  ```tsx
  {isOwner && (
    <Box mb={4}>
      <AccountShareList accountId={accountId} isOwner={isOwner} />
    </Box>
  )}
  ```
- [x] Add "Share Account" button that opens ShareAccountDialog (integrated into AccountShareList)
- [x] Position sharing section below AccountSummary, above transactions

---

### Step 11: Account Sharing Testing

#### Task 11.1: useAccountShares Tests
**File**: `frontend/src/features/accounts/__tests__/useAccountShares.test.tsx`

- [x] Test successful fetch returns shares array
- [x] Test loading state
- [x] Test error handling
- [x] Test query is disabled when not owner

#### Task 11.2: useCreateAccountShare Tests
**File**: `frontend/src/features/accounts/__tests__/useCreateAccountShare.test.tsx`

- [x] Test successful share creation
- [x] Test cache invalidation
- [x] Test error handling for duplicate share

#### Task 11.3: useUpdateAccountShare Tests
**File**: `frontend/src/features/accounts/__tests__/useUpdateAccountShare.test.tsx`

- [x] Test visibility update
- [x] Test cache invalidation

#### Task 11.4: useDeleteAccountShare Tests
**File**: `frontend/src/features/accounts/__tests__/useDeleteAccountShare.test.tsx`

- [x] Test successful deletion
- [x] Test cache invalidation

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

---

## Completion Status

**Completed**: 2026-01-28

### What Was Implemented
✅ **Core Feature (Step 10)**: All tasks completed
- Account share types defined in `frontend/src/types/account.ts`
- All CRUD API functions in `accountSharesApi.ts`
- All React Query hooks (useAccountShares, useCreateAccountShare, useUpdateAccountShare, useDeleteAccountShare)
- AccountShareList component with delete confirmation
- ShareAccountDialog with smart family filtering
- EditShareDialog with visibility controls
- Full integration into FamilyAccountDetailPage and GlobalAccountDetailPage
- Ownership checks using `useAuth()` hook

✅ **Testing (Step 11 - Partial)**: Hook tests completed
- All hook tests created and passing (28 tests)
- Backend tests verified (61 tests passing)
- Frontend build successful with no TypeScript errors

### Backend Enhancements
During implementation, discovered UUIDs were displaying instead of family names. Enhanced backend to include tenant names:
- Updated `AccountShareRead` schema to include `tenant_name: str` field
- Created `_serialize_account_share()` function to fetch tenant names
- Updated GET, POST, and PATCH endpoints to return serialized shares with tenant names
- All backend tests passing with new schema

### What Was Not Implemented
❌ **Component Tests** (Tasks 11.5, 11.6, 11.7)
- AccountShareList component tests
- ShareAccountDialog component tests
- EditShareDialog component tests

❌ **Integration Tests** (Task 11.8)
- Full end-to-end sharing flow tests

### Validation Results
- ✅ All 61 backend tests passing
- ✅ All 170 frontend account tests passing (includes 28 new share hook tests)
- ✅ Frontend build successful
- ✅ TypeScript compilation with no errors
- ✅ Family names display correctly (not UUIDs)
