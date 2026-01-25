# Sprint 3 - Milestone 1: Accounts Page

## Overview
Build the accounts feature frontend: API functions, React Query hooks, AG Grid component, account form, and accounts page with navigation to detail view.

## Agent Assignments
- **Primary**: `frontend-dev`
- **Validation**: `frontend-test`
- **Fallback**: `frontend-dev`

## Dependencies
- Milestone 0 (Backend Enhancements) - backend API must support accounts endpoints

## Success Criteria
- [ ] Accounts API functions work correctly
- [ ] React Query hooks fetch and cache account data
- [ ] AgAccountsGrid displays accounts with proper columns
- [ ] AccountForm validates and submits account data
- [ ] AccountsPage renders grid and handles navigation
- [ ] AccountDetailPage shows account info and filtered transactions

---

## Tasks

### Step 1: Accounts API & Hooks

#### Task 1.1: Account Types
**File**: `frontend/src/types/account.ts`

- [ ] Define account types matching backend schemas:
  ```typescript
  export type AccountType = 'cash' | 'debit' | 'credit';
  export type Currency = 'BRL' | 'USD' | 'EUR';
  export type ShareVisibility = 'hidden' | 'visible';

  export interface AccountRead {
    id: string;
    user_id: string;
    user_name: string;
    name: string;
    type: AccountType;
    currency: Currency;
    balance: string | null;
    created_at: string;
    updated_at: string;
  }

  export interface AccountCreate {
    name: string;
    type: AccountType;
    currency?: Currency;
    balance?: number | string;
    share_with?: AccountShareWith;
  }

  export interface AccountUpdate {
    name?: string | null;
    type?: AccountType | null;
    currency?: Currency | null;
    balance?: number | string | null;
  }

  export interface AccountShareWith {
    tenant_id: string;
    visibility?: ShareVisibility;
  }
  ```

#### Task 1.2: Accounts API Functions
**File**: `frontend/src/features/accounts/api/accountsApi.ts`

- [ ] Implement `getAccounts(tenantId?: string): Promise<AccountRead[]>`
  - GET `/accounts` with optional `tenant_id` query param
- [ ] Implement `getAccount(accountId: string): Promise<AccountRead>`
  - GET `/accounts/{account_id}`
- [ ] Implement `createAccount(data: AccountCreate): Promise<AccountRead>`
  - POST `/accounts`
- [ ] Implement `updateAccount(accountId: string, data: AccountUpdate): Promise<AccountRead>`
  - PATCH `/accounts/{account_id}`
- [ ] Implement `deleteAccount(accountId: string): Promise<void>`
  - DELETE `/accounts/{account_id}`

#### Task 1.3: useAccounts Hook
**File**: `frontend/src/features/accounts/hooks/useAccounts.ts`

- [ ] Create hook with query key `['accounts', familyId]`
- [ ] Call `getAccounts(familyId)`
- [ ] Handle loading/error states

#### Task 1.4: useAccount Hook
**File**: `frontend/src/features/accounts/hooks/useAccount.ts`

- [ ] Create hook with query key `['account', familyId, accountId]`
- [ ] Call `getAccount(accountId)`
- [ ] Enable stale-while-revalidate pattern

#### Task 1.5: useCreateAccount Hook
**File**: `frontend/src/features/accounts/hooks/useCreateAccount.ts`

- [ ] Create mutation hook calling `createAccount`
- [ ] Invalidate `['accounts', familyId]` on success
- [ ] Handle error states

#### Task 1.6: useUpdateAccount Hook
**File**: `frontend/src/features/accounts/hooks/useUpdateAccount.ts`

- [ ] Create mutation hook calling `updateAccount`
- [ ] Invalidate both `['accounts']` and `['account', accountId]` on success

#### Task 1.7: useDeleteAccount Hook
**File**: `frontend/src/features/accounts/hooks/useDeleteAccount.ts`

- [ ] Create mutation hook calling `deleteAccount`
- [ ] Invalidate `['accounts', familyId]` on success
- [ ] Handle cascade warnings from backend

---

### Step 2: AG Grid Wrapper

#### Task 2.1: AgAccountsGrid Component
**File**: `frontend/src/components/domain/ag/AgAccountsGrid.tsx`

- [ ] Create component with props: `familyId`, `onRowClick?`
- [ ] Define column definitions:
  - `name` - Account name
  - `type` - Account type with badge/chip
  - `currency` - Currency code
  - `balance` - Formatted with currency symbol
  - `actions` - Edit/Delete buttons
- [ ] Add cell renderers:
  - Currency formatter (e.g., "R$ 1,234.56")
  - Account type badge (Cash/Debit/Credit)
- [ ] Integrate with `useAccounts` hook
- [ ] Handle row click for navigation
- [ ] Add loading state overlay

#### Task 2.2: AgAccountsGrid Story
**File**: `frontend/src/components/domain/ag/AgAccountsGrid.stories.tsx`

- [ ] Create Storybook story with mock account data
- [ ] Add variants: loading, empty, with data

---

### Step 3: Account Form

#### Task 3.1: AccountForm Component
**File**: `frontend/src/features/accounts/components/AccountForm.tsx`

- [ ] Props: `mode: 'create' | 'edit'`, `initialData?`, `onSubmit`, `onCancel`
- [ ] Fields:
  - Name (text input, required)
  - Type (select: cash/debit/credit, required)
  - Currency (select: BRL/USD/EUR, default BRL)
  - Initial Balance (number input, default 0, >= 0)
- [ ] Validation:
  - Name is required and non-empty
  - Balance must be >= 0
- [ ] Use React Hook Form for form management
- [ ] Include "Share with this family" checkbox when in family context (sets share_with)

---

### Step 4: Accounts Page

#### Task 4.1: AccountsPage
**File**: `frontend/src/features/accounts/pages/AccountsPage.tsx`

- [ ] Route: `/app/:familyId/accounts`
- [ ] Render `AgAccountsGrid` with familyId
- [ ] Add "Add Account" button (navigates to `/app/:familyId/accounts/new`)
- [ ] Handle row click → navigate to `/app/:familyId/accounts/:accountId`
- [ ] Add empty state when no accounts

#### Task 4.2: Add Route to Router
**File**: `frontend/src/router/index.tsx`

- [ ] Add route for AccountsPage at `/app/:familyId/accounts`
- [ ] Ensure route is protected with ProtectedRoute + FamilyGuard

---

### Step 5: Account Detail Page

#### Task 5.1: AccountSummary Component
**File**: `frontend/src/features/accounts/components/AccountSummary.tsx`

- [ ] Props: `account: AccountRead`
- [ ] Display:
  - Account name (heading)
  - Account type badge
  - Currency
  - Current balance (formatted)
  - Created/Updated dates
- [ ] Include Edit button (triggers edit modal/navigation)

#### Task 5.2: FamilyAccountDetailPage
**File**: `frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx`

- [ ] Route: `/app/:familyId/accounts/:accountId`
- [ ] Fetch account with `useAccount(accountId)`
- [ ] Render `AccountSummary`
- [ ] Render `AgTransactionsGrid` with filter: `accountId` AND `familyId`
- [ ] Add Edit and Delete buttons
- [ ] Handle loading/error states

#### Task 5.3: Add Detail Route to Router
**File**: `frontend/src/router/index.tsx`

- [ ] Add route for FamilyAccountDetailPage at `/app/:familyId/accounts/:accountId`

---

## Validation Commands

```bash
# Run frontend tests
cd frontend && npm run test:run

# Start dev server and manually test
cd frontend && npm run dev

# Run Storybook
cd frontend && npm run storybook

# Type check
cd frontend && npm run build
```

---

## Notes
- Reuse AG Grid patterns from Sprint 2 (AgTransactionsGrid)
- Follow existing hook patterns in `src/features/transactions/hooks/`
- Use `apiFetch` from `@/lib/apiClient` for all API calls
- Ensure all components have inline comments explaining "why"
