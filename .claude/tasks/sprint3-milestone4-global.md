# Sprint 3 - Milestone 4: Global Accounts View

## Overview

Add "See All Accounts" feature accessible from user menu, showing all user's accounts across all families.

## Agent Assignments

- **Primary**: `frontend-dev`
- **Validation**: `frontend-test`
- **Fallback**: `frontend-dev`

## Dependencies

- Milestone 3 (Testing & Polish) - Core accounts feature must be tested and working

## Success Criteria

- [x] User menu has "See All Accounts" item
- [x] AllAccountsPage displays all user accounts across families
- [x] Global accounts route works outside family context
- [x] useAllAccounts hook fetches without tenant_id filter
- [x] Navigation between global and family views works

---

## Tasks

### Step 9: User Menu Enhancement

#### Task 9.1: Add Menu Item to TopNav

**File**: `frontend/src/components/ui/organisms/TopNav.tsx`

- [x] Locate user menu dropdown (after email, before Logout)
- [x] Add "See All Accounts" menu item
- [x] On click: Navigate to `/app/accounts`
- [x] Add appropriate icon (AccountBalanceWallet or similar)

#### Task 9.2: Create useAllAccounts Hook

**File**: `frontend/src/features/accounts/hooks/useAllAccounts.ts`

- [x] Create hook with query key `['accounts', 'all']`
- [x] Call `getAccounts()` WITHOUT tenant_id parameter
- [x] Returns all user's accounts across all families
- [x] Handle loading/error states

#### Task 9.3: Create AllAccountsPage

**File**: `frontend/src/features/accounts/pages/AllAccountsPage.tsx`

- [x] Route: `/app/accounts`
- [x] Page title: "All My Accounts"
- [x] Render `AgAccountsGrid` without familyId (uses useAllAccounts internally)
- [x] Or: Create variant that accepts accounts data directly
- [x] Add "Add Account" button (navigates to `/app/accounts/new`)
- [x] Row click → navigate to `/app/accounts/:accountId` (global detail)
- [x] Show family/tenant name for each account (if shared with multiple)
- [x] Add empty state

#### Task 9.4: Add Global Routes to Router

**File**: `frontend/src/router/index.tsx`

- [x] Add route for AllAccountsPage at `/app/accounts` (exact)
- [x] **IMPORTANT**: Route order matters:
  1. `/app/accounts` (exact) - AllAccountsPage
  2. `/app/accounts/new` - GlobalAddAccountPage
  3. `/app/accounts/:accountId` - GlobalAccountDetailPage
- [x] All routes should be protected (require auth) but NOT require FamilyGuard
- [x] Ensure these routes are BEFORE `/app/:familyId/*` routes to avoid conflicts

#### Task 9.5: Create GlobalAccountDetailPage

**File**: `frontend/src/features/accounts/pages/GlobalAccountDetailPage.tsx`

- [x] Route: `/app/accounts/:accountId`
- [x] Similar to FamilyAccountDetailPage but:
  - No familyId context
  - Transactions filtered by account only (not by family)
  - Can navigate back to AllAccountsPage
- [x] Render AccountSummary
- [x] Render AgTransactionsGrid with accountId filter only
- [x] Include sharing section (for account owner)

#### Task 9.6: Create GlobalAddAccountPage

**File**: `frontend/src/features/accounts/pages/GlobalAddAccountPage.tsx`

- [x] Route: `/app/accounts/new`
- [x] Render AccountForm in create mode
- [x] No automatic share_with (user owns account, can share later)
- [x] On success: Navigate to AllAccountsPage or new account detail
- [x] On cancel: Navigate to AllAccountsPage

#### Task 9.7: Update AgAccountsGrid for Global Context

**File**: `frontend/src/components/domain/ag/AgAccountsGrid.tsx`

- [x] Make familyId prop optional
- [x] When familyId is undefined: use `useAllAccounts` instead of `useAccounts`
- [x] Or: Accept `accounts` prop directly for flexibility
- [x] Add column for "Family" or "Shared With" in global view

---

## Validation Commands

```bash
# Run frontend tests
cd frontend && npm run test:run

# Manual testing:
# 1. Click user avatar → verify "See All Accounts" menu item
# 2. Click menu item → navigate to /app/accounts
# 3. Verify all accounts across families are shown
# 4. Click account → navigate to global detail page
# 5. Create account from global view
# 6. Navigate between family and global views

# Type check
cd frontend && npm run build
```

---

## Route Structure

```
/app/accounts           → AllAccountsPage (global)
/app/accounts/new       → GlobalAddAccountPage
/app/accounts/:id       → GlobalAccountDetailPage

/app/:familyId/accounts         → AccountsPage (family-scoped)
/app/:familyId/accounts/new     → AddAccountPage
/app/:familyId/accounts/:id     → FamilyAccountDetailPage
```

---

## Notes

- Global routes must be defined BEFORE parameterized routes in React Router
- Global view shows accounts the user owns OR has access to via any family
- Consider adding family indicator column in global grid
- TopNav user menu should be consistent across the app
- Protect routes with authentication but not family membership
