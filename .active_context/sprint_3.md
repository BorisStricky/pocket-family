# Sprint 3: Accounts CRUD (1 week)

## Goal
Users can manage financial accounts (bank, credit card, cash). Reuses AG Grid pattern from Sprint 2. Account detail page shows transactions filtered by account.

## Success Criteria
- [ ] Users can view list of accounts with balances
- [ ] Users can create new account
- [ ] Users can edit account details
- [ ] Users can view account detail page with filtered transactions
- [ ] Account select dropdowns work in transaction forms

---

## Components Checklist

### Accounts Hooks

| Done | Hook | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | useAccounts | `src/features/accounts/hooks/useAccounts.ts` | Fetch accounts list | • Query key: `['accounts', familyId]`<br>• Call `GET /accounts` |
| [ ] | useAccount | `src/features/accounts/hooks/useAccount.ts` | Fetch single account | • Query key: `['account', familyId, accountId]`<br>• Call `GET /accounts/{id}` |
| [ ] | useCreateAccount | `src/features/accounts/hooks/useCreateAccount.ts` | Create account mutation | • Call `POST /accounts`<br>• Invalidate `['accounts', familyId]` |
| [ ] | useUpdateAccount | `src/features/accounts/hooks/useUpdateAccount.ts` | Update account mutation | • Call `PUT /accounts/{id}`<br>• Invalidate account queries |
| [ ] | useDeleteAccount | `src/features/accounts/hooks/useDeleteAccount.ts` | Delete account mutation | • Call `DELETE /accounts/{id}`<br>• Invalidate account list |

### API Functions

| Done | Function | File Path | Method | Endpoint | Request | Response | Notes |
|------|----------|-----------|--------|----------|---------|----------|-------|
| [ ] | getAccounts | `src/features/accounts/api/accountsApi.ts` | GET | `/accounts` | - | `AccountRead[]` | operationId: `list_accounts_accounts_get` |
| [ ] | getAccount | `src/features/accounts/api/accountsApi.ts` | GET | `/accounts/{account_id}` | - | `AccountRead` | operationId: `get_account_accounts__account_id__get` |
| [ ] | createAccount | `src/features/accounts/api/accountsApi.ts` | POST | `/accounts` | `AccountCreate` | `AccountRead` | operationId: `create_account_accounts_post` |
| [ ] | updateAccount | `src/features/accounts/api/accountsApi.ts` | PUT | `/accounts/{account_id}` | `AccountUpdate` | `AccountRead` | operationId: `update_account_accounts__account_id__put` |
| [ ] | deleteAccount | `src/features/accounts/api/accountsApi.ts` | DELETE | `/accounts/{account_id}` | - | `{ok: true}` | operationId: `delete_account_accounts__account_id__delete` |

**Type Reference (from OpenAPI):**
```typescript
interface AccountCreate {
  name: string;
  account_type: AccountType; // "checking" | "savings" | "credit_card" | "cash" | "investment"
  currency?: Currency; // Default: BRL
  initial_balance?: number | string; // Decimal, default: 0
}

interface AccountRead {
  id: string; // uuid
  tenant_id: string;
  name: string;
  account_type: AccountType;
  currency: Currency;
  balance: string; // Decimal as string
  created_at: string; // datetime
  updated_at: string; // datetime
}

interface AccountUpdate {
  name?: string | null;
  account_type?: AccountType | null;
  currency?: Currency | null;
}

enum AccountType {
  CHECKING = "checking",
  SAVINGS = "savings",
  CREDIT_CARD = "credit_card",
  CASH = "cash",
  INVESTMENT = "investment"
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
| [ ] | AccountCard | `src/features/accounts/components/AccountCard.tsx` | `account` | Accounts page | • Display account summary<br>• Card format with balance<br>• Click → navigate to detail |
| [ ] | AccountSummary | `src/features/accounts/components/AccountSummary.tsx` | `account` | Account detail page | • Show account info<br>• Balance, type, currency<br>• Edit button |

### Pages

| Done | Page | File Path | Route | Protected | Dependencies | Notes |
|------|------|-----------|-------|-----------|--------------|-------|
| [ ] | AccountsPage | `src/features/accounts/pages/AccountsPage.tsx` | `/app/:familyId/accounts` | Yes | AgAccountsGrid, AccountCard | Main accounts list |
| [ ] | AccountDetailPage | `src/features/accounts/pages/AccountDetailPage.tsx` | `/app/:familyId/accounts/:accountId` | Yes | AccountSummary, AgTransactionsGrid | Account detail + filtered transactions |
| [ ] | AddAccountPage | `src/features/accounts/pages/AddAccountPage.tsx` | `/app/:familyId/accounts/new` | Yes | AccountForm | Modal/page for adding account |

### Testing

| Done | Test | File Path | Purpose | Notes |
|------|------|-----------|---------|-------|
| [ ] | useAccounts tests | `src/features/accounts/__tests__/useAccounts.test.ts` | Test hook logic | Mock API |
| [ ] | AccountForm tests | `src/features/accounts/__tests__/AccountForm.test.tsx` | Test form validation | Required fields |
| [ ] | AgAccountsGrid tests | `src/components/domain/ag/__tests__/AgAccountsGrid.test.tsx` | Test grid rendering | Mock data |

---

## Implementation Steps (Sprint 3)

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

---

## API Endpoints Reference (Sprint 3)

| Endpoint | Method | operationId | Request | Response | Notes |
|----------|--------|-------------|---------|----------|-------|
| `/accounts` | GET | `list_accounts_accounts_get` | - | `AccountRead[]` | List accounts for family |
| `/accounts/{account_id}` | GET | `get_account_accounts__account_id__get` | - | `AccountRead` | Get single account |
| `/accounts` | POST | `create_account_accounts_post` | `AccountCreate` | `AccountRead` | Create new account |
| `/accounts/{account_id}` | PUT | `update_account_accounts__account_id__put` | `AccountUpdate` | `AccountRead` | Update account |
| `/accounts/{account_id}` | DELETE | `delete_account_accounts__account_id__delete` | - | `{ok: true}` | Delete account |

---

## Notes & Assumptions

- **Balance calculation:** Backend calculates balance based on transactions
- **Initial balance:** Creates an opening balance transaction if non-zero
- **Cascade delete:** Backend should prevent deleting account with transactions (or soft delete)
- **Account select:** Now available for transaction form from Sprint 2
