# Sprint 3: Accounts CRUD (1 week)

## Goal

Users can manage financial accounts (bank, credit card, cash). Reuses AG Grid pattern from Sprint 2. Account detail page shows transactions filtered by account.

## Success Criteria

- [x] Users can view list of accounts with balances
- [x] Users can create new account
- [x] Users can edit account details
- [x] Users can view account detail page with filtered transactions
- [x] Users can view all of their accounts inside the family
- [x] Users can view all of their accounts accross familes
- [x] Account select dropdowns work in transaction forms
- [x] Users can share accounts with families from account detail page
- [x] Users can remove account shares from account detail page
- [x] Users can view list of families an account is shared with

---

## Components Checklist

### Accounts Hooks

| Done | Hook                  | File Path                                              | Purpose                                 | Implementation Notes                                                                                                      |
| ---- | --------------------- | ------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [X]  | useAccounts           | `src/features/accounts/hooks/useAccounts.ts`           | Fetch accounts list                     | • Query key: `['accounts', familyId]`<br>• Call `GET /accounts`                                                           |
| [X]  | useAccount            | `src/features/accounts/hooks/useAccount.ts`            | Fetch single account                    | • Query key: `['account', familyId, accountId]`<br>• Call `GET /accounts/{id}`                                            |
| [X]  | useCreateAccount      | `src/features/accounts/hooks/useCreateAccount.ts`      | Create account mutation                 | • Call `POST /accounts`<br>• Invalidate `['accounts', familyId]`                                                          |
| [X]  | useUpdateAccount      | `src/features/accounts/hooks/useUpdateAccount.ts`      | Update account mutation                 | • Call `PATCH /accounts/{id}`<br>• Invalidate account queries                                                             |
| [X]  | useDeleteAccount      | `src/features/accounts/hooks/useDeleteAccount.ts`      | Delete account mutation                 | • Call `DELETE /accounts/{id}`<br>• Invalidate account list                                                               |
| [X]  | useAllAccounts        | `src/features/accounts/hooks/useAllAccounts.ts`        | Fetch all user's accounts (global view) | • Query key: `['accounts', 'all']`<br>• Call `GET /accounts` without tenant_id                                            |
| [X]  | useAccountShares      | `src/features/accounts/hooks/useAccountShares.ts`      | Fetch shares for an account             | • Query key: `['accountShares', accountId]`<br>• Call `GET /accounts/{accountId}/shares`<br>• Only account owner can view |
| [X]  | useCreateAccountShare | `src/features/accounts/hooks/useCreateAccountShare.ts` | Share account with a family             | • Call `POST /accounts/{accountId}/shares`<br>• Invalidate `['accountShares', accountId]`                                 |
| [X]  | useUpdateAccountShare | `src/features/accounts/hooks/useUpdateAccountShare.ts` | Update share visibility                 | • Call `PATCH /accounts/{accountId}/shares/{tenantId}`<br>• Invalidate account share queries                              |
| [X]  | useDeleteAccountShare | `src/features/accounts/hooks/useDeleteAccountShare.ts` | Remove account share                    | • Call `DELETE /accounts/{accountId}/shares/{tenantId}`<br>• Invalidate `['accountShares', accountId]`                    |

### API Functions

| Done | Function           | File Path                                       | Method | Endpoint                                    | Request              | Response             | Notes                                                                               |
| ---- | ------------------ | ----------------------------------------------- | ------ | ------------------------------------------- | -------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| [X]  | getAccounts        | `src/features/accounts/api/accountsApi.ts`      | GET    | `/accounts`                                 | -                    | `AccountRead[]`      | operationId: `list_accounts_accounts_get`                                           |
| [X]  | getAccount         | `src/features/accounts/api/accountsApi.ts`      | GET    | `/accounts/{account_id}`                    | -                    | `AccountRead`        | operationId: `get_account_accounts__account_id__get`                                |
| [X]  | createAccount      | `src/features/accounts/api/accountsApi.ts`      | POST   | `/accounts`                                 | `AccountCreate`      | `AccountRead`        | operationId: `create_account_accounts_post`                                         |
| [X]  | updateAccount      | `src/features/accounts/api/accountsApi.ts`      | PATCH  | `/accounts/{account_id}`                    | `AccountUpdate`      | `AccountRead`        | operationId: `update_account_accounts__account_id__patch`                           |
| [X]  | deleteAccount      | `src/features/accounts/api/accountsApi.ts`      | DELETE | `/accounts/{account_id}`                    | -                    | `204 No Content`     | operationId: `delete_account_accounts__account_id__delete`                          |
| [X]  | getAccountShares   | `src/features/accounts/api/accountSharesApi.ts` | GET    | `/accounts/{account_id}/shares`             | -                    | `AccountShareRead[]` | operationId: `get_account_shares_accounts__account_id__shares_get`                  |
| [X]  | createAccountShare | `src/features/accounts/api/accountSharesApi.ts` | POST   | `/accounts/{account_id}/shares`             | `AccountShareCreate` | `AccountShareRead`   | operationId: `create_account_share_accounts__account_id__shares_post`               |
| [X]  | updateAccountShare | `src/features/accounts/api/accountSharesApi.ts` | PATCH  | `/accounts/{account_id}/shares/{tenant_id}` | `AccountShareUpdate` | `AccountShareRead`   | operationId: `update_account_share_accounts__account_id__shares__tenant_id__patch`  |
| [X]  | deleteAccountShare | `src/features/accounts/api/accountSharesApi.ts` | DELETE | `/accounts/{account_id}/shares/{tenant_id}` | -                    | `204 No Content`     | operationId: `delete_account_share_accounts__account_id__shares__tenant_id__delete` |

**Type Reference (from OpenAPI):**

```typescript
interface AccountShareWith {
  tenant_id: string; // uuid - the tenant/family to share with
  visibility?: Visibility; // "full" | "masked" | "hidden" - default: "full"
}

interface AccountCreate {
  name: string;
  type: AccountType; // "cash" | "debit" | "credit"
  currency?: Currency; // Default: BRL
  balance?: number | string; // Decimal, default: 0
  share_with?: AccountShareWith; // Optional: if provided, atomically creates AccountShare
}

// NOTE: When share_with is provided in AccountCreate, the POST /accounts endpoint
// atomically creates both the Account and AccountShare in a single transaction.
// If share_with.tenant_id validation fails or AccountShare creation fails, the entire
// operation is rolled back

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

// Account Sharing Types
enum ShareVisibility {
    HIDDEN = "hidden"
    VISIBLE = "visible"
}

interface AccountShareCreate {
  tenant_id: string;           // uuid - family to share with
  visibility?: ShareVisibility; // default: "hidden"
}

interface AccountShareRead {
  id: string;                  // uuid
  account_id: string;          // uuid
  tenant_id: string;           // uuid - family the account is shared with
  visibility: ShareVisibility;
  granted_by: string;          // uuid - user who granted the share
  granted_at: string;          // datetime
}

interface AccountShareUpdate {
  visibility?: ShareVisibility | null;
}
```

### Domain Components (AG Grid)

| Done | Component      | File Path                                     | Props                   | Story                   | Notes                                                                                                                            |
| ---- | -------------- | --------------------------------------------- | ----------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [X]  | AgAccountsGrid | `src/components/domain/ag/AgAccountsGrid.tsx` | `familyId, onRowClick?` | `Domain/AgAccountsGrid` | • Column defs: name, type, currency, balance, actions<br>• Cell renderer for currency/balance<br>• Reuse AG Grid wrapper pattern |

### Feature Components (Accounts)

| Done | Component          | File Path                                                 | Props                                                      | Used In             | Notes                                                                                                                                                              |
| ---- | ------------------ | --------------------------------------------------------- | ---------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [X]  | AccountForm        | `src/features/accounts/components/AccountForm.tsx`        | `mode: 'create'\|'edit', initialData?, onSubmit, onCancel` | Add/Edit modal      | • Fields: name, type, currency, initial_balance<br>• Validation                                                                                                    |
| [X]  | AccountSummary     | `src/features/accounts/components/AccountSummary.tsx`     | `account`                                                  | Account detail page | • Show account info<br>• Balance, type, currency<br>• Edit button                                                                                                  |
| [X]  | AccountShareList   | `src/features/accounts/components/AccountShareList.tsx`   | `accountId, isOwner`                                       | Account detail page | • List families account is shared with<br>• Show visibility status (hidden/visible)<br>• Delete share button (owner only)<br>• Edit visibility button (owner only) |
| [X]  | ShareAccountDialog | `src/features/accounts/components/ShareAccountDialog.tsx` | `accountId, open, onClose`                                 | Account detail page | • Modal to share account with a family<br>• Family dropdown (user's other families)<br>• Visibility select (hidden/visible)<br>• Uses `useCreateAccountShare`      |
| [X]  | EditShareDialog    | `src/features/accounts/components/EditShareDialog.tsx`    | `accountId, share, open, onClose`                          | AccountShareList    | • Modal to edit share visibility<br>• Uses `useUpdateAccountShare`                                                                                                 |

### Pages

| Done | Page                    | File Path                                                 | Route                                | Protected | Dependencies                                                             | Notes                                                                                                                                                                                             |
| ---- | ----------------------- | --------------------------------------------------------- | ------------------------------------ | --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [X]  | AccountsPage            | `src/features/accounts/pages/AccountsPage.tsx`            | `/app/:familyId/accounts`            | Yes       | AgAccountsGrid, AccountCard                                              | Main accounts list                                                                                                                                                                                |
| [X]  | AllAccountsPage         | `src/features/accounts/pages/AllAccountsPage.tsx`         | `/app/accounts`                      | Yes       | AgAccountsGrid                                                           | Shows all user's accounts across families (global view)                                                                                                                                           |
| [X]  | FamilyAccountDetailPage | `src/features/accounts/pages/FamilyAccountDetailPage.tsx` | `/app/:familyId/accounts/:accountId` | Yes       | AccountSummary, AgTransactionsGrid, AccountShareList, ShareAccountDialog | Account detail + filtered transactions + sharing management. Transactions are filtered for both the family and account when inside the family. Sharing UI only visible to account owner.          |
| [X]  | GlobalAccountDetailPage | `src/features/accounts/pages/GlobalAccountDetailPage.tsx` | `/app/accounts/:accountId`           | Yes       | AccountSummary, AgTransactionsGrid, AccountShareList, ShareAccountDialog | Account detail + filtered transactions + sharing management. Transactions are filtered for account only. Accessible only from the global accounts page. Sharing UI only visible to account owner. |
| [X]  | AddAccountPage          | `src/features/accounts/pages/AddAccountPage.tsx`          | `/app/:familyId/accounts/new`        | Yes       | AccountForm                                                              | Modal/page for adding account within the family                                                                                                                                                   |
| [X]  | GlobalAddAccountPage    | `src/features/accounts/pages/AddAccountPage.tsx`          | `/app/accounts/new`                  | Yes       | AccountForm                                                              | Same modal page for adding accountbut without the family context passed. Add the component to a new route only                                                                                    |

### Testing

| Done | Test                     | File Path                                                     | Purpose                   | Notes                    |
| ---- | ------------------------ | ------------------------------------------------------------- | ------------------------- | ------------------------ |
| [X]  | useAccounts tests        | `src/features/accounts/__tests__/useAccounts.test.ts`         | Test hook logic           | Mock API                 |
| [X]  | AccountForm tests        | `src/features/accounts/__tests__/AccountForm.test.tsx`        | Test form validation      | Required fields          |
| [X]  | AgAccountsGrid tests     | `src/components/domain/ag/__tests__/AgAccountsGrid.test.tsx`  | Test grid rendering       | Mock data                |
| [ ]  | useAccountShares tests   | `src/features/accounts/__tests__/useAccountShares.test.ts`    | Test share hooks          | Mock API responses       |
| [ ]  | AccountShareList tests   | `src/features/accounts/__tests__/AccountShareList.test.tsx`   | Test share list rendering | Owner vs non-owner views |
| [ ]  | ShareAccountDialog tests | `src/features/accounts/__tests__/ShareAccountDialog.test.tsx` | Test share creation flow  | Form validation          |

---

## Implementation Milestones and Steps (Sprint 3)

IMPORTANT ORCHESTRATION NOTE: Ask for user to verify and confirm after each milestone before continuing!!!

### Milestone 0 - Backend

#### Step 0: Backend Enhancements

- [x] Add `tenant_id: Optional[UUID]` query parameter to `GET /accounts` endpoint
  - When provided: validate user membership, return only accounts shared with that tenant
  - When omitted: keep current behavior (all user's accounts + all shared)
- [x] Add `AccountShareWith` schema in `schemas.py`
  - Fields: tenant_id (required), visibility (optional, default: "full")
- [x] Update `AccountCreate` schema in `schemas.py`
  - Add optional `share_with: Optional[AccountShareWith]` field
- [x] Enhance existing `POST /accounts` endpoint in `accounts.py`
  - If `share_with` is provided:
    - Validate user is active member of specified tenant
    - Atomically create Account + AccountShare in single transaction
    - Rollback if either operation fails
  - If `share_with` is omitted: keep current behavior (create account only)
- [x] Expand `create_transaction` in `routers/transactions.py` to update account balance
  - After creating transaction: adjust `account.balance` based on transaction_type
  - Income: `account.balance += amount`
  - Expense: `account.balance -= amount`
  - Consider adding balance updates for update/delete operations as well
- [x] Add backend tests for enhanced endpoint behavior (with and without share_with)

### Milestone 1 - Accounts Page

#### Step 1: Accounts API & Hooks

- [x] Implement `accountsApi.ts` (CRUD functions)
- [x] Create React Query hooks: `useAccounts`, `useCreateAccount`, etc.
- [x] Define account types in `src/types/`

#### Step 2: AG Grid Wrapper

- [x] Create `AgAccountsGrid` component
- [x] Define column definitions (name, type, currency, balance, actions)
- [x] Add cell renderers (currency formatter, account type badge)
- [x] Integrate with `useAccounts` hook

#### Step 3: Account Form

- [x] Build `AccountForm` component
- [x] Add fields: name, account type select, currency select, initial balance
- [x] Add validation (name required, balance >= 0)

#### Step 4: Accounts Page

- [x] Create `AccountsPage` with grid or card layout
- [x] Add "Add Account" button
- [x] Add row/card click → navigate to detail page

#### Step 5: Account Detail Page

- [x] Create `AccountDetailPage`
- [x] Show `AccountSummary` component
- [x] Reuse `AgTransactionsGrid` with filter: `accountId`
- [x] Add edit and delete buttons

### Milestone 2 - CRUD

#### Step 6: Add/Edit Flow

- [x] Create nested route for `/new`
- [x] Wire up `useCreateAccount` and `useUpdateAccount`
- [x] Add success/error toasts

#### Step 7: Delete Flow

- [x] Add delete button in account detail
- [x] Show `DeleteConfirmDialog`
- [x] Wire up `useDeleteAccount`
- [x] Handle cascade (warn if account has transactions)

### Milestone 3 - Testing & Polish

#### Step 8: Testing & Polish

- [x] Test full CRUD flow
- [x] Test account detail page with filtered transactions
- [x] Add empty state (no accounts)
- [x] Update transaction form to use account select
  - **Note**: Replace placeholder comment in `src/features/transactions/components/TransactionForm.tsx` (lines 142-144) with dynamic account loading from `useAccounts` hook

### Milestone 4 - Global ✅ COMPLETE

#### Step 9: User Menu Enhancement

- [x] Add "See All Accounts" menu item to TopNav user menu (after email, before Logout)
- [x] Create `AllAccountsPage` component at `src/features/accounts/pages/AllAccountsPage.tsx`
- [x] Create `GlobalAccountDetailPage` component at `src/features/accounts/pages/GlobalAccountDetailPage.tsx`
- [x] Create `GlobalAddAccountPage` component at `src/features/accounts/pages/GlobalAddAccountPage.tsx`
- [x] Add Global accounts view routes in router (outside family context, protected)
  - `/app/accounts` (exact) → AllAccountsPage
  - `/app/accounts/new` → GlobalAddAccountPage
  - `/app/accounts/:accountId` → GlobalAccountDetailPage
  - **Route ordering:** All global routes defined BEFORE `/app/:familyId/*` to avoid conflicts
- [x] Update `useAccounts` hook to support optional familyId (already implemented - uses `['accounts', 'all']` query key when no familyId)
- [x] Update `useTransactions` hook to support optional familyId for global transaction views
- [x] TypeScript build validated - no errors

### Milestone 5 - Sharing

#### Step 10: Account Sharing Feature

- [x] Implement `accountSharesApi.ts` (CRUD functions for shares)
- [x] Create React Query hooks: `useAccountShares`, `useCreateAccountShare`, `useUpdateAccountShare`, `useDeleteAccountShare`
- [x] Create `AccountShareList` component
  - Display list of families the account is shared with
  - Show visibility status chip (hidden/visible)
  - Edit visibility button (opens EditShareDialog)
  - Delete share button with confirmation
  - Only render if user is account owner
- [x] Create `ShareAccountDialog` component
  - Family dropdown (fetch user's families via `useFamilies` hook, exclude current family if any, exclude families already shared with)
  - Visibility select (hidden/visible)
  - Submit calls `useCreateAccountShare`
- [x] Create `EditShareDialog` component
  - Visibility select only
  - Submit calls `useUpdateAccountShare`
- [x] Integrate into Account Detail Pages
  - Add "Share Account" button (owner only)
  - Add `AccountShareList` below AccountSummary (owner only)
  - Determine ownership by comparing `account.user_id` with current user id from auth context

#### Step 11: Account Sharing Testing

- [ ] Test `useAccountShares` hook (mock API responses)
- [ ] Test `AccountShareList` component (owner vs non-owner views)
- [ ] Test `ShareAccountDialog` component (form validation, family filtering)
- [ ] Test `EditShareDialog` component (visibility update)
- [ ] Test full sharing flow (share → view → edit visibility → remove)

---

## API Endpoints Reference (Sprint 3)

| Endpoint                                    | Method | operationId                                                            | Request              | Response             | Notes                                                          |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------- | -------------------- | -------------------- | -------------------------------------------------------------- |
| `/accounts`                                 | GET    | `list_accounts_accounts_get`                                           | -                    | `AccountRead[]`      | List accounts for family                                       |
| `/accounts/{account_id}`                    | GET    | `get_account_accounts__account_id__get`                                | -                    | `AccountRead`        | Get single account                                             |
| `/accounts`                                 | POST   | `create_account_accounts_post`                                         | `AccountCreate`      | `AccountRead`        | Create account (optionally with share_with for atomic sharing) |
| `/accounts/{account_id}`                    | PATCH  | `update_account_accounts__account_id__patch`                           | `AccountUpdate`      | `AccountRead`        | Update account                                                 |
| `/accounts/{account_id}`                    | DELETE | `delete_account_accounts__account_id__delete`                          | -                    | `204 No Content`     | Delete account                                                 |
| `/accounts/{account_id}/shares`             | GET    | `get_account_shares_accounts__account_id__shares_get`                  | -                    | `AccountShareRead[]` | List shares (owner only)                                       |
| `/accounts/{account_id}/shares`             | POST   | `create_account_share_accounts__account_id__shares_post`               | `AccountShareCreate` | `AccountShareRead`   | Share account with family                                      |
| `/accounts/{account_id}/shares/{tenant_id}` | PATCH  | `update_account_share_accounts__account_id__shares__tenant_id__patch`  | `AccountShareUpdate` | `AccountShareRead`   | Update share visibility                                        |
| `/accounts/{account_id}/shares/{tenant_id}` | DELETE | `delete_account_share_accounts__account_id__shares__tenant_id__delete` | -                    | `204 No Content`     | Remove share                                                   |

---

## Notes & Assumptions

- **Balance storage:** Account balance is stored in the `balance` column and updated incrementally when transactions are created/modified/deleted (not calculated on-the-fly)
- **Initial balance:** Creates an opening balance transaction if non-zero
- **Cascade delete:** Backend should prevent deleting account with transactions (or soft delete)
- **Account select:** Now available for transaction form from Sprint 2
- **Family-scoped accounts:** AccountsPage at `/app/:familyId/accounts` ONLY shows accounts shared with that family (passes `tenant_id` query param to `GET /accounts`)
- **Global accounts view:** "See All Accounts" from user menu shows all user's accounts (no `tenant_id` filter)
- **Create from family:** When creating account from within a family context, use `POST /accounts` with `share_with: { tenant_id, visibility }` to atomically create account + share with rollback on error
- **Account sharing:** Only account owner can view/manage shares. Visibility options: "hidden" (balance not visible to family members) or "visible" (balance visible). Shares link an account to a tenant/family.
- **Share management UI:** Account detail pages show sharing section only to account owner (compare `account.user_id` with authenticated user's id)
