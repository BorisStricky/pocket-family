// src/features/imports/components/steps/ReviewStep.tsx
// Step 2 of the CSV import wizard: review parsed rows, handle duplicates,
// assign categories and descriptions before the final import.
//
// Renders parsed rows in an AG Grid table consistent with the rest of the app
// (matches AgTransactionsGrid / AgAccountsGrid). Interactive cells
// (skip checkbox, description, category) are React cell renderers that read
// shared state via params.context and call back into the wizard on changes.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import type { CellClassParams, ColDef, ICellRendererParams } from 'ag-grid-community';
import { CategorySelect } from '@/components/domain/CategorySelect';
import { AddCategoryModal } from '@/features/category/components/AddCategoryModal';
import { useCategories } from '@/features/category/hooks/useCategories';
import { useCreateCategory } from '@/features/category/hooks/useCreateCategory';
import type { CategoryRead, CategoryCreate } from '@/types/category';
import type { ParsedRow, RowEdit } from '../../types';

interface ReviewStepProps {
  analyzedRows: ParsedRow[];
  rowEdits: Record<number, RowEdit>;
  familyId: string;
  onEditRow: (rowIndex: number, edit: Partial<RowEdit>) => void;
}

// Shared state made available to every cell renderer via params.context.
interface ReviewContext {
  rowEdits: Record<number, RowEdit>;
  onEditRow: (rowIndex: number, edit: Partial<RowEdit>) => void;
  categories: CategoryRead[];
  /** Opens AddCategoryModal pre-filled with the search text and row's transaction kind. */
  onCreateCategory?: (inputText: string | undefined, rowIndex: number, kind?: 'expense' | 'income') => void;
}

function isRowSkipped(row: ParsedRow, rowEdits: Record<number, RowEdit>): boolean {
  return rowEdits[row.row_index]?.skip ?? row.is_duplicate;
}

function SkipCellRenderer(params: ICellRendererParams<ParsedRow>) {
  const row = params.data!;
  const ctx = params.context as ReviewContext;
  const hasParseError = Boolean(row.parse_error);
  const skipped = isRowSkipped(row, ctx.rowEdits);
  return (
    <Checkbox
      size="small"
      checked={!skipped && !hasParseError}
      disabled={hasParseError}
      onChange={(event) => ctx.onEditRow(row.row_index, { skip: !event.target.checked })}
    />
  );
}

function TypeCellRenderer(params: ICellRendererParams<ParsedRow>) {
  const row = params.data!;
  const ctx = params.context as ReviewContext;
  if (row.parse_error) return null;
  const skipped = isRowSkipped(row, ctx.rowEdits);
  const currentType =
    ctx.rowEdits[row.row_index]?.transactionType ?? row.transaction_type ?? 'expense';
  return (
    <Select
      value={currentType}
      size="small"
      variant="standard"
      disabled={skipped}
      disableUnderline
      onChange={(event) =>
        ctx.onEditRow(row.row_index, {
          transactionType: event.target.value as 'expense' | 'income',
        })
      }
      sx={{
        width: '100%',
        '& .MuiSelect-select': { py: 0.5, fontSize: '0.8rem' },
        color: currentType === 'expense' ? 'error.main' : 'success.main',
        fontWeight: 500,
      }}
    >
      <MenuItem value="expense">Expense</MenuItem>
      <MenuItem value="income">Income</MenuItem>
    </Select>
  );
}

function DescriptionCellRenderer(params: ICellRendererParams<ParsedRow>) {
  const row = params.data!;
  const ctx = params.context as ReviewContext;
  if (row.parse_error) {
    return <Typography variant="caption" color="error">{row.parse_error}</Typography>;
  }
  const skipped = isRowSkipped(row, ctx.rowEdits);
  // Uncontrolled input keyed by row + edit version so React keeps the user's
  // intermediate keystrokes locally; we commit to parent state on blur to
  // avoid re-rendering the whole grid on every character.
  const initialValue = ctx.rowEdits[row.row_index]?.description ?? row.description ?? '';
  return (
    <TextField
      size="small"
      variant="standard"
      defaultValue={initialValue}
      key={`${row.row_index}-${initialValue}`}
      onBlur={(event) => ctx.onEditRow(row.row_index, { description: event.target.value })}
      disabled={skipped}
      placeholder="Add description…"
      fullWidth
      sx={{ '& input': { fontSize: '0.8rem', py: 0 } }}
    />
  );
}

function CategoryCellRenderer(params: ICellRendererParams<ParsedRow>) {
  const row = params.data!;
  const ctx = params.context as ReviewContext;
  if (row.parse_error) return null;
  const skipped = isRowSkipped(row, ctx.rowEdits);
  const categoryId = ctx.rowEdits[row.row_index]?.categoryId ?? null;
  // Use the user-edited type if set so the category list filters correctly
  // after the user flips income/expense for the row.
  const effectiveType =
    (ctx.rowEdits[row.row_index]?.transactionType ?? row.transaction_type) as
      | 'expense'
      | 'income'
      | undefined;
  // Wrap in a width:100% Box because MUI Autocomplete doesn't auto-fill its
  // parent without an explicit width, so inside an AG Grid cell the input
  // collapses to its content (showing only "O…" instead of "Optional…").
  return (
    <Box sx={{ width: '100%' }}>
      <CategorySelect
        value={categoryId}
        onChange={(id: string | null) => ctx.onEditRow(row.row_index, { categoryId: id ?? undefined })}
        kind={effectiveType}
        categories={ctx.categories}
        label=""
        placeholder="Optional…"
        disabled={skipped}
        onCreateNew={
          ctx.onCreateCategory
            ? (inputText) => ctx.onCreateCategory!(inputText, row.row_index, effectiveType)
            : undefined
        }
      />
    </Box>
  );
}

function StatusCellRenderer(params: ICellRendererParams<ParsedRow>) {
  const row = params.data!;
  if (row.parse_error) {
    return <Chip label="Error" color="error" size="small" variant="outlined" />;
  }
  if (row.is_duplicate) {
    return (
      <Tooltip title="A transaction with the same date and amount already exists in this account">
        <Chip label="Duplicate" color="warning" size="small" variant="outlined" />
      </Tooltip>
    );
  }
  return null;
}

/**
 * ReviewStep — inspect all parsed rows, exclude duplicates, assign categories.
 *
 * The grid shows one row per transaction. Rows the backend flagged as
 * duplicates are pre-checked to skip. Users can uncheck them to include.
 * Category and description are editable per row.
 */
export function ReviewStep({ analyzedRows, rowEdits, familyId, onEditRow }: ReviewStepProps) {
  const { data: categoriesResponse } = useCategories(familyId);
  const categories = Array.isArray(categoriesResponse) ? categoriesResponse : [];
  const gridRef = useRef<AgGridReact<ParsedRow>>(null);

  // Inline category creation — opens AddCategoryModal from within the grid's Category cell
  const { mutate: createCategory, isPending: isCreatingCategory, error: createCategoryError } =
    useCreateCategory(familyId);
  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
  const [pendingCategoryName, setPendingCategoryName] = useState('');
  const [pendingCategoryKind, setPendingCategoryKind] = useState<'expense' | 'income'>('expense');
  const [pendingRowIndex, setPendingRowIndex] = useState(-1);

  // Called from the CategorySelect sentinel inside each grid row
  const handleCreateCategoryRequest = (
    inputText: string | undefined,
    rowIndex: number,
    kind?: 'expense' | 'income',
  ) => {
    setPendingCategoryName(inputText ?? '');
    setPendingCategoryKind(kind ?? 'expense');
    setPendingRowIndex(rowIndex);
    setAddCategoryModalOpen(true);
  };

  // After successful creation, auto-assign the new category to the originating row
  const handleInlineCategoryCreate = (data: CategoryCreate) => {
    createCategory(data, {
      onSuccess: (newCategory) => {
        onEditRow(pendingRowIndex, { categoryId: newCategory.id });
        setAddCategoryModalOpen(false);
        setPendingCategoryName('');
        setPendingRowIndex(-1);
      },
    });
  };

  const includedCount = analyzedRows.filter((row) => {
    if (row.parse_error) return false;
    return !isRowSkipped(row, rowEdits);
  }).length;

  const parseErrorCount = analyzedRows.filter((row) => row.parse_error).length;
  const duplicateCount = analyzedRows.filter((row) => row.is_duplicate).length;

  // Recompute cell visuals (checkbox state, opacity) whenever the wizard's
  // shared rowEdits map changes — params.context is re-read on refresh.
  useEffect(() => {
    gridRef.current?.api?.refreshCells({ force: true });
  }, [rowEdits, categories]);

  const columnDefinitions: ColDef<ParsedRow>[] = useMemo(() => {
    const skippedOpacity = (params: CellClassParams<ParsedRow>): Record<string, string | number> => {
      const row = params.data;
      if (!row) return {};
      const ctx = params.context as ReviewContext | undefined;
      const skipped = ctx ? isRowSkipped(row, ctx.rowEdits) : row.is_duplicate;
      const hasError = Boolean(row.parse_error);
      if (hasError) return { opacity: 0.55, background: '#fdecea' };
      if (skipped) return { opacity: 0.45 };
      return {};
    };

    return [
      {
        headerName: '',
        colId: 'skip',
        width: 56,
        sortable: false,
        filter: false,
        cellRenderer: SkipCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' } as Record<string, string | number>,
      },
      {
        field: 'transaction_date',
        headerName: 'Date',
        width: 110,
        sortable: true,
        valueFormatter: (params) => (params.data?.parse_error ? '—' : params.value ?? ''),
        cellStyle: (params: CellClassParams<ParsedRow>) => ({ display: 'flex', alignItems: 'center', ...skippedOpacity(params) }),
      },
      {
        field: 'amount',
        headerName: 'Amount',
        width: 120,
        type: 'rightAligned',
        sortable: true,
        valueFormatter: (params) => (params.data?.parse_error ? '—' : params.value ?? ''),
        cellStyle: (params: CellClassParams<ParsedRow>) => ({ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontVariantNumeric: 'tabular-nums', ...skippedOpacity(params) }),
      },
      {
        field: 'transaction_type',
        headerName: 'Type',
        width: 130,
        cellRenderer: TypeCellRenderer,
        cellStyle: (params: CellClassParams<ParsedRow>) => ({ display: 'flex', alignItems: 'center', ...skippedOpacity(params) }),
      },
      {
        field: 'description',
        headerName: 'Description',
        flex: 1.4,
        minWidth: 220,
        cellRenderer: DescriptionCellRenderer,
        cellStyle: (params: CellClassParams<ParsedRow>) => ({ display: 'flex', alignItems: 'center', ...skippedOpacity(params) }),
      },
      {
        headerName: 'Category',
        colId: 'category',
        flex: 1,
        minWidth: 320,
        cellRenderer: CategoryCellRenderer,
        cellStyle: (params: CellClassParams<ParsedRow>) => ({ display: 'flex', alignItems: 'center', ...skippedOpacity(params) }),
      },
      {
        headerName: 'Status',
        colId: 'status',
        width: 120,
        cellRenderer: StatusCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center' } as Record<string, string | number>,
      },
    ];
  }, []);

  return (
    <>
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
        <Typography variant="body1">
          {includedCount} of {analyzedRows.length} rows will be imported
        </Typography>
        {duplicateCount > 0 && (
          <Chip
            label={`${duplicateCount} duplicates pre-skipped`}
            color="warning"
            size="small"
            variant="outlined"
          />
        )}
        {parseErrorCount > 0 && (
          <Chip
            label={`${parseErrorCount} parse errors`}
            color="error"
            size="small"
            variant="outlined"
          />
        )}
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Uncheck a row to skip it. Duplicate rows (matching an existing transaction by date and amount)
        are pre-skipped — uncheck to include anyway.
      </Alert>

      <Box className="ag-theme-alpine" sx={{ height: 480, width: '100%' }}>
        <AgGridReact<ParsedRow>
          ref={gridRef}
          rowData={analyzedRows}
          columnDefs={columnDefinitions}
          context={{ rowEdits, onEditRow, categories, onCreateCategory: handleCreateCategoryRequest }}
          theme="legacy"
          getRowId={(params) => String(params.data.row_index)}
          rowHeight={52}
          defaultColDef={{ resizable: true, filter: false }}
          animateRows={true}
        />
      </Box>
    </Box>

    {/* AddCategoryModal — opened from within any row's Category cell in the grid */}
    <AddCategoryModal
      open={addCategoryModalOpen}
      onClose={() => {
        setAddCategoryModalOpen(false);
        setPendingCategoryName('');
        setPendingRowIndex(-1);
      }}
      onCreate={handleInlineCategoryCreate}
      kind={pendingCategoryKind}
      initialName={pendingCategoryName}
      categories={categories}
      isLoading={isCreatingCategory}
      error={createCategoryError instanceof Error ? createCategoryError.message : null}
    />
    </>
  );
}
