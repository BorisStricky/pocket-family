# Plan: Inline "Create New" for Category and Account Selectors

## Context

When a user is adding a transaction (or assigning categories during CSV import) and can't find a desired category or account in the dropdown, they previously had to close the modal, navigate elsewhere to create the item, then return and restart — losing all in-progress context. This feature introduces an inline "create new" flow: a quick-create option appears inside each selector, opens the relevant add modal on top of the current form without losing any state, and auto-selects the newly created item when done.

---

## Recommended UX

### Category selector (MUI Autocomplete in `CategorySelect`)

The Autocomplete's `filterOptions` injects a synthetic `__CREATE_NEW__` sentinel at the **bottom** of the option list, always visible. When the user has typed a search term, the option reads **"Create '[typed text]' as new category"** so the typed text pre-fills the name field. This is the standard pattern used by Notion, Linear, GitHub labels, etc.

- The sentinel is styled distinctively: a top border (separator), `Plus` icon, and primary-color text.
- Selecting it calls an `onCreateNew?(inputText?: string)` callback instead of setting a value.
- The AddCategoryModal is pre-filled with:
  - **Name**: the text the user was searching (if any).
  - **Kind**: the current transaction type (expense/income), so the user doesn't need to change it.

### Account selector (MUI Select)

A **Divider + "Create new account" MenuItem** (with `Plus` icon) is appended to the existing MUI Select. When selected, instead of changing the field value, it opens AddAccountModal. This keeps the UX consistent (affordance inside the dropdown) without upgrading the Select to an Autocomplete.

### Stacked dialogs

MUI manages z-index for stacked Dialogs automatically — each new Dialog renders above the previous one. No manual z-index overrides are needed. The underlying form stays mounted and fully preserved.

---

## Implementation (as built)

### 1. `frontend/src/components/domain/CategorySelect.tsx`

- Added optional `onCreateNew?: (inputText?: string) => void` prop.
- Defined a module-level `CREATE_NEW_ID = '__CREATE_NEW__'` and a `createNewSentinel` object satisfying the `CategoryRead` shape (so MUI Autocomplete's typing is happy).
- `filterOptions`: strips any sentinel, filters the real options by search path, then appends `createNewSentinel` when `onCreateNew` is provided.
- `onChange`: detects the sentinel id and calls `onCreateNew(inputValue)` (clearing the input) instead of `onChange(id)`.
- `getOptionLabel` / `renderOption`: special-case the sentinel — renders a bordered row with a `Plus` icon and either `+ Create new category` or `Create "<text>" as new category`.

### 2. `frontend/src/features/transactions/components/TransactionForm.tsx`

Orchestration lives here because `setValue` from React Hook Form is in scope.

- State: `addCategoryModalOpen`, `addAccountModalOpen`, `pendingCategoryName`.
- Mutation: `useCreateCategory(familyId)` for capturing the new category's id. (Account creation is handled internally by `AddAccountModal`, so no `useCreateAccount` is needed here.)
- **Category flow**: `CategorySelect` receives `onCreateNew` → stores the typed text and opens `AddCategoryModal`. On success, `setValue('category_id', newCategory.id)` auto-selects it.
- **Account flow**: the account `Select`'s `onChange` intercepts the `__CREATE_ACCOUNT__` sentinel value and opens `AddAccountModal`; a `Divider` + sentinel `MenuItem` is appended to the options. `AddAccountModal`'s `onCreated` callback runs `setValue('account_id', newAccount.id)`.
- Both modals render after the form inside a fragment wrapper.
- Removed the now-unused `selectedCategory`/`selectedCategoryId` lookup and the `CategoryRead`/`FormLabel` imports.

### 3. `frontend/src/features/category/components/AddCategoryModal.tsx`

- Added optional `initialName?: string` prop.
- The `useEffect` that syncs state on `open` now sets `setName(initialName ?? '')` so the pre-filled search text lands in the Name field. Modal stays self-contained.

### 4. `frontend/src/features/accounts/components/AddAccountModal.tsx`

- Added optional `onCreated?: (account: AccountRead) => void` prop (imported `AccountRead`).
- `handleSubmit`'s `onSuccess` now calls `onCreated?.(newAccount)` before `onClose()` so the parent can auto-select.

### 5. `frontend/src/features/imports/components/steps/ReviewStep.tsx` (CSV import)

The CSV import review grid renders `CategorySelect` inside an AG Grid cell renderer, so it gets the same treatment:

- Extended the grid's `ReviewContext` with `onCreateCategory(inputText, rowIndex, kind)`.
- `CategoryCellRenderer` passes `onCreateNew` through to `CategorySelect`, capturing the row index and the row's effective transaction kind.
- `ReviewStep` owns the `AddCategoryModal` state + `useCreateCategory` mutation; on success it auto-assigns the new category to the originating row via `onEditRow(pendingRowIndex, { categoryId })`.
- The modal renders alongside the grid inside a fragment wrapper.

---

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/domain/CategorySelect.tsx` | `onCreateNew` prop + sentinel in `filterOptions` + styled render |
| `frontend/src/features/transactions/components/TransactionForm.tsx` | Inline modal state, category mutation, account sentinel MenuItem, nested modals |
| `frontend/src/features/category/components/AddCategoryModal.tsx` | `initialName` prop synced in the open effect |
| `frontend/src/features/accounts/components/AddAccountModal.tsx` | `onCreated` callback on success |
| `frontend/src/features/imports/components/steps/ReviewStep.tsx` | Wire `onCreateNew` through AG Grid context + inline AddCategoryModal |

---

## Reused Hooks

- `useCreateCategory(familyId)` — `frontend/src/features/category/hooks/useCreateCategory.ts`
- `useCreateAccount(familyId)` — used internally by `AddAccountModal`

Both invalidate `['categories', familyId]` / `['accounts', familyId]` on success, so the dropdowns refresh automatically after creation.

---

## Verification

1. Open Add Transaction modal.
2. **Category**: expand the Category autocomplete → "+ Create new category" appears at bottom. Select it → AddCategoryModal opens on top, kind pre-set to current transaction type. Create a category → modal closes, new category auto-selected; all other fields unchanged.
3. **Category (search)**: type "Groc" → no match → "Create 'Groc' as new category" appears → click it → AddCategoryModal opens with Name pre-filled as "Groc".
4. **Account**: open the Account dropdown → "Create new account" appears at bottom. Select it → AddAccountModal opens. Create account → modal closes, new account auto-selected.
5. **CSV import**: on the Review step, open any row's Category cell → "+ Create new category" appears → create → new category auto-assigned to that row.
6. `npm run build` — no TypeScript errors.
7. `npm test` — all 156 tests pass.
