# Credit-card-aware expense/income classification on CSV import

## Overview

Credit-card CSV exports use the opposite sign convention from bank statements:
**purchases (expenses) are positive** (they increase the amount owed) and
**payments are negative**. The importer previously hard-coded the bank convention
(negative → expense, positive → income), so every credit-card expense was imported
as income and vice-versa. This change flips the sign-based inference for credit-card
imports and gives the user explicit control over the convention via a checkbox on the
Map Columns step.

## Goals Achieved

- Switch sign-based classification when the import targets a credit-card account
  (positive → expense, negative → income).
- Add a **"Use positive values as expenses"** checkbox so the user controls the
  default classification, defaulting **on for credit accounts** and **off for
  debit/cash**.
- Preserve existing behavior for bank/debit imports (default is unchanged).
- Keep an explicit **Type column** authoritative and per-row Review overrides intact.

## Architecture & Tech Stack Changes

No new dependencies, no model/schema-table changes, **no database migration**. The
feature is a single boolean (`positive_amounts_are_expenses`) carried from the Map
Columns UI into the `POST /imports/analyze` request. Because the analyze step already
resolves each row's `transaction_type`, and `POST /imports/execute` consumes those
resolved types, the flag lives **only on `AnalyzeRequest`** — nothing downstream
(execute, the Celery/Lambda worker, balance math) needed to change.

Classification precedence is unchanged and layered:

1. Explicit **Type column** value (`_normalize_type`) wins when present.
2. Otherwise **sign-based inference** (`_parse_amount`) decides — and this is the only
   layer the new flag affects.
3. The user can still override any row's type in the Review step.

The absolute amount is never altered by the flag, so **duplicate detection** (which
keys on `(date, abs(amount))`) is completely unaffected.

## Directory Structure

```
backend/api/app/
  routers/imports.py        ✏️ _parse_amount gains positive_is_expense; analyze_csv passes it
  schemas.py                ✏️ AnalyzeRequest gains positive_amounts_are_expenses: bool = False
backend/api/tests/
  test_imports_helpers.py   ✏️ new TestParseAmountCreditCardConvention class
  test_imports_endpoints.py ✏️ new analyze tests: credit flip, default regression, type-column fallback

frontend/src/features/imports/
  types.ts                            ✏️ AnalyzeRequest gains positive_amounts_are_expenses?: boolean
  components/steps/MapColumnsStep.tsx ✏️ checkbox + info-icon tooltip + per-account default + payload
frontend/src/__tests__/
  imports.integration.test.tsx        ✏️ credit-on / debit-off checkbox + payload tests
```

## Files Changed — Detailed Breakdown

### Backend — classification logic

**`backend/api/app/routers/imports.py`** — MODIFIED
- **Purpose:** Parses uploaded CSV rows and infers expense/income.
- **Key changes:** `_parse_amount(raw)` → `_parse_amount(raw, positive_is_expense=False)`.
  The sign detection is unchanged and `abs(value)` is still always returned; only the
  final sign → type mapping is flipped when the flag is set
  (`True`: positive → expense, negative → income). `analyze_csv` passes
  `request.positive_amounts_are_expenses` into the call. The empty-type-cell fallback
  (`type_column` mapped but a row's cell blank) still falls through to the flag-aware
  inferred type.
- **Impact:** Credit-card statements classify correctly; bank/debit imports are
  byte-for-byte unchanged because the default is `False`.

**`backend/api/app/schemas.py`** — MODIFIED
- **Purpose:** API request/response contracts.
- **Key changes:** `AnalyzeRequest.positive_amounts_are_expenses: bool = False`, with a
  docstring explaining the credit-card convention and that an explicit `type_column`
  still takes precedence.
- **Impact:** Optional and backward compatible — existing clients that omit it get the
  bank convention.

### Frontend — Map Columns control

**`frontend/src/features/imports/components/steps/MapColumnsStep.tsx`** — MODIFIED
- **Purpose:** Step 1 of the import wizard — maps CSV columns and launches analysis.
- **Key changes:** Adds a "Use positive values as expenses" `Checkbox` with an info
  `(i)` icon whose **hover `Tooltip`** carries the full explanation (credit-card vs
  bank convention; only applies when no Type column is mapped). A `useEffect` keyed on
  the selected account auto-defaults the box **on for `type === 'credit'`** and off
  otherwise, guarded by a `userToggledClassification` ref so a manual toggle is never
  clobbered. The box is disabled when a Type column is mapped, and the analyze payload
  sends `positive_amounts_are_expenses: typeColumn ? false : positiveAmountsAreExpenses`
  so the transmitted value matches the (greyed-out) control.
- **Impact:** Users get a sensible per-account default while retaining full control.

**`frontend/src/features/imports/types.ts`** — MODIFIED
- **Purpose:** TS types mirroring the backend schemas.
- **Key changes:** `AnalyzeRequest.positive_amounts_are_expenses?: boolean`.
- **Impact:** Type-safe payload; no `any`.

## Testing Strategy

**Backend** (`backend/api/tests/`, pytest + in-memory SQLite, `TEST_MODE=1`):
- `test_imports_helpers.py` — new `TestParseAmountCreditCardConvention`: positive →
  expense, negative → income, accounting `(150)` → income under the flag, plus a
  regression guard that the default/explicit-`False` argument keeps the bank convention.
- `test_imports_endpoints.py` — `/imports/analyze` tests: the credit flag flips a
  positive purchase to expense and a negative payment to income; omitting the flag
  preserves the bank convention; and a Type-column + empty-cell case proves an explicit
  type wins while a blank cell falls back to the flag-aware sign inference.

**Frontend** (`frontend/src/__tests__/`, Vitest + RTL + MSW, semantic queries):
- Selecting a **credit** account auto-checks the box and sends
  `positive_amounts_are_expenses: true`; the seeded **debit** account leaves it
  unchecked and sends `false` (asserted via the captured MSW request body).

**Results:** Backend **232 passed** (full suite); Frontend **build clean** (no TS
errors) and **141 passed** (full suite). An independent `code-reviewer` pass returned
**COMPLETE**.

## Migration Notes

None. No model or database-schema change, so no Alembic migration. The new request
field is optional and defaults to the prior behavior.

## Next Steps / Follow-up Work

- Optional: persist the checkbox into `WizardState` so it survives a Back/return to
  Step 1 (currently it is recomputed from the selected account, which is acceptable).

## Related Documentation

- [docs/SystemArchitecture.md](../SystemArchitecture.md)
- [docs/Pull Requests/CSV_Import_Service_Release.md](CSV_Import_Service_Release.md)
- [docs/Pull Requests/csv-import-lambda_PR.md](csv-import-lambda_PR.md)
