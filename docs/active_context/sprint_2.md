## 6. Sprint 2: Transactions CRUD (1 week)

### Goal

Users can view, create, edit, and delete transactions. First full CRUD feature with AG Grid table. Establishes patterns for forms, tables, and mutations.

### Success Criteria

- [x] Users can view list of transactions in AG Grid table
- [x] Users can filter transactions by date, category, account - AG Grid feature
- [x] Users can create new transaction via modal form
- [x] Users can edit existing transaction
- [x] Users can delete transaction (with confirmation)
- [x] AG Grid wrapper created for reuse in other features

---

### Components Checklist

#### Transactions Hooks

| Done | Hook                 | File Path                                                 | Purpose                     | Implementation Notes                                                                                                         |
| ---- | -------------------- | --------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [x]  | useTransactions      | `src/features/transactions/hooks/useTransactions.ts`      | Fetch transactions list     | • Query key: `['transactions', familyId, filters]`<br>• Call `GET /transactions`<br>• Support pagination, sorting, filtering |
| [x]  | useTransaction       | `src/features/transactions/hooks/useTransaction.ts`       | Fetch single transaction    | • Query key: `['transaction', familyId, transactionId]`<br>• Call `GET /transactions/{id}`                                   |
| [x]  | useCreateTransaction | `src/features/transactions/hooks/useCreateTransaction.ts` | Create transaction mutation | • Call `POST /transactions`<br>• Invalidate `['transactions', familyId]`                                                     |
| [x]  | useUpdateTransaction | `src/features/transactions/hooks/useUpdateTransaction.ts` | Update transaction mutation | • Call `PUT /transactions/{id}`<br>• Invalidate transaction queries                                                          |
| [x]  | useDeleteTransaction | `src/features/transactions/hooks/useDeleteTransaction.ts` | Delete transaction mutation | • Call `DELETE /transactions/{id}`<br>• Invalidate transaction list                                                          |

#### API Functions

| Done | Function          | File Path                                          | Method | Endpoint                         | Request               | Response            | Notes                                                                  |
| ---- | ----------------- | -------------------------------------------------- | ------ | -------------------------------- | --------------------- | ------------------- | ---------------------------------------------------------------------- |
| [x]  | getTransactions   | `src/features/transactions/api/transactionsApi.ts` | GET    | `/transactions`                  | Query params: filters | `TransactionRead[]` | operationId: `list_transactions_transactions_get`                      |
| [x]  | getTransaction    | `src/features/transactions/api/transactionsApi.ts` | GET    | `/transactions/{transaction_id}` | -                     | `TransactionRead`   | operationId: `get_transaction_transactions__transaction_id__get`       |
| [x]  | createTransaction | `src/features/transactions/api/transactionsApi.ts` | POST   | `/transactions`                  | `TransactionCreate`   | `TransactionRead`   | operationId: `create_transaction_transactions_post`                    |
| [x]  | updateTransaction | `src/features/transactions/api/transactionsApi.ts` | PUT    | `/transactions/{transaction_id}` | `TransactionUpdate`   | `TransactionRead`   | operationId: `update_transaction_transactions__transaction_id__put`    |
| [x]  | deleteTransaction | `src/features/transactions/api/transactionsApi.ts` | DELETE | `/transactions/{transaction_id}` | -                     | `{ok: true}`        | operationId: `delete_transaction_transactions__transaction_id__delete` |

**Type Reference (from OpenAPI):**

```typescript
interface TransactionCreate {
  account_id: string; // uuid
  category_id?: string | null; // uuid
  amount: number | string; // Decimal
  currency?: Currency; // enum
  transaction_date: string; // date
  transaction_type: CategoryKind; // "expense" | "income"
  description?: string | null;
  source?: TransactionSource; // "manual" | "recurring"
}

interface TransactionRead {
  id: string; // uuid
  tenant_id: string;
  account_id: string;
  account_name: string;
  category_id: string | null;
  category_name: string | null;
  amount: string; // Decimal as string
  currency: Currency;
  transaction_date: string; // date
  transaction_type: CategoryKind;
  description: string | null;
  created_by: string; // uuid
  created_at: string; // datetime
  updated_at: string; // datetime
  reconciled: boolean;
  source: TransactionSource;
}

interface TransactionUpdate {
  category_id?: string | null;
  amount?: number | string | null;
  currency?: Currency | null;
  transaction_date?: string | null;
  transaction_type?: CategoryKind | null;
  description?: string | null;
  reconciled?: boolean | null;
}

enum CategoryKind {
  EXPENSE = "expense",
  INCOME = "income",
}

enum TransactionSource {
  MANUAL = "manual",
  RECURRING = "recurring",
}

enum Currency {
  USD = "USD",
  BRL = "BRL",
  EUR = "EUR",
  // ... other currencies
}
```

#### Domain Components (AG Grid)

| Done | Component          | File Path                                         | Props                                                 | Story                       | Notes                                                                                                                                                                                                      |
| ---- | ------------------ | ------------------------------------------------- | ----------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [x]  | AgTransactionsGrid | `src/components/domain/ag/AgTransactionsGrid.tsx` | `familyId, filters?, onRowClick?, onSelectionChange?` | `Domain/AgTransactionsGrid` | • Thin wrapper around AG Grid<br>• Column defs for transactions<br>• Server-side row model (optional)<br>• Integrate with `useTransactions` hook<br>• Custom cell renderers: date, currency, category chip |

#### Feature Components (Transactions)

| Done | Component           | File Path                                                  | Props                                                      | Used In                      | Notes                                                                                                      |
| ---- | ------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [x]  | TransactionForm     | `src/features/transactions/components/TransactionForm.tsx` | `mode: 'create'\|'edit', initialData?, onSubmit, onCancel` | Add/Edit modal               | • Form fields: account, category, amount, date, type, description<br>• Validation<br>• Uses MUI components |
| [x]  | BulkActions         | `src/features/transactions/components/BulkActions.tsx`     | `selectedIds, onDelete, onExport`                          | Transactions page            | • Delete selected<br>• Export to CSV                                                                       |
| [x]  | DeleteConfirmDialog | `src/components/ui/molecules/DeleteConfirmDialog.tsx`      | `open, title, message, onConfirm, onCancel`                | Transactions, other features | Reusable confirmation dialog                                                                               |

#### UI Components (Molecules - Additional)

| Done | Component       | File Path                                         | Props                           | Story                       | Notes                                   |
| ---- | --------------- | ------------------------------------------------- | ------------------------------- | --------------------------- | --------------------------------------- |
| [x]  | DateRangePicker | `src/components/ui/molecules/DateRangePicker.tsx` | `startDate, endDate, onChange`  | `Molecules/DateRangePicker` | MUI DatePicker wrapper for ranges       |
| [x]  | SearchInput     | `src/components/ui/molecules/SearchInput.tsx`     | `value, onChange, placeholder?` | `Molecules/SearchInput`     | Input with search icon and clear button |

#### UI Components (Atoms - Additional)

| Done | Component | File Path                           | Props                      | Story         | Notes                                |
| ---- | --------- | ----------------------------------- | -------------------------- | ------------- | ------------------------------------ |
| [x]  | Chip      | `src/components/ui/atoms/Chip.tsx`  | `label, color?, onDelete?` | `Atoms/Chip`  | MUI Chip wrapper for categories/tags |
| [x]  | Badge     | `src/components/ui/atoms/Badge.tsx` | `label, variant?`          | `Atoms/Badge` | Small badge for counts               |

#### Pages

| Done | Page                  | File Path                                                   | Route                                        | Protected | Dependencies                  | Notes                             |
| ---- | --------------------- | ----------------------------------------------------------- | -------------------------------------------- | --------- | ----------------------------- | --------------------------------- |
| [x]  | TransactionsPage      | `src/features/transactions/pages/TransactionsPage.tsx`      | `/app/:familyId/transactions`                | Yes       | AgTransactionsGrid, FilterBar | Main transactions list            |
| [x]  | AddTransactionPage    | `src/features/transactions/pages/AddTransactionPage.tsx`    | `/app/:familyId/transactions/new`            | Yes       | TransactionForm               | Modal/page for adding transaction |
| [x]  | TransactionDetailPage | `src/features/transactions/pages/TransactionDetailPage.tsx` | `/app/:familyId/transactions/:transactionId` | Yes       | TransactionForm               | View/edit transaction details     |

#### Testing

| Done | Test                     | File Path                                                        | Purpose              | Notes                     |
| ---- | ------------------------ | ---------------------------------------------------------------- | -------------------- | ------------------------- |
| [x]  | useTransactions tests    | `src/features/transactions/__tests__/useTransactions.test.ts`    | Test hook logic      | Mock API, test query keys |
| [x]  | TransactionForm tests    | `src/features/transactions/__tests__/TransactionForm.test.tsx`   | Test form validation | Test required fields      |
| [x]  | AgTransactionsGrid tests | `src/components/domain/ag/__tests__/AgTransactionsGrid.test.tsx` | Test grid rendering  | Mock data                 |

---

### Implementation Steps (Sprint 2)

#### Step 1: Install AG Grid

- [x] Add AG Grid dependencies: `ag-grid-community`, `ag-grid-react`
- [x] Import AG Grid styles in `index.css`

#### Step 2: Transactions API & Hooks

- [x] Implement `transactionsApi.ts` (CRUD functions)
- [x] Create React Query hooks: `useTransactions`, `useCreateTransaction`, etc.
- [x] Define transaction types in `src/types/`

#### Step 3: AG Grid Wrapper

- [x] Create `AgTransactionsGrid` component
- [x] Define column definitions (date, account, category, amount, type, actions)
- [x] Add custom cell renderers (currency formatter, date formatter, category chip)
- [x] Integrate with `useTransactions` hook
- [x] Support sorting and filtering

#### Step 4: Transaction Form

- [x] Build `TransactionForm` component
- [x] Add fields: account select, category select, amount input, date picker, type radio, description textarea
- [x] Add validation (required fields, amount > 0)
- [x] Handle create and edit modes

#### Step 5: Transactions Page

- [x] Create `TransactionsPage` with layout
- [x] Add `TransactionsFilterBar` component
- [x] Integrate `AgTransactionsGrid`
- [x] Add "Add Transaction" button → opens modal/nested route
- [x] Add row click → navigate to detail page

#### Step 6: Add/Edit Flow

- [x] Create nested route for `/new` (modal over list)
- [x] Create `TransactionDetailPage` for editing
- [x] Wire up `useCreateTransaction` and `useUpdateTransaction`
- [x] Add success/error toasts

#### Step 7: Delete Flow

- [x] Add delete action in grid (actions column)
- [x] Create `DeleteConfirmDialog` component
- [x] Wire up `useDeleteTransaction`
- [x] Add bulk delete with `BulkActions` component

#### Step 8: Testing & Polish

- [x] Test full CRUD flow
- [x] Test filters (date range, category, account)
- [x] Test AG Grid sorting and pagination
- [x] Add loading states
- [x] Add empty state (no transactions)

---

### API Endpoints Reference (Sprint 2)

| Endpoint                         | Method | operationId                                               | Request               | Response            | Notes                          |
| -------------------------------- | ------ | --------------------------------------------------------- | --------------------- | ------------------- | ------------------------------ |
| `/transactions`                  | GET    | `list_transactions_transactions_get`                      | Query params: filters | `TransactionRead[]` | List transactions with filters |
| `/transactions/{transaction_id}` | GET    | `get_transaction_transactions__transaction_id__get`       | -                     | `TransactionRead`   | Get single transaction         |
| `/transactions`                  | POST   | `create_transaction_transactions_post`                    | `TransactionCreate`   | `TransactionRead`   | Create new transaction         |
| `/transactions/{transaction_id}` | PUT    | `update_transaction_transactions__transaction_id__put`    | `TransactionUpdate`   | `TransactionRead`   | Update transaction             |
| `/transactions/{transaction_id}` | DELETE | `delete_transaction_transactions__transaction_id__delete` | -                     | `{ok: true}`        | Delete transaction             |

---

### Notes & Assumptions

- **AG Grid:** Use community edition (free). Enterprise features not needed for MVP.
- **Server-side vs client-side:** Start with client-side row model (fetch all, filter/sort in browser). Add server-side if performance issues with 1000+ transactions.
- **Category select:** Fetch categories via separate hook (implement in Sprint 4 or use placeholder)
- **Account select:** Fetch accounts via separate hook (implement in Sprint 3 or use placeholder)
- **Currency:** Default to BRL, make selectable if multi-currency needed
- **Validation:** Use browser validation + manual checks. Consider react-hook-form or formik if forms get complex.
