# Plan: Add Icon & Color to Categories, Accounts, and Budgets

## Context

Categories, accounts, and budgets are displayed throughout the app (settings trees, dropdowns, data grids, charts) but have no visual identity beyond their name. Adding an optional icon (lucide-react) and color (hex swatch) to each entity will make navigation faster, charts more readable, and the app more personal. When a color is set, it replaces the positional fallback in charts; when not set, existing behavior is unchanged.

---

## 1. Backend Changes

### 1a. Model additions — `backend/api/app/models.py`

Add two nullable columns to each entity:

```python
icon: Optional[str] = Field(default=None, sa_column=Column(String(64), nullable=True))
color: Optional[str] = Field(default=None, sa_column=Column(String(7), nullable=True))
```

Entities: `Category` (after `kind`), `Account` (after `balance`), `Budget` (after `currency`).

### 1b. Schema additions — `backend/api/app/schemas.py`

For each entity add to `*Create`, `*Read`, and `*Update`:
```python
icon: Optional[str] = None
color: Optional[str] = None
```

Schemas to update: `CategoryCreate/Read/Update`, `AccountCreate/Read/Update`, `BudgetCreate/Read/Update`.

### 1c. Router updates

**Categories** — `backend/api/app/routers/categories.py`:
- `_fetch_category_with_parent`: add `"icon": category.icon, "color": category.color` to the returned dict.
- `create_category`: pass `icon=payload.icon, color=payload.color` to the `Category(...)` constructor.
- `update_category`: replace the current series of `if payload.x is not None` checks with the idiomatic Pydantic v2 pattern so `None` can be set explicitly (to clear an icon/color):
  ```python
  update_fields = payload.model_dump(exclude_unset=True)
  for field_name, value in update_fields.items():
      setattr(category_record, field_name, value)
  ```

**Accounts** — `backend/api/app/routers/accounts.py`:
- `_serialize_account` helper (lines 16–57): add `"icon": account.icon, "color": account.color` to the returned dict.
- `create_account`: pass `icon=payload.icon, color=payload.color`.
- `update_account`: same `model_dump(exclude_unset=True)` + setattr pattern.

**Budgets** — `backend/api/app/routers/budgets.py`:
- `_build_budget_read` (lines 135–186): `BudgetRead(... icon=budget.icon, color=budget.color ...)`.
- `create_budget` and `update_budget`: same pattern as above.

### 1d. Alembic migrations

Three separate migration files (one per entity), chained in order:

1. `add_icon_color_to_category` — `op.add_column('category', ...)` for both columns
2. `add_icon_color_to_account` — `op.add_column('account', ...)` for both columns
3. `add_icon_color_to_budget` — `op.add_column('budget', ...)` for both columns

Generate with `alembic revision --autogenerate -m "<name>"` then verify the auto-generated SQL.

---

## 2. Shared Frontend Picker Components

Both pickers are pure UI with no domain logic → place in `frontend/src/components/ui/molecules/`.

### 2a. `IconPicker.tsx`

```typescript
interface IconPickerProps {
  value: string | null;
  onChange: (icon: string | null) => void;
  disabled?: boolean;
}
```

Renders a 5-column MUI `Box` grid. First cell is a "none" button (dashed border). Each remaining cell is an `IconButton` (size `small`) wrapping the existing `Icon` atom (`frontend/src/components/atoms/Icon.tsx`). Selected icon gets `border: '2px solid primary.main'`.

**Curated icon list** (25 finance/household lucide icons exported as `PICKER_ICONS` constant):
`ShoppingCart, ShoppingBag, Utensils, Coffee, Car, Fuel, Home, Zap, Wifi, Smartphone, Heart, Pill, GraduationCap, Book, Plane, TrendingUp, Briefcase, DollarSign, CreditCard, PiggyBank, Gift, Music, Dumbbell, Baby, PawPrint`

### 2b. `ColorSwatchPicker.tsx`

```typescript
interface ColorSwatchPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  disabled?: boolean;
}
```

Renders flex-wrap of 28×28px circular `Box` swatches. First swatch is a "none" option (grey border, diagonal line SVG). Selected swatch gets `border: '2px solid primary.main'`. No external library.

**16-swatch palette** exported as `SWATCH_COLORS`:
`#F44336, #FF5722, #FF9800, #FFC107, #4CAF50, #009688, #2196F3, #3F51B5, #9C27B0, #E91E63, #607D8B, #795548, #00BCD4, #8BC34A, #CDDC39, #9E9E9E`

---

## 3. Frontend: Categories

### 3a. Types — `frontend/src/types/category.ts`
Add `icon: string | null` and `color: string | null` to `CategoryRead`, `CategoryCreate`, `CategoryUpdate`.

### 3b. Modals

**`AddCategoryModal.tsx`**: Add `useState<string | null>(null)` for icon/color. Reset on modal open. Add labeled `IconPicker` + `ColorSwatchPicker` to the `DialogContent` stack. Pass both into `CategoryCreate` payload.

**`EditCategoryModal.tsx`**: Initialize state from `category.icon` / `category.color`. Include in `hasChanges()` check. Include in `updateData` when changed (use `undefined` for unset to avoid sending nulls unnecessarily — or always send the current value).

### 3c. CategoryTree — `frontend/src/components/domain/CategoryTree.tsx`

In each category row, insert before the name `Typography`:
```tsx
<Box sx={{ width: 20, height: 20, borderRadius: '50%',
           backgroundColor: category.color ?? 'transparent',
           display: 'flex', alignItems: 'center', justifyContent: 'center',
           border: category.color ? 'none' : '1px dashed', borderColor: 'divider',
           flexShrink: 0, mr: 1 }}>
  {category.icon && <Icon name={category.icon as IconName} size={12}
                           style={{ color: category.color ? '#fff' : 'inherit' }} />}
</Box>
```
Only renders when at least one of `icon` or `color` is set.

### 3d. CategorySelect — `frontend/src/components/domain/CategorySelect.tsx`

Add the same colored-circle+icon inline to `renderOption`, before the name text.

### 3e. Chart color pipeline

**Unify `CHART_COLORS`**: Remove the local 8-color array from `SpendingByCategory.tsx` and import from `frontend/src/features/reports/utils.ts` (already has 10 colors, is already imported by `CategoryPieChart`).

**`useDashboardSummary.ts`** (`frontend/src/features/dashboard/hooks/useDashboardSummary.ts`):
- Add `color: string | null` to the `CategorySpending` interface.
- Build a `colorById` map from `categories`.
- Populate `color` when building `categorySpendingMap`. The "Other" bucket gets `color: null`.

**`useMonthlyReport.ts`** (`frontend/src/features/reports/hooks/useMonthlyReport.ts`):
- Add `color: string | null` to `ReportSlice` in `frontend/src/features/reports/types.ts`.
- Build a `colorById` map from `categories`.
- Pass `color` through `byCategoryMap` and `toSortedSlices`. Non-category slices (by user, by account) get `color: null`.

**Charts**:
- `SpendingByCategory.tsx`: `fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]}`
- `CategoryPieChart.tsx`: same pattern using `slice.color`.

---

## 4. Frontend: Accounts

### 4a. Types — `frontend/src/types/account.ts`
Add `icon: string | null` and `color: string | null` to `AccountRead`, `AccountCreate`, `AccountUpdate`.

### 4b. AccountForm — `frontend/src/features/accounts/components/AccountForm.tsx`
Add `IconPicker` + `ColorSwatchPicker` fields (same labeled pattern as categories). Initialize from `existingAccount.icon / .color` in edit mode.

### 4c. AccountSummary — `frontend/src/features/accounts/components/AccountSummary.tsx`
Add colored circle+icon to the card header, left of the account name. Same rendering pattern as CategoryTree.

### 4d. AgAccountsGrid — `frontend/src/components/domain/ag/AgAccountsGrid.tsx`
Add a leading colored dot/icon to the `name` column cell renderer using an AG Grid `cellRenderer`.

### 4e. UserAccountDonut chart (optional, same-PR)
`frontend/src/features/reports/components/UserAccountDonut.tsx` uses positional colors. The account data fed to this chart would need an `accountColorLookup` threaded through `useMonthlyReport`. Add `color: string | null` to the account slices in `byAccountMap`. In the chart: `fill={slice.color ?? CHART_COLORS[...]}`.

---

## 5. Frontend: Budgets

### 5a. Types — `frontend/src/features/budgets/types.ts`
Add `icon: string | null` and `color: string | null` to `BudgetRead`, `BudgetCreatePayload`, `BudgetUpdatePayload`.

### 5b. BudgetForm — `frontend/src/features/budgets/components/BudgetForm.tsx`
Add `IconPicker` + `ColorSwatchPicker` to the dialog. Initialize from `existingBudget` in edit mode.

### 5c. BudgetsList — `frontend/src/features/budgets/components/BudgetsList.tsx`
Add a colored circle+icon to the `name` column cell renderer (same AG Grid pattern as accounts).

---

## 6. Test Updates

### Backend
Files: `backend/api/tests/test_category_crud.py`, `test_accounts_endpoints.py`, `test_budget_endpoints.py`

For each entity:
- Assert `icon` and `color` keys are present (even if null) in all read responses.
- Add a test creating with `icon="ShoppingCart"` and `color="#F44336"`, assert round-trip.
- Add a test updating icon/color values.
- Add a test clearing icon/color to `None` (validates the `model_dump(exclude_unset=True)` approach works).

### Frontend
Files:
- `frontend/src/test/mocks/factories/category.ts` — add `icon: null, color: null` defaults.
- `frontend/src/test/mocks/handlers/categories.ts` — add `icon: null, color: null` to constructed `CategoryRead` objects.
- Same pattern for accounts (`factories/account.ts`, `handlers/accounts.ts`) and budgets.
- Integration tests (`frontend/src/__tests__/SettingsPage.integration.test.tsx` or similar): add cases for icon/color picker rendering in Add/Edit modals.

---

## 7. Sequencing

1. Backend: model + schemas + migrations (all three entities together)
2. Backend: router updates + backend tests
3. Frontend: TypeScript types for all three entities
4. Frontend: mock factories + MSW handler updates
5. Frontend: shared `IconPicker` + `ColorSwatchPicker` components
6. Frontend: `CHART_COLORS` unification
7. Frontend: chart data pipeline threading (CategorySpending, ReportSlice, byAccount)
8. Frontend: chart component `fill` updates
9. Frontend: modal updates for all three entities
10. Frontend: CategoryTree + CategorySelect + AccountSummary + AgAccountsGrid + BudgetsList rendering
11. Frontend: integration tests

---

## 8. Verification

- `cd backend/api && alembic upgrade head` — migration applies cleanly; `alembic downgrade -1` three times — all three reverse cleanly.
- `cd backend && uv run pytest` — all backend tests pass including new icon/color tests.
- `cd frontend && npm run test:run` — all frontend tests pass.
- `cd frontend && npm run build` — zero TypeScript errors.
- Manual smoke test: Settings → add a category with icon+color → verify icon/color appear in CategoryTree, CategorySelect dropdown, and dashboard pie chart slice.
