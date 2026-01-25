# Sprint 3: Accounts CRUD (1 week)

## Goal
Users can manage financial accounts (bank, credit card, cash). Reuses AG Grid pattern from Sprint 2. Account detail page shows transactions filtered by account.

## Success Criteria
- [ ] Users can view list of accounts with balances
- [ ] Users can create new account
- [ ] Users can edit account details
- [ ] Users can view account detail page with filtered transactions
- [ ] Users can view all of their accounts inside the family
- [ ] Users can view all of their accounts accross familes 
- [ ] Account select dropdowns work in transaction forms

---

## Components Checklist

### Accounts Hooks

| Done | Hook | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | useAccounts | `src/features/accounts/hooks/useAccounts.ts` | Fetch accounts list | • Query key: `['accounts', familyId]`<br>• Call `GET /accounts` |
| [ ] | useAccount | `src/features/accounts/hooks/useAccount.ts` | Fetch single account | • Query key: `['account', familyId, accountId]`<br>• Call `GET /accounts/{id}` |
| [ ] | useCreateAccount | `src/features/accounts/hooks/useCreateAccount.ts` | Create account mutation | • Call `POST /accounts`<br>• Invalidate `['accounts', familyId]` |
| [ ] | useUpdateAccount | `src/features/accounts/hooks/useUpdateAccount.ts` | Update account mutation | • Call `PATCH /accounts/{id}`<br>• Invalidate account queries |
| [ ] | useDeleteAccount | `src/features/accounts/hooks/useDeleteAccount.ts` | Delete account mutation | • Call `DELETE /accounts/{id}`<br>• Invalidate account list |
| [ ] | useAllAccounts | `src/features/accounts/hooks/useAllAccounts.ts` | Fetch all user's accounts (global view) | • Query key: `['accounts', 'all']`<br>• Call `GET /accounts` without tenant_id |

### API Functions

| Done | Function | File Path | Method | Endpoint | Request | Response | Notes |
|------|----------|-----------|--------|----------|---------|----------|-------|
| [ ] | getAccounts | `src/features/accounts/api/accountsApi.ts` | GET | `/accounts` | - | `AccountRead[]` | operationId: `list_accounts_accounts_get` |
| [ ] | getAccount | `src/features/accounts/api/accountsApi.ts` | GET | `/accounts/{account_id}` | - | `AccountRead` | operationId: `get_account_accounts__account_id__get` |
| [ ] | createAccount | `src/features/accounts/api/accountsApi.ts` | POST | `/accounts` | `AccountCreate` | `AccountRead` | operationId: `create_account_accounts_post` |
| [ ] | updateAccount | `src/features/accounts/api/accountsApi.ts` | PATCH | `/accounts/{account_id}` | `AccountUpdate` | `AccountRead` | operationId: `update_account_accounts__account_id__patch` |
| [ ] | deleteAccount | `src/features/accounts/api/accountsApi.ts` | DELETE | `/accounts/{account_id}` | - | `204 No Content` | operationId: `delete_account_accounts__account_id__delete` |

**Type Reference (from OpenAPI):**
```typescript
interface AccountCreate {
  name: string;
  type: AccountType; // "cash" | "debit" | "credit"
  currency?: Currency; // Default: BRL
  balance?: number | string; // Decimal, default: 0
}

//IMPORTANT NOTE: The step 0 will add AccountCreateWithShare to the schema. The AccountCreateWithShare should be used when creating the accounts from within a family scope

interface AccountRead {
  id: string;           // uuid
  user_id: string;      // uuid - account owner
  user_name: string;    // owner's display name
  name: string;
  type: AccountType;    // "cash" | "debit" | "credit"
  currency: Currency;
  balance: string | null; // Decimal as string, may be null/masked based on visibility
  created_at: string;   // datetime
  updated_at: string;   // datetime
}

interface AccountUpdate {
  name?: string | null;
  type?: AccountType | null;
  currency?: Currency | null;
  balance?: number | string | null;
}

enum AccountType {
    CASH = "cash"
    DEBIT = "debit"
    CREDIT = "credit"
}
```

### Domain Components (AG Grid)

| Done | Component | File Path | Props | Story | Notes |
|------|-----------|-----------|-------|-------|-------|
| [ ] | AgAccountsGrid | `src/components/domain/ag/AgAccountsGrid.tsx` | `familyId, onRowClick?` | `Domain/AgAccountsGrid` | • Column defs: name, type, currency, balance, actions<br>• Cell renderer for currency/balance<br>• Reuse AG Grid wrapper pattern |

### Feature Components (Accounts)

| Done | Component | File Path | Props | Used In | Notes |
|------|-----------|-----------|-------|---------|-------|
| [ ] | AccountForm | `src/features/accounts/components/AccountForm.tsx` | `mode: 'create'\|'edit', initialData?, onSubmit, onCancel` | Add/Edit modal | • Fields: name, type, currency, initial_balance<br>• Validation |
| [ ] | AccountSummary | `src/features/accounts/components/AccountSummary.tsx` | `account` | Account detail page | • Show account info<br>• Balance, type, currency<br>• Edit button |

### Pages

| Done | Page | File Path | Route | Protected | Dependencies | Notes |
|------|------|-----------|-------|-----------|--------------|-------|
| [ ] | AccountsPage | `src/features/accounts/pages/AccountsPage.tsx` | `/app/:familyId/accounts` | Yes | AgAccountsGrid, AccountCard | Main accounts list |
| [ ] | AllAccountsPage | `src/features/accounts/pages/AllAccountsPage.tsx` | `/app/accounts` | Yes | AgAccountsGrid | Shows all user's accounts across families (global view) |
| [ ] | FamilyAccountDetailPage | `src/features/accounts/pages/FamilyAccountDetailPage.tsx` | `/app/:familyId/accounts/:accountId` | Yes | AccountSummary, AgTransactionsGrid | Account detail + filtered transactions. Transactions are filtered for both the family and account when inside the family. |
| [ ] | GlobalAccountDetailPage | `src/features/accounts/pages/GlobalAccountDetailPage.tsx` | `/app/accounts/:accountId` | Yes | AccountSummary, AgTransactionsGrid | Account detail + filtered transactions. Transactions are filtered for account only. Accessible only from the global accounts page. Same page as the Family scoped poage, only filter is different|
| [ ] | AddAccountPage | `src/features/accounts/pages/AddAccountPage.tsx` | `/app/:familyId/accounts/new` | Yes | AccountForm | Modal/page for adding account |

### Testing

| Done | Test | File Path | Purpose | Notes |
|------|------|-----------|---------|-------|
| [ ] | useAccounts tests | `src/features/accounts/__tests__/useAccounts.test.ts` | Test hook logic | Mock API |
| [ ] | AccountForm tests | `src/features/accounts/__tests__/AccountForm.test.tsx` | Test form validation | Required fields |
| [ ] | AgAccountsGrid tests | `src/components/domain/ag/__tests__/AgAccountsGrid.test.tsx` | Test grid rendering | Mock data |

---

## Implementation Steps (Sprint 3)

### Step 0: Backend Enhancements
- [ ] Add `tenant_id: Optional[UUID]` query parameter to `GET /accounts` endpoint
  - When provided: validate user membership, return only accounts shared with that tenant
  - When omitted: keep current behavior (all user's accounts + all shared)
- [ ] Create `AccountCreateWithShare` schema in `schemas.py`
  - Fields: name, type, currency, balance, tenant_id, visibility
- [ ] Create `POST /accounts/with-share` endpoint in `accounts.py`
  - Atomically creates Account + AccountShare in single transaction
  - Rollback if either operation fails
  - Validates user is active member of specified tenant
- [ ] Expand `create_transaction` in `routers/transactions.py` to update account balance
  - After creating transaction: adjust `account.balance` based on transaction_type
  - Income: `account.balance += amount`
  - Expense: `account.balance -= amount`
  - Consider adding balance updates for update/delete operations as well
- [ ] Add backend tests for new endpoint and parameter behavior

### Step 1: Accounts API & Hooks
- [ ] Implement `accountsApi.ts` (CRUD functions)
- [ ] Create React Query hooks: `useAccounts`, `useCreateAccount`, etc.
- [ ] Define account types in `src/types/`

### Step 2: AG Grid Wrapper
- [ ] Create `AgAccountsGrid` component
- [ ] Define column definitions (name, type, currency, balance, actions)
- [ ] Add cell renderers (currency formatter, account type badge)
- [ ] Integrate with `useAccounts` hook

### Step 3: Account Form
- [ ] Build `AccountForm` component
- [ ] Add fields: name, account type select, currency select, initial balance
- [ ] Add validation (name required, balance >= 0)

### Step 4: Accounts Page
- [ ] Create `AccountsPage` with grid or card layout
- [ ] Add "Add Account" button
- [ ] Add row/card click → navigate to detail page

### Step 5: Account Detail Page
- [ ] Create `AccountDetailPage`
- [ ] Show `AccountSummary` component
- [ ] Reuse `AgTransactionsGrid` with filter: `accountId`
- [ ] Add edit and delete buttons

### Step 6: Add/Edit Flow
- [ ] Create nested route for `/new`
- [ ] Wire up `useCreateAccount` and `useUpdateAccount`
- [ ] Add success/error toasts

### Step 7: Delete Flow
- [ ] Add delete button in account detail
- [ ] Show `DeleteConfirmDialog`
- [ ] Wire up `useDeleteAccount`
- [ ] Handle cascade (warn if account has transactions)

### Step 8: Testing & Polish
- [ ] Test full CRUD flow
- [ ] Test account detail page with filtered transactions
- [ ] Add empty state (no accounts)
- [ ] Update transaction form to use account select
  - **Note**: Replace placeholder comment in `src/features/transactions/components/TransactionForm.tsx` (lines 142-144) with dynamic account loading from `useAccounts` hook

### Step 9: User Menu Enhancement
- [ ] Add "See All Accounts" menu item to TopNav user menu (after email, before Logout)
- [ ] Create `AllAccountsPage` component at `src/features/accounts/pages/AllAccountsPage.tsx`
- [ ] Add Global accounts view route `/app/accounts` in router (outside family context, protected)
  - **Route ordering:** `/app/accounts` (exact) must be defined BEFORE `/app/accounts/:accountId` (parameterized) to avoid conflicts
- [ ] Implement `useAllAccounts` hook (calls `GET /accounts` without `tenant_id` param)

---

## API Endpoints Reference (Sprint 3)

| Endpoint | Method | operationId | Request | Response | Notes |
|----------|--------|-------------|---------|----------|-------|
| `/accounts` | GET | `list_accounts_accounts_get` | - | `AccountRead[]` | List accounts for family |
| `/accounts/{account_id}` | GET | `get_account_accounts__account_id__get` | - | `AccountRead` | Get single account |
| `/accounts` | POST | `create_account_accounts_post` | `AccountCreate` | `AccountRead` | Create new account |
| `/accounts/{account_id}` | PATCH | `update_account_accounts__account_id__patch` | `AccountUpdate` | `AccountRead` | Update account |
| `/accounts/{account_id}` | DELETE | `delete_account_accounts__account_id__delete` | - | `204 No Content` | Delete account |
| `/accounts/with-share` | POST | `create_account_with_share_accounts_with_share_post` | `AccountCreateWithShare` | `AccountRead` | Atomic create + share (Step 0) |

---

## Notes & Assumptions

- **Balance storage:** Account balance is stored in the `balance` column and updated incrementally when transactions are created/modified/deleted (not calculated on-the-fly)
- **Initial balance:** Creates an opening balance transaction if non-zero
- **Cascade delete:** Backend should prevent deleting account with transactions (or soft delete)
- **Account select:** Now available for transaction form from Sprint 2
- **Family-scoped accounts:** AccountsPage at `/app/:familyId/accounts` ONLY shows accounts shared with that family (passes `tenant_id` query param to `GET /accounts`)
- **Global accounts view:** "See All Accounts" from user menu shows all user's accounts (no `tenant_id` filter)
- **Create from family:** When creating account from within a family context, use `POST /accounts/with-share` to atomically create account + share with rollback on error
