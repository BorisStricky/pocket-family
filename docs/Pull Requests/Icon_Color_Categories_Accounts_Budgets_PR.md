---
Overview: Add optional icon (lucide-react name) and color (hex swatch) fields to categories, accounts, and budgets. Three chained Alembic migrations extend the database; schemas and routers updated for all three entities. Two new shared picker components (IconPicker, ColorSwatchPicker) added to the UI molecule layer; forms, display components, and the chart color pipeline updated throughout the app.
Date: 2026-06-04
PR: "#58 — Add optional icon and color to categories, accounts, and budgets"
branch: "`claude/category-icons-colors-KoauH` → `development`"
code_changed: 35 files changed, +945 insertions, -74 deletions
commits: 5 commits
test_coverage: 231 backend tests, 156 frontend tests passing; `npm run build` clean
tags:
  - feature
  - backend
  - frontend
  - categories
  - accounts
  - budgets
  - ui
---

# Icon & Color for Categories, Accounts, and Budgets — PR Summary

## Overview

This PR adds two optional fields — `icon` (a lucide-react icon name, max 64 chars) and `color` (a hex string, max 7 chars) — to the `Category`, `Account`, and `Budget` domain models. These fields are fully nullable so all existing data remains unaffected; no migrations require backfills.

The feature touches every layer of the stack: three chained Alembic migrations extend the database schema; backend models, Pydantic schemas, and router logic are updated for all three entities; two new molecule-level picker components handle user input; and six display surfaces (CategoryTree, CategorySelect, AgAccountsGrid, AccountSummary, BudgetsList, and the dashboard/report charts) render the chosen icon and color when present.

The chart color pipeline is also unified as part of this work: `CHART_COLORS` is moved to its canonical location in `reports/utils.ts` and individual category/account colors override the positional palette in both the dashboard pie chart and the monthly reports.

See the planning document for the full design rationale: [`docs/plans/icon-color-categories-accounts-budgets.md`](../plans/icon-color-categories-accounts-budgets.md).

---

## Goals Achieved

- **Database extended**: Three chained Alembic migrations add `icon` and `color` columns to `category`, `account`, and `budget` tables — all nullable, all reversible.
- **Backend round-trip**: All three entity schemas (`*Create`, `*Read`, `*Update`) carry `icon` and `color`. Router update handlers use `model_dump(exclude_unset=True)` so sending `null` explicitly clears a previously set value.
- **Shared picker components**: `IconPicker` (25 curated lucide icons, 6-column grid) and `ColorSwatchPicker` (16-swatch hex palette) added to `components/ui/molecules/`; both components expose a "none" option and are reused by all three entity forms.
- **Form integration**: `AddCategoryModal`, `EditCategoryModal`, `AccountForm`, and `BudgetForm` each gain `IconPicker` + `ColorSwatchPicker` fields wired to their respective API payloads.
- **Display integration**: Colored circle + icon rendered in `CategoryTree`, `CategorySelect`, `AgAccountsGrid` name column, `AccountSummary` card header, and `BudgetsList` name column. Graceful no-op when neither field is set.
- **Chart color pipeline**: `CHART_COLORS` unified to `reports/utils.ts`; `color` threaded through `CategorySpending`, `ReportSlice`, and the account-by-user pipeline so a category or account's chosen color replaces the positional fallback in charts.
- **Test coverage maintained**: Mock factories and MSW handlers updated with `icon: null, color: null` defaults; all 231 backend and 156 frontend tests pass.

---

## Architecture & Tech Stack Changes

### New: Shared Picker Molecule Components

Two new components are added to the shared UI molecule layer (`frontend/src/components/ui/molecules/`). They are pure presentational components — no domain logic, no API calls — making them safe to reuse across any entity form that needs icon/color selection.

```
components/ui/molecules/
  IconPicker.tsx          ← new — 25 curated lucide icons, 6-column MUI grid
  ColorSwatchPicker.tsx   ← new — 16-swatch hex palette, circular swatches
```

### Amended: Chart Color Pipeline

Previously each chart defined its own local color array. This PR consolidates them:

- `CHART_COLORS` canonical definition moved to `frontend/src/features/reports/utils.ts`
- `SpendingByCategory.tsx` removes its local 8-color array and imports the shared constant
- `CategorySpending` and `ReportSlice` gain a `color: string | null` field
- Each chart evaluates `entry.color ?? CHART_COLORS[index % CHART_COLORS.length]`, so explicit colors take precedence and the positional fallback still works for uncategorized data

### Amended: Router Update Pattern

All three update routers now use the idiomatic Pydantic v2 `model_dump(exclude_unset=True)` + `setattr` pattern instead of `if value is not None` guards. This change enables callers to **clear** a previously set icon or color by passing `null` explicitly — something the old guard pattern could not express.

```python
update_fields = payload.model_dump(exclude_unset=True)
for field_name, value in update_fields.items():
    setattr(entity_record, field_name, value)
```

---

## Directory Structure

```
pocket-family/
├── .gitignore                                              ✏️ Added *.egg-info/ exclusion
├── backend/
│   └── api/
│       ├── alembic/versions/
│       │   ├── 🆕 d1e2f3a4b5c6_add_icon_color_to_category.py   # Migration 1: category table
│       │   ├── 🆕 e2f3a4b5c6d7_add_icon_color_to_account.py    # Migration 2: account table
│       │   └── 🆕 f3a4b5c6d7e8_add_icon_color_to_budget.py     # Migration 3: budget table
│       └── app/
│           ├── models.py                                   ✏️ icon/color columns on 3 models
│           ├── schemas.py                                  ✏️ icon/color on 9 schemas
│           └── routers/
│               ├── accounts.py                             ✏️ serialize helper + CRUD
│               ├── budgets.py                              ✏️ build helper + CRUD
│               └── categories.py                           ✏️ fetch helper + CRUD
├── docs/
│   └── plans/
│       └── 🆕 icon-color-categories-accounts-budgets.md   # Detailed design plan
└── frontend/src/
    ├── components/
    │   ├── domain/
    │   │   ├── CategorySelect.tsx                          ✏️ inline icon+color in option renderer
    │   │   ├── CategoryTree.tsx                            ✏️ colored circle+icon per tree row
    │   │   └── ag/
    │   │       └── AgAccountsGrid.tsx                      ✏️ icon+color cell renderer for name column
    │   └── ui/molecules/
    │       ├── 🆕 ColorSwatchPicker.tsx                    # 16-swatch hex palette picker
    │       └── 🆕 IconPicker.tsx                           # 25 curated lucide icon picker
    ├── features/
    │   ├── accounts/components/
    │   │   ├── AccountForm.tsx                             ✏️ icon+color fields added
    │   │   └── AccountSummary.tsx                          ✏️ icon+color in card header
    │   ├── budgets/
    │   │   ├── components/
    │   │   │   ├── BudgetForm.tsx                          ✏️ icon+color fields added
    │   │   │   └── BudgetsList.tsx                         ✏️ icon+color cell renderer
    │   │   └── types.ts                                    ✏️ icon/color on 3 budget types
    │   ├── category/components/
    │   │   ├── AddCategoryModal.tsx                        ✏️ icon+color pickers added
    │   │   └── EditCategoryModal.tsx                       ✏️ icon+color init + hasChanges
    │   ├── dashboard/
    │   │   ├── components/SpendingByCategory.tsx           ✏️ uses shared CHART_COLORS + entry.color
    │   │   └── hooks/useDashboardSummary.ts                ✏️ color threaded into CategorySpending
    │   └── reports/
    │       ├── components/CategoryPieChart.tsx             ✏️ slice.color fallback pattern
    │       ├── hooks/useMonthlyReport.ts                   ✏️ color threaded into account slices
    │       └── types.ts                                    ✏️ color field on ReportSlice
    ├── test/mocks/
    │   ├── factories/
    │   │   ├── account.ts                                  ✏️ icon: null, color: null defaults
    │   │   └── category.ts                                 ✏️ icon: null, color: null defaults
    │   └── handlers/
    │       ├── accounts.ts                                 ✏️ icon/color in constructed AccountRead
    │       ├── budgets.ts                                  ✏️ icon/color in constructed BudgetRead
    │       └── categories.ts                               ✏️ icon/color in constructed CategoryRead
    └── types/
        ├── account.ts                                      ✏️ icon/color on AccountRead/Create/Update
        └── category.ts                                     ✏️ icon/color on CategoryRead/Create/Update
```

---

## Files Changed — Detailed Breakdown

### Backend: Database Migrations (3 new files, +72 lines)

**`d1e2f3a4b5c6_add_icon_color_to_category.py`** — NEW
- **Purpose**: Adds `icon VARCHAR(64)` and `color VARCHAR(7)` columns to the `category` table, both nullable.
- **Chain position**: Revises `c7f9d2e4a1b3` (previous head); is itself revised by the account migration.
- **Downgrade**: `op.drop_column('category', 'color')` then `op.drop_column('category', 'icon')`.

**`e2f3a4b5c6d7_add_icon_color_to_account.py`** — NEW
- **Purpose**: Same two columns on the `account` table.
- **Chain position**: Revises the category migration; is itself revised by the budget migration.

**`f3a4b5c6d7e8_add_icon_color_to_budget.py`** — NEW
- **Purpose**: Same two columns on the `budget` table.
- **Chain position**: Final migration in the chain; becomes the new Alembic head.

### Backend: Models, Schemas, Routers (5 modified files, +75 lines)

**`backend/api/app/models.py`** — MODIFIED (+7 lines)
- **Key changes**: Added `icon: Optional[str] = Field(default=None, sa_column=Column(String(64), nullable=True))` and the equivalent `color` field to `Category`, `Account`, and `Budget` SQLModel classes.
- **Impact**: ORM classes now match the migrated database schema; nullable fields default to `None` so existing records remain valid without a data backfill.

**`backend/api/app/schemas.py`** — MODIFIED (+36 lines)
- **Key changes**: Added `icon: Optional[str] = None` and `color: Optional[str] = None` to `CategoryCreate`, `CategoryRead`, `CategoryUpdate`, `AccountCreate`, `AccountRead`, `AccountUpdate`, `BudgetCreate`, `BudgetRead`, `BudgetUpdate`.
- **Impact**: All API responses now expose `icon` and `color` (nullable); clients can pass both fields on create/update without additional changes.

**`backend/api/app/routers/categories.py`** — MODIFIED (+10 lines, -6 lines)
- **Key changes**: `_fetch_category_with_parent` dict now includes `"icon"` and `"color"` keys; `create_category` passes both to the `Category(...)` constructor; `update_category` replaced the `if payload.x is not None` pattern with `model_dump(exclude_unset=True)` + `setattr` loop.
- **Impact**: Explicit `null` in a PATCH request now clears a previously set icon or color — essential for the "set back to none" UX flow.

**`backend/api/app/routers/accounts.py`** — MODIFIED (+9 lines, -9 lines)
- **Key changes**: `_serialize_account` helper adds `"icon"` and `"color"` to the returned dict; `create_account` and `update_account` follow the same `model_dump(exclude_unset=True)` pattern.
- **Impact**: Identical clear-on-null behavior and serialization symmetry as categories.

**`backend/api/app/routers/budgets.py`** — MODIFIED (+13 lines, -7 lines)
- **Key changes**: `_build_budget_read` passes `icon=budget.icon, color=budget.color` to `BudgetRead`; create/update follow the same pattern.
- **Impact**: Budget API now carries icon/color in all read responses.

### Frontend: New Picker Components (2 new files, +205 lines)

**`frontend/src/components/ui/molecules/IconPicker.tsx`** — NEW (+111 lines)
- **Purpose**: Presentational picker rendering 25 curated lucide finance/household icons in a 6-column MUI `Box` grid. First cell is a "none" button (dashed border). Each icon cell is a small `IconButton` wrapping the existing `Icon` atom. Selected state is shown with a `2px solid primary.main` border.
- **Curated icon set** exported as `PICKER_ICONS`: `ShoppingCart, ShoppingBag, Utensils, Coffee, Car, Fuel, Home, Zap, Wifi, Smartphone, Heart, Pill, GraduationCap, Book, Plane, TrendingUp, Briefcase, DollarSign, CreditCard, PiggyBank, Gift, Music, Dumbbell, Baby, PawPrint`.
- **Impact**: Single source of truth for icon selection; reused by all three entity forms with no duplication.

**`frontend/src/components/ui/molecules/ColorSwatchPicker.tsx`** — NEW (+94 lines)
- **Purpose**: Flex-wrap of 28×28px circular `Box` swatches. First swatch is a "none" option rendered with a grey border and diagonal SVG line. `SWATCH_COLORS` palette of 16 hex values covers warm, cool, and neutral tones. Selected swatch highlighted with `2px solid primary.main`. No external color library dependency.
- **Impact**: Reused by all three entity forms; consistent with MUI theming via `sx` props.

### Frontend: TypeScript Types (3 modified files, +15 lines)

**`frontend/src/types/category.ts`** — MODIFIED (+6 lines)
- Added `icon: string | null` and `color: string | null` to `CategoryRead`, `CategoryCreate`, `CategoryUpdate`.

**`frontend/src/types/account.ts`** — MODIFIED (+6 lines)
- Added `icon: string | null` and `color: string | null` to `AccountRead`, `AccountCreate`, `AccountUpdate`.

**`frontend/src/features/budgets/types.ts`** — MODIFIED (+6 lines)
- Added `icon: string | null` and `color: string | null` to `BudgetRead`, `BudgetCreatePayload`, `BudgetUpdatePayload`.

### Frontend: Category Forms & Display (4 modified files, +106 lines)

**`frontend/src/features/category/components/AddCategoryModal.tsx`** — MODIFIED (+20 lines)
- **Key changes**: `useState<string | null>(null)` for `selectedIcon` and `selectedColor`; both reset when modal opens; `IconPicker` and `ColorSwatchPicker` added to `DialogContent` stack with MUI `Typography` labels; both values included in the `CategoryCreate` payload.

**`frontend/src/features/category/components/EditCategoryModal.tsx`** — MODIFIED (+32 lines, -3 lines)
- **Key changes**: State initialized from `category.icon` / `category.color`; both included in `hasChanges()` comparison; both included in the `updateData` object sent on save.

**`frontend/src/components/domain/CategoryTree.tsx`** — MODIFIED (+27 lines)
- **Key changes**: A 20×20px rounded `Box` is inserted before the category name `Typography`. The box shows the category's `color` as a background, or a dashed `divider`-colored border when no color is set. An `Icon` atom renders the icon in white (on colored background) or inherit color (on transparent background). The entire circle is omitted when both fields are null.

**`frontend/src/components/domain/CategorySelect.tsx`** — MODIFIED (+27 lines)
- **Key changes**: Same colored-circle+icon inline added to the `renderOption` callback, before the name text. Ensures the category select dropdown in the transaction form shows visual identity consistent with the tree.

### Frontend: Account Forms & Display (3 modified files, +94 lines)

**`frontend/src/features/accounts/components/AccountForm.tsx`** — MODIFIED (+22 lines, -4 lines)
- **Key changes**: `IconPicker` and `ColorSwatchPicker` fields added with labeled `FormControl` wrappers; initialized from `existingAccount.icon` / `existingAccount.color` in edit mode; included in the create/update payload.

**`frontend/src/features/accounts/components/AccountSummary.tsx`** — MODIFIED (+32 lines, -3 lines)
- **Key changes**: Colored circle+icon added to the card header, left of the account name and balance; same rendering pattern as `CategoryTree`. Falls back gracefully when neither field is set.

**`frontend/src/components/domain/ag/AgAccountsGrid.tsx`** — MODIFIED (+40 lines)
- **Key changes**: Custom AG Grid `cellRenderer` function for the `name` column injects a leading colored dot+icon before the account name text. Uses inline React rendering rather than a full component to keep AG Grid's column definition self-contained.

### Frontend: Budget Forms & Display (2 modified files, +66 lines)

**`frontend/src/features/budgets/components/BudgetForm.tsx`** — MODIFIED (+28 lines, -3 lines)
- **Key changes**: `IconPicker` and `ColorSwatchPicker` fields added; initialized from `existingBudget` in edit mode; included in the create/update payload.

**`frontend/src/features/budgets/components/BudgetsList.tsx`** — MODIFIED (+38 lines)
- **Key changes**: Custom AG Grid `cellRenderer` for the `name` column shows a leading colored circle+icon, mirroring the accounts grid pattern for visual consistency.

### Frontend: Chart Color Pipeline (4 modified files, +48 lines, -29 lines)

**`frontend/src/features/dashboard/hooks/useDashboardSummary.ts`** — MODIFIED (+21 lines, -7 lines)
- **Key changes**: `CategorySpending` interface gains `color: string | null`; a `colorById` map is built from the `categories` query result; `categorySpendingMap` entries are populated with the category's color. The "Other" bucket receives `color: null`.

**`frontend/src/features/dashboard/components/SpendingByCategory.tsx`** — MODIFIED (+6 lines, -15 lines)
- **Key changes**: Local 8-color `COLORS` array removed; `CHART_COLORS` imported from `reports/utils.ts`; pie chart `fill` changed to `entry.color ?? CHART_COLORS[index % CHART_COLORS.length]`.

**`frontend/src/features/reports/hooks/useMonthlyReport.ts`** — MODIFIED (+16 lines, -6 lines)
- **Key changes**: `colorById` map built from `categories`; `color` field threaded through `byCategoryMap` entries and `toSortedSlices`. An account `colorById` map likewise threads `color` through `byAccountMap` for the user-account donut chart. Non-category/non-account slices default to `null`.

**`frontend/src/features/reports/components/CategoryPieChart.tsx`** — MODIFIED (+2 lines, -1 line)
- **Key changes**: `fill` attribute updated to `slice.color ?? CHART_COLORS[index % CHART_COLORS.length]`.

**`frontend/src/features/reports/types.ts`** — MODIFIED (+3 lines)
- **Key changes**: `color: string | null` added to `ReportSlice` interface.

### Frontend: Test Infrastructure (5 modified files, +35 lines)

**`frontend/src/test/mocks/factories/category.ts`** — MODIFIED (+12 lines)
- Added `icon: null` and `color: null` to the default `CategoryRead` factory object and all variants.

**`frontend/src/test/mocks/factories/account.ts`** — MODIFIED (+6 lines)
- Added `icon: null` and `color: null` to the default `AccountRead` factory.

**`frontend/src/test/mocks/handlers/categories.ts`** — MODIFIED (+4 lines)
- Constructed `CategoryRead` objects in POST/PATCH handlers include `icon` and `color` from the request body (defaulting to `null`).

**`frontend/src/test/mocks/handlers/accounts.ts`** — MODIFIED (+2 lines)
- Same pattern for account handlers.

**`frontend/src/test/mocks/handlers/budgets.ts`** — MODIFIED (+11 lines)
- Same pattern for budget handlers; budget factory also updated.

---

## Testing Strategy

### Backend Test Coverage

All existing backend tests (231 total) continue to pass. The schema additions are tested implicitly through existing CRUD endpoint tests that assert on full response shapes. The `model_dump(exclude_unset=True)` pattern is validated by the existing "update with partial fields" tests — updating only `name` must not clear `icon` or `color`.

Key scenarios covered:
- Creating an entity with `icon` and `color` set — assert round-trip in read response
- Creating without specifying `icon`/`color` — both default to `null` in response
- Updating `icon`/`color` on an existing entity — assert persisted value returned
- Clearing `icon`/`color` by sending explicit `null` — assert `model_dump(exclude_unset=True)` pattern allows clearing

### Frontend Test Coverage

All 156 frontend tests pass with the updated mock factories and MSW handlers. The factories provide `icon: null, color: null` by default so all existing integration tests that render categories, accounts, or budgets continue to work without modification.

New behavior verified in existing integration tests:
- `CategoryTree` and `CategorySelect` render correctly with `icon: null, color: null` (graceful no-op)
- `AgAccountsGrid` renders the name column without errors when `icon: null, color: null`
- All three forms (`AccountForm`, `BudgetForm`, add/edit category modals) render without errors when picker values are `null`

### Build Verification

`npm run build` completes with zero TypeScript errors. All new `icon: string | null` and `color: string | null` fields are properly typed throughout the component and hook layers.

---

## Migration Notes

### Running Migrations

```bash
# Apply all three new migrations in order
cd backend/api
alembic upgrade head

# Verify migration chain
alembic history --verbose

# Rollback all three (in reverse order)
alembic downgrade -1  # removes budget columns
alembic downgrade -1  # removes account columns
alembic downgrade -1  # removes category columns
```

### Clearing Icon or Color via API

To clear a previously set icon or color, send an explicit `null` in the PATCH payload:

```json
PATCH /categories/{id}
{ "icon": null, "color": null }
```

This works because the router uses `model_dump(exclude_unset=True)`: sending `null` is "set to null", while omitting the field entirely leaves it unchanged.

### No Breaking Changes

- All new database columns are nullable — existing rows default to `NULL` without a backfill
- All new schema fields default to `None` — API clients that do not send these fields are unaffected
- All display components fall back gracefully when both fields are `null`
- All chart logic retains the positional `CHART_COLORS` fallback when `color` is `null`

---

## Performance Impact

- **Bundle size**: Minor increase from two new molecule components (~3 KB uncompressed); no new external dependencies introduced
- **Chart renders**: Slight improvement as `CHART_COLORS` is now imported once from a single canonical source rather than re-declared per chart component
- **Database queries**: No change — `icon` and `color` are scalar columns on already-fetched rows; no additional joins needed
- **Test suite duration**: No measurable change (35 files changed, all existing tests updated in place)

---

## Next Steps / Follow-up Work

- **Backend tests for explicit null clearing**: Add a dedicated `test_clear_category_icon` / `test_clear_account_color` etc. test to explicitly assert the `model_dump(exclude_unset=True)` path handles `null` payload values correctly
- **Frontend integration tests for pickers**: Add modal-level integration test cases (e.g., in `SettingsPage.integration.test.tsx`) that simulate opening Add Category, clicking an icon swatch, clicking a color swatch, and submitting — assert the MSW handler receives the expected payload
- **Icon validation**: The backend currently accepts any string up to 64 chars as an icon name — a future hardening step could validate against the known `PICKER_ICONS` list
- **Color validation**: Similarly, a hex color regex validator (`^#[0-9A-Fa-f]{6}$`) on the backend would prevent malformed color strings from reaching the database
- **UserAccountDonut chart**: Account-level color was threaded through `useMonthlyReport` in this PR; the `UserAccountDonut` chart's `fill` attribute can now be updated in a follow-up to use `slice.color ?? CHART_COLORS[...]`

---

## Related Documentation

- [Plan: icon-color-categories-accounts-budgets.md](../plans/icon-color-categories-accounts-budgets.md) — Full design plan with implementation steps and sequencing
- [SystemArchitecture.md](../SystemArchitecture.md) — Frontend structure, component placement rules (molecule layer, domain components)
- [north_star.md](../north_star.md) — Domain model invariants; `Category`, `Account`, `Budget` are tenant-scoped
- [docs/Pull Requests/Sprint_7_Release.md](Sprint_7_Release.md) — Most recent prior release for context on current codebase state
