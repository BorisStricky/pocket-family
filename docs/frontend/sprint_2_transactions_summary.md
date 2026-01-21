# Sprint 2 Summary: Transactions CRUD with AG Grid

## Overview

Sprint 2 delivers a complete transactions CRUD (Create, Read, Update, Delete) feature with AG Grid integration. This is the first full-featured CRUD implementation in the application, establishing patterns for data grids, forms, filters, and mutations that will be reused throughout the codebase. The sprint includes comprehensive test coverage, MSW mock handlers, and factory functions for testing.

**Duration**: Sprint 2
**Status**: ✅ COMPLETED
**Branch**: `frontend_sprint_2` → `stage2_clean_frontend`
**Files Changed**: 56 files (+9,788 lines, -315 lines)

---

## Goals Achieved

1. **Full Transaction CRUD Operations**: Users can view, create, edit, and delete transactions
2. **AG Grid Integration**: Sortable, filterable data grid with custom cell renderers for currency and dates
3. **Filter System**: Date range picker and text search filtering working end-to-end with backend
4. **React Query Patterns**: Established mutation/query patterns for all future CRUD features
5. **Test Infrastructure**: MSW handlers and factory functions for transaction testing
6. **Storybook Documentation**: Interactive component documentation for new UI molecules
7. **Bug Fixes**: Date formatting (DD/MM/YYYY), timezone handling, AG Grid legacy theme compatibility

---

## Architecture & Tech Stack Changes

### New Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `ag-grid-community` | ^32.3.3 | AG Grid core data grid library |
| `ag-grid-react` | ^32.3.3 | React wrapper for AG Grid |

### New Architectural Patterns

1. **AG Grid Domain Wrapper Pattern**: `AgTransactionsGrid` wraps AG Grid with transaction-specific column definitions, cell formatters, and event handlers. This pattern will be reused for accounts, budgets, and reports grids.

2. **Transaction API Structure**: Centralized API functions in `transactionsApi.ts` that handle query parameter construction, matching backend parameter names (`start`/`end` for dates).

3. **MSW Testing Pattern**: In-memory store with `resetTransactionStore()` for test isolation, enabling CRUD operation simulation across test suites.

4. **Factory Functions Pattern**: `createMockTransaction()` and variants (`createMockExpenseTransaction`, `createMockIncomeTransaction`, `createMockTransactionList`) provide consistent test data generation.

---

## Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── atoms/
│   │   │   ├── 🆕 Badge.tsx                    # Small badge for counts/labels
│   │   │   └── ✏️ index.ts                     # Added Badge export
│   │   │
│   │   ├── domain/
│   │   │   └── ag/
│   │   │       ├── 🆕 AgTransactionsGrid.tsx   # AG Grid wrapper for transactions
│   │   │       ├── 🆕 __tests__/AgTransactionsGrid.test.tsx  # Grid tests (511 lines)
│   │   │       └── 🆕 index.ts                 # Domain AG Grid exports
│   │   │
│   │   ├── molecules/
│   │   │   ├── 🆕 DateRangePicker.tsx          # MUI date range picker with ptBR locale
│   │   │   ├── 🆕 DeleteConfirmDialog.tsx      # Reusable delete confirmation dialog
│   │   │   ├── 🆕 SearchInput.tsx              # Search input with clear button
│   │   │   └── 🆕 index.ts                     # Molecules barrel export
│   │   │
│   │   └── ui/molecules/
│   │       └── 🆕 DeleteConfirmDialog.tsx      # UI version of delete dialog
│   │
│   ├── features/
│   │   └── transactions/
│   │       ├── __tests__/
│   │       │   ├── 🆕 TransactionForm.test.tsx         # Form validation tests (525 lines)
│   │       │   ├── 🆕 transactionsApi.test.ts          # API function tests (498 lines)
│   │       │   ├── 🆕 useCreateTransaction.test.tsx    # Create mutation tests (440 lines)
│   │       │   ├── 🆕 useDeleteTransaction.test.tsx    # Delete mutation tests (428 lines)
│   │       │   ├── 🆕 useTransaction.test.tsx          # Single transaction query tests (343 lines)
│   │       │   ├── 🆕 useTransactions.test.tsx         # List query tests (419 lines)
│   │       │   └── 🆕 useUpdateTransaction.test.tsx    # Update mutation tests (484 lines)
│   │       │
│   │       ├── api/
│   │       │   └── 🆕 transactionsApi.ts       # CRUD API functions (150 lines)
│   │       │
│   │       ├── components/
│   │       │   ├── 🆕 BulkActions.tsx          # Bulk delete/export actions bar
│   │       │   ├── 🆕 TransactionForm.tsx      # React Hook Form transaction form
│   │       │   └── 🆕 index.ts                 # Components barrel export
│   │       │
│   │       ├── hooks/
│   │       │   ├── 🆕 useCreateTransaction.ts  # POST mutation hook
│   │       │   ├── 🆕 useDeleteTransaction.ts  # DELETE mutation hook
│   │       │   ├── 🆕 useTransaction.ts        # GET single transaction hook
│   │       │   ├── 🆕 useTransactions.ts       # GET list with filters hook
│   │       │   └── 🆕 useUpdateTransaction.ts  # PUT mutation hook
│   │       │
│   │       ├── pages/
│   │       │   ├── 🆕 AddTransactionPage.tsx         # Create transaction page
│   │       │   ├── 🆕 TransactionDetailPage.tsx      # View/edit transaction page
│   │       │   ├── 🆕 TransactionsPage.tsx           # Main list page with grid
│   │       │   └── 🆕 index.ts                       # Pages barrel export
│   │       │
│   │       └── types/
│   │           └── 🆕 index.ts                 # Transaction TypeScript types
│   │
│   ├── router/
│   │   └── ✏️ index.tsx                        # Added transaction routes
│   │
│   ├── stories/
│   │   ├── 🆕 Badge.stories.tsx                # Badge component stories
│   │   ├── 🆕 DateRangePicker.stories.tsx      # DateRangePicker stories
│   │   ├── 🆕 DeleteConfirmDialog.stories.tsx  # DeleteConfirmDialog stories
│   │   └── 🆕 SearchInput.stories.tsx          # SearchInput stories
│   │
│   ├── test/
│   │   ├── mocks/
│   │   │   ├── factories/
│   │   │   │   ├── ✏️ index.ts                 # Added transaction exports
│   │   │   │   └── 🆕 transaction.ts           # Transaction factory functions
│   │   │   │
│   │   │   ├── handlers/
│   │   │   │   ├── ✏️ index.ts                 # Added transaction handlers
│   │   │   │   └── 🆕 transactions.ts          # MSW transaction handlers
│   │   │   │
│   │   │   └── ✏️ server.ts                    # Added transaction handlers to server
│   │   │
│   │   └── ✏️ setup.ts                         # Test setup enhancements
│   │
│   └── types/
│       └── ✏️ transaction.ts                   # Enhanced Transaction type
│
├── ✏️ package.json                             # Added AG Grid dependencies
└── ✏️ package-lock.json                        # Lockfile update

backend/
└── api/
    └── app/
        └── routers/
            └── ✏️ transactions.py              # Added `search` query parameter

tests/
└── ✏️ test_transaction_crud.py                 # Added search filtering tests
```

**Legend**: 🆕 NEW | ✏️ MODIFIED | ❌ DELETED

---

## Files Changed - Detailed Breakdown

### Transaction Feature Module (17 files)

#### API Layer

| File | Status | Purpose |
|------|--------|---------|
| [transactionsApi.ts](frontend/src/features/transactions/api/transactionsApi.ts) | 🆕 NEW | CRUD API functions with query parameter construction |

**Key Implementation**: The API layer handles parameter naming conversion between frontend (`start_date`/`end_date`) and backend (`start`/`end`). All functions use `apiFetch()` for consistent auth header injection.

```typescript
// Query parameter construction pattern
if (filters?.start_date) {
  queryParameters.append('start', filters.start_date);  // Backend expects 'start'
}
```

#### React Query Hooks (5 files)

| File | Status | Purpose |
|------|--------|---------|
| [useTransactions.ts](frontend/src/features/transactions/hooks/useTransactions.ts) | 🆕 NEW | Fetch filtered transaction list with cache key `['transactions', familyId, filters]` |
| [useTransaction.ts](frontend/src/features/transactions/hooks/useTransaction.ts) | 🆕 NEW | Fetch single transaction by ID |
| [useCreateTransaction.ts](frontend/src/features/transactions/hooks/useCreateTransaction.ts) | 🆕 NEW | POST mutation with query invalidation |
| [useUpdateTransaction.ts](frontend/src/features/transactions/hooks/useUpdateTransaction.ts) | 🆕 NEW | PUT mutation with query invalidation |
| [useDeleteTransaction.ts](frontend/src/features/transactions/hooks/useDeleteTransaction.ts) | 🆕 NEW | DELETE mutation with query invalidation |

**Query Key Pattern**: `['transactions', familyId, filters]` ensures proper cache segregation per family and filter combination.

#### Feature Components (3 files)

| File | Status | Purpose |
|------|--------|---------|
| [TransactionForm.tsx](frontend/src/features/transactions/components/TransactionForm.tsx) | 🆕 NEW | React Hook Form-based transaction form with validation |
| [BulkActions.tsx](frontend/src/features/transactions/components/BulkActions.tsx) | 🆕 NEW | Bulk delete/export action bar for selected rows |
| [components/index.ts](frontend/src/features/transactions/components/index.ts) | 🆕 NEW | Barrel export for feature components |

**TransactionForm Features**:
- React Hook Form integration with Controller for select fields
- Client-side validation (amount > 0, required fields)
- Support for create and edit modes via `initialData` prop
- BRL currency default for Brazilian market MVP

#### Pages (4 files)

| File | Status | Purpose |
|------|--------|---------|
| [TransactionsPage.tsx](frontend/src/features/transactions/pages/TransactionsPage.tsx) | 🆕 NEW | Main list page with AG Grid, filters, bulk actions |
| [AddTransactionPage.tsx](frontend/src/features/transactions/pages/AddTransactionPage.tsx) | 🆕 NEW | Create transaction form page |
| [TransactionDetailPage.tsx](frontend/src/features/transactions/pages/TransactionDetailPage.tsx) | 🆕 NEW | View/edit/delete single transaction page |
| [pages/index.ts](frontend/src/features/transactions/pages/index.ts) | 🆕 NEW | Barrel export for pages |

**TransactionsPage Layout**:
1. Header with title and "Add Transaction" button
2. Filter section (DateRangePicker + SearchInput)
3. BulkActions bar (appears when rows selected)
4. AG Grid with loading/error/empty states

#### Types (1 file)

| File | Status | Purpose |
|------|--------|---------|
| [types/index.ts](frontend/src/features/transactions/types/index.ts) | 🆕 NEW | TransactionCreate, TransactionRead, TransactionUpdate, TransactionFilters types |

---

### AG Grid Domain Component (3 files)

| File | Status | Purpose |
|------|--------|---------|
| [AgTransactionsGrid.tsx](frontend/src/components/domain/ag/AgTransactionsGrid.tsx) | 🆕 NEW | AG Grid wrapper with transaction-specific columns and formatters |
| [AgTransactionsGrid.test.tsx](frontend/src/components/domain/ag/__tests__/AgTransactionsGrid.test.tsx) | 🆕 NEW | 511 lines of grid rendering and interaction tests |
| [ag/index.ts](frontend/src/components/domain/ag/index.ts) | 🆕 NEW | Domain AG Grid barrel export |

**AgTransactionsGrid Features**:
- **Date Column**: DD/MM/YYYY formatting using UTC methods to prevent timezone shift
- **Amount Column**: Intl.NumberFormat currency formatting with dynamic currency code
- **Type Column**: Color-coded (red for expense, green for income) with capitalized text
- **Legacy Theme**: Uses `theme="legacy"` prop for CSS theme compatibility with AG Grid v34+
- **Row Selection**: Multiple selection with checkbox, `suppressRowClickSelection` for row click navigation

```typescript
// Date formatting without timezone shift
const date = new Date(params.value);
const day = String(date.getUTCDate()).padStart(2, '0');
const month = String(date.getUTCMonth() + 1).padStart(2, '0');
const year = date.getUTCFullYear();
return `${day}/${month}/${year}`;
```

---

### UI Molecules (4 files)

| File | Status | Purpose |
|------|--------|---------|
| [DateRangePicker.tsx](frontend/src/components/molecules/DateRangePicker.tsx) | 🆕 NEW | MUI DatePicker pair with ptBR locale for DD/MM/YYYY |
| [SearchInput.tsx](frontend/src/components/molecules/SearchInput.tsx) | 🆕 NEW | TextField with search icon and clear button |
| [DeleteConfirmDialog.tsx](frontend/src/components/molecules/DeleteConfirmDialog.tsx) | 🆕 NEW | Reusable confirmation dialog for destructive actions |
| [molecules/index.ts](frontend/src/components/molecules/index.ts) | 🆕 NEW | Molecules barrel export |

**DateRangePicker Key Implementation**:
- Uses `ptBR` locale from date-fns for DD/MM/YYYY format
- `parseISODate()` and `formatToISODate()` utilities prevent timezone shift
- Validates end date cannot be before start date

---

### UI Atoms (2 files)

| File | Status | Purpose |
|------|--------|---------|
| [Badge.tsx](frontend/src/components/atoms/Badge.tsx) | 🆕 NEW | Small badge component for counts and labels |
| [atoms/index.ts](frontend/src/components/atoms/index.ts) | ✏️ MODIFIED | Added Badge export |

---

### Test Infrastructure (10 files)

#### Factory Functions

| File | Status | Purpose |
|------|--------|---------|
| [factories/transaction.ts](frontend/src/test/mocks/factories/transaction.ts) | 🆕 NEW | Mock transaction factory with variants |
| [factories/index.ts](frontend/src/test/mocks/factories/index.ts) | ✏️ MODIFIED | Added transaction factory exports |

**Factory Functions Provided**:
- `createMockTransaction(options)` - Base factory with all fields
- `createMockExpenseTransaction(amount, options)` - Expense preset
- `createMockIncomeTransaction(amount, options)` - Income preset
- `createMockTransactionList(count, options)` - Generate list with varied data
- `createMockUncategorizedTransaction(options)` - Null category
- `createMockReconciledTransaction(options)` - Reconciled flag true

#### MSW Handlers

| File | Status | Purpose |
|------|--------|---------|
| [handlers/transactions.ts](frontend/src/test/mocks/handlers/transactions.ts) | 🆕 NEW | MSW handlers for all transaction endpoints |
| [handlers/index.ts](frontend/src/test/mocks/handlers/index.ts) | ✏️ MODIFIED | Added transaction handlers |
| [server.ts](frontend/src/test/mocks/server.ts) | ✏️ MODIFIED | Included transaction handlers |

**MSW Handler Features**:
- In-memory store (`mockTransactionStore`) for CRUD simulation
- `resetTransactionStore()` for test isolation
- Auth header validation (401 for missing)
- Special ID handling (`non-existent-id` → 404, `unauthorized-id` → 403)
- Query parameter filtering (tenant, account, category, date range)

#### Test Suites (7 files)

| File | Lines | Tests |
|------|-------|-------|
| [transactionsApi.test.ts](frontend/src/features/transactions/__tests__/transactionsApi.test.ts) | 498 | API function tests |
| [useTransactions.test.tsx](frontend/src/features/transactions/__tests__/useTransactions.test.tsx) | 419 | List query hook tests |
| [useTransaction.test.tsx](frontend/src/features/transactions/__tests__/useTransaction.test.tsx) | 343 | Single query hook tests |
| [useCreateTransaction.test.tsx](frontend/src/features/transactions/__tests__/useCreateTransaction.test.tsx) | 440 | Create mutation tests |
| [useUpdateTransaction.test.tsx](frontend/src/features/transactions/__tests__/useUpdateTransaction.test.tsx) | 484 | Update mutation tests |
| [useDeleteTransaction.test.tsx](frontend/src/features/transactions/__tests__/useDeleteTransaction.test.tsx) | 428 | Delete mutation tests |
| [TransactionForm.test.tsx](frontend/src/features/transactions/__tests__/TransactionForm.test.tsx) | 525 | Form validation tests |
| [AgTransactionsGrid.test.tsx](frontend/src/components/domain/ag/__tests__/AgTransactionsGrid.test.tsx) | 511 | Grid rendering tests |

**Total New Test Lines**: ~3,648 lines

---

### Storybook Stories (4 files)

| File | Status | Purpose |
|------|--------|---------|
| [Badge.stories.tsx](frontend/src/stories/Badge.stories.tsx) | 🆕 NEW | Badge variants and colors |
| [DateRangePicker.stories.tsx](frontend/src/stories/DateRangePicker.stories.tsx) | 🆕 NEW | DateRangePicker interactions |
| [DeleteConfirmDialog.stories.tsx](frontend/src/stories/DeleteConfirmDialog.stories.tsx) | 🆕 NEW | Dialog states and actions |
| [SearchInput.stories.tsx](frontend/src/stories/SearchInput.stories.tsx) | 🆕 NEW | SearchInput states |

---

### Router Changes (1 file)

| File | Status | Changes |
|------|--------|---------|
| [router/index.tsx](frontend/src/router/index.tsx) | ✏️ MODIFIED | Added transaction routes under `/app/:familyId/transactions/*` |

**New Routes**:
```typescript
/app/:familyId/transactions          → TransactionsPage
/app/:familyId/transactions/new      → AddTransactionPage
/app/:familyId/transactions/:id      → TransactionDetailPage
```

---

### Backend Changes (2 files)

| File | Status | Changes |
|------|--------|---------|
| [transactions.py](backend/api/app/routers/transactions.py) | ✏️ MODIFIED | Added `search` query parameter with ILIKE filtering on description |
| [test_transaction_crud.py](tests/test_transaction_crud.py) | ✏️ MODIFIED | Added `test_search_transactions` (7/7 tests pass) |

**Backend Search Implementation**:
```python
if search:
    search_filter = f"%{search}%"
    query = query.where(
        or_(
            Transaction.description.ilike(search_filter),
        )
    )
```

---

## Testing Strategy

### Test Coverage Summary

| Category | Files | Lines | Coverage Focus |
|----------|-------|-------|----------------|
| API Functions | 1 | 498 | Query params, error handling, response parsing |
| React Query Hooks | 5 | 2,114 | Query keys, cache invalidation, loading/error states |
| Components | 2 | 1,036 | Form validation, grid rendering, user interactions |
| **Total Frontend** | **8** | **~3,648** | |
| Backend | 1 | 114 | Search parameter, CRUD operations |

### Testing Patterns Established

1. **Hook Testing with MSW**:
   ```typescript
   const { result } = renderHook(() => useTransactions(familyId, filters), {
     wrapper: AllProviders,
   });
   await waitFor(() => expect(result.current.isSuccess).toBe(true));
   ```

2. **Factory Function Usage**:
   ```typescript
   const transactions = createMockTransactionList(10, { tenant_id: familyId });
   ```

3. **MSW Store Reset**:
   ```typescript
   beforeEach(() => {
     resetTransactionStore();
   });
   ```

4. **Error Scenario Testing**:
   - `non-existent-id` → 404 Not Found
   - `unauthorized-id` → 403 Forbidden
   - Missing auth header → 401 Unauthorized

---

## Bug Fixes Included

### 1. AG Grid Legacy Theme
**Issue**: AG Grid v34+ uses new Theming API by default, causing blank page
**Fix**: Added `theme="legacy"` prop to use CSS-based `ag-theme-alpine`

### 2. Date Timezone Shift
**Issue**: Dates like "2026-01-18" displayed as "2026-01-17" due to UTC parsing
**Fix**: `parseISODate()` and `formatToISODate()` utilities using local timezone

### 3. DD/MM/YYYY Format
**Issue**: MUI DatePicker defaulted to US format (MM/DD/YYYY)
**Fix**: Added `ptBR` locale and `format="dd/MM/yyyy"` prop

### 4. Search Filter Backend
**Issue**: Frontend search wasn't working because backend lacked the parameter
**Fix**: Added `search` query param to `/transactions` endpoint with ILIKE filtering

### 5. Date Filter Parameter Names
**Issue**: Frontend sent `start_date`/`end_date`, backend expected `start`/`end`
**Fix**: Updated `transactionsApi.ts` to use correct parameter names

---

## Known Limitations

### Blocked Items

| Issue | Status | Details |
|-------|--------|---------|
| AG Grid Column Filters | ❌ NOT DONE | Enabling `floatingFilter: true` caused blank page crash. Needs investigation with AG Grid v34 + legacy theme. |

### Technical Debt

1. **Hardcoded Account/Category IDs**: TransactionForm uses temporary hardcoded values until accounts/categories features are built (Sprint 3/4)
2. **No Server-Side Pagination**: Currently fetches all transactions; may need server-side pagination for 1000+ records
3. **Single Currency Display**: Amount formatting assumes consistent currency; multi-currency needs enhancement

---

## Performance Considerations

### Build Impact
- AG Grid adds ~200KB to bundle (tree-shaked)
- No measurable build time increase

### Runtime Performance
- AG Grid handles 10,000+ rows with virtual scrolling
- React Query caching prevents redundant API calls
- Filter changes trigger new queries (debounce could be added)

---

## Next Steps / Follow-up Work

### Immediate (Sprint 3)
- [ ] Implement Accounts feature for dynamic account selection in TransactionForm
- [ ] Add account balance tracking affected by transactions

### Future (Sprint 4+)
- [ ] Categories feature for dynamic category selection
- [ ] AG Grid column filters (investigate v34 compatibility)
- [ ] Export to CSV functionality in BulkActions
- [ ] Server-side pagination for large datasets
- [ ] Recurring transactions support

---

## Migration Notes

### For Developers

1. **AG Grid CSS Import**: Ensure `ag-theme-alpine` CSS is imported in your entry file
2. **ptBR Locale**: DateRangePicker requires `date-fns/locale` for Brazilian format
3. **Test Setup**: Call `resetTransactionStore()` in `beforeEach` when testing transactions

### Breaking Changes
None - this is a new feature addition

---

## Commands Reference

### Development
```bash
npm run dev          # Start dev server with transactions feature
npm run storybook    # View new component stories
```

### Testing
```bash
npm test                                    # Run all tests
npm test -- --grep "transactions"           # Run transaction tests only
npm run test:coverage                       # Generate coverage report
```

### Backend
```bash
pytest tests/test_transaction_crud.py -v   # Run backend transaction tests (7/7 pass)
```

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Sprint**: Sprint 2 - Transactions CRUD
**Status**: ✅ Complete
