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
- [ ] User menu has "See All Accounts" item
- [ ] AllAccountsPage displays all user accounts across families
- [ ] Global accounts route works outside family context
- [ ] useAllAccounts hook fetches without tenant_id filter
- [ ] Navigation between global and family views works

---

## Tasks

### Step 9: User Menu Enhancement

#### Task 9.1: Add Menu Item to TopNav
**File**: `frontend/src/components/ui/organisms/TopNav.tsx`

- [ ] Locate user menu dropdown (after email, before Logout)
- [ ] Add "See All Accounts" menu item
- [ ] On click: Navigate to `/app/accounts`
- [ ] Add appropriate icon (AccountBalanceWallet or similar)

#### Task 9.2: Create useAllAccounts Hook
**File**: `frontend/src/features/accounts/hooks/useAllAccounts.ts`

- [ ] Create hook with query key `['accounts', 'all']`
- [ ] Call `getAccounts()` WITHOUT tenant_id parameter
- [ ] Returns all user's accounts across all families
- [ ] Handle loading/error states

#### Task 9.3: Create AllAccountsPage
**File**: `frontend/src/features/accounts/pages/AllAccountsPage.tsx`

- [ ] Route: `/app/accounts`
- [ ] Page title: "All My Accounts"
- [ ] Render `AgAccountsGrid` without familyId (uses useAllAccounts internally)
- [ ] Or: Create variant that accepts accounts data directly
- [ ] Add "Add Account" button (navigates to `/app/accounts/new`)
- [ ] Row click → navigate to `/app/accounts/:accountId` (global detail)
- [ ] Show family/tenant name for each account (if shared with multiple)
- [ ] Add empty state

#### Task 9.4: Add Global Routes to Router
**File**: `frontend/src/router/index.tsx`

- [ ] Add route for AllAccountsPage at `/app/accounts` (exact)
- [ ] **IMPORTANT**: Route order matters:
  1. `/app/accounts` (exact) - AllAccountsPage
  2. `/app/accounts/new` - GlobalAddAccountPage
  3. `/app/accounts/:accountId` - GlobalAccountDetailPage
- [ ] All routes should be protected (require auth) but NOT require FamilyGuard
- [ ] Ensure these routes are BEFORE `/app/:familyId/*` routes to avoid conflicts

#### Task 9.5: Create GlobalAccountDetailPage
**File**: `frontend/src/features/accounts/pages/GlobalAccountDetailPage.tsx`

- [ ] Route: `/app/accounts/:accountId`
- [ ] Similar to FamilyAccountDetailPage but:
  - No familyId context
  - Transactions filtered by account only (not by family)
  - Can navigate back to AllAccountsPage
- [ ] Render AccountSummary
- [ ] Render AgTransactionsGrid with accountId filter only
- [ ] Include sharing section (for account owner)

#### Task 9.6: Create GlobalAddAccountPage
**File**: `frontend/src/features/accounts/pages/GlobalAddAccountPage.tsx`

- [ ] Route: `/app/accounts/new`
- [ ] Render AccountForm in create mode
- [ ] No automatic share_with (user owns account, can share later)
- [ ] On success: Navigate to AllAccountsPage or new account detail
- [ ] On cancel: Navigate to AllAccountsPage

#### Task 9.7: Update AgAccountsGrid for Global Context
**File**: `frontend/src/components/domain/ag/AgAccountsGrid.tsx`

- [ ] Make familyId prop optional
- [ ] When familyId is undefined: use `useAllAccounts` instead of `useAccounts`
- [ ] Or: Accept `accounts` prop directly for flexibility
- [ ] Add column for "Family" or "Shared With" in global view

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
