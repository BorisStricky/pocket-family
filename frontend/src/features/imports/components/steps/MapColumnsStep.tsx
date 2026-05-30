// src/features/imports/components/steps/MapColumnsStep.tsx
// Step 1 of the CSV import wizard: map CSV columns to transaction fields.
//
// Auto-proposes mappings using keyword matching against common column name patterns.
// The user can override any auto-proposed mapping via dropdowns.
// Clicking "Analyze" calls the backend to parse rows and flag duplicates.

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { useAnalyzeCsv } from '../../hooks/useAnalyzeCsv';
import type { AnalyzeResponse, ColumnMapping, WizardState } from '../../types';

interface MapColumnsStepProps {
  detectedColumns: string[];
  fileKey: string;
  familyId: string;
  wizardState: WizardState;
  onAnalyzed: (result: AnalyzeResponse, mapping: ColumnMapping, accountId: string, currency: string, startRow: number) => void;
}

// Keyword sets for auto-proposing column mappings.
// Covers common English and Portuguese bank statement column names.
const DATE_KEYWORDS = ['date', 'data', 'fecha', 'datum', 'dat'];
const AMOUNT_KEYWORDS = ['amount', 'valor', 'value', 'montante', 'total', 'debit', 'credit', 'débito', 'crédito', 'importe'];
const DESCRIPTION_KEYWORDS = ['description', 'desc', 'memo', 'descricao', 'descrição', 'narration', 'note', 'detail', 'historico', 'histórico'];
const TYPE_KEYWORDS = ['type', 'tipo', 'kind', 'dc', 'dr_cr'];

/**
 * Find the first column whose lowercase name contains any of the given keywords.
 */
function proposeColumn(columns: string[], keywords: string[]): string | undefined {
  const lowered = columns.map((col) => col.toLowerCase());
  const index = lowered.findIndex((col) => keywords.some((keyword) => col.includes(keyword)));
  return index >= 0 ? columns[index] : undefined;
}

/**
 * MapColumnsStep — choose which CSV column maps to each transaction field.
 */
export function MapColumnsStep({
  detectedColumns,
  fileKey,
  familyId,
  wizardState,
  onAnalyzed,
}: MapColumnsStepProps) {
  // Auto-propose initial mappings based on column name patterns
  const [dateColumn, setDateColumn] = useState(
    wizardState.columnMapping?.date_column ?? proposeColumn(detectedColumns, DATE_KEYWORDS) ?? ''
  );
  const [amountColumn, setAmountColumn] = useState(
    wizardState.columnMapping?.amount_column ?? proposeColumn(detectedColumns, AMOUNT_KEYWORDS) ?? ''
  );
  const [descriptionColumn, setDescriptionColumn] = useState(
    wizardState.columnMapping?.description_column ?? proposeColumn(detectedColumns, DESCRIPTION_KEYWORDS) ?? ''
  );
  const [typeColumn, setTypeColumn] = useState(
    wizardState.columnMapping?.type_column ?? proposeColumn(detectedColumns, TYPE_KEYWORDS) ?? ''
  );
  const [accountId, setAccountId] = useState(wizardState.accountId ?? '');
  const [currency, setCurrency] = useState(wizardState.currency ?? 'BRL');
  const [startRow, setStartRow] = useState(wizardState.startRow ?? 0);

  const { data: accountsResponse, isLoading: isLoadingAccounts } = useAccounts(familyId);
  const accounts = Array.isArray(accountsResponse) ? accountsResponse : [];

  const { mutate: analyze, isPending, error } = useAnalyzeCsv();

  // Re-run auto-proposal when detected columns change (e.g. user re-uploaded)
  useEffect(() => {
    if (!wizardState.columnMapping) {
      setDateColumn(proposeColumn(detectedColumns, DATE_KEYWORDS) ?? '');
      setAmountColumn(proposeColumn(detectedColumns, AMOUNT_KEYWORDS) ?? '');
      setDescriptionColumn(proposeColumn(detectedColumns, DESCRIPTION_KEYWORDS) ?? '');
      setTypeColumn(proposeColumn(detectedColumns, TYPE_KEYWORDS) ?? '');
    }
  }, [detectedColumns, wizardState.columnMapping]);

  const isValid = dateColumn && amountColumn && accountId;

  const handleAnalyze = () => {
    if (!isValid) return;

    const mapping: ColumnMapping = {
      date_column: dateColumn,
      amount_column: amountColumn,
      description_column: descriptionColumn || undefined,
      type_column: typeColumn || undefined,
    };

    analyze(
      {
        file_key: fileKey,
        account_id: accountId,
        column_mapping: mapping,
        start_row: startRow,
        currency,
      },
      {
        onSuccess: (result) => onAnalyzed(result, mapping, accountId, currency, startRow),
      }
    );
  };

  // Options reused by the two "optional" mapping dropdowns. The empty value
  // here represents "leave this field unmapped" — Description and Type are
  // both safe to omit.
  const optionalColumnItems = [
    <MenuItem key="__unmapped" value="">(not mapped)</MenuItem>,
    ...detectedColumns.map((column) => (
      <MenuItem key={column} value={column}>{column}</MenuItem>
    )),
  ];

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Tell us which CSV column maps to each transaction field. Auto-proposals are based
        on column name patterns — adjust any that look wrong.
      </Typography>

      <Stack spacing={3} sx={{ mt: 3 }}>
        {/* Required fields */}
        <Typography variant="subtitle2" color="text.secondary">
          Required
        </Typography>

        <TextField
          select
          fullWidth
          required
          label="Date column"
          value={dateColumn}
          error={!dateColumn}
          helperText={!dateColumn ? 'Select the column that contains the transaction date' : undefined}
          onChange={(event) => setDateColumn(event.target.value)}
        >
          {detectedColumns.map((column) => (
            <MenuItem key={column} value={column}>{column}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          required
          label="Amount column"
          value={amountColumn}
          error={!amountColumn}
          helperText={!amountColumn ? 'Select the column that contains the monetary amount' : undefined}
          onChange={(event) => setAmountColumn(event.target.value)}
        >
          {detectedColumns.map((column) => (
            <MenuItem key={column} value={column}>{column}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          required
          label="Account"
          value={accountId}
          disabled={isLoadingAccounts}
          error={!accountId}
          helperText={!accountId ? 'Select the account these transactions belong to' : undefined}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {accounts.map((account) => (
            <MenuItem key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="Currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
        >
          <MenuItem value="BRL">BRL — Brazilian Real</MenuItem>
          <MenuItem value="USD">USD — US Dollar</MenuItem>
          <MenuItem value="EUR">EUR — Euro</MenuItem>
        </TextField>

        <Divider />

        {/* Optional fields */}
        <Typography variant="subtitle2" color="text.secondary">
          Optional
        </Typography>

        <TextField
          select
          fullWidth
          label="Description column"
          value={descriptionColumn}
          onChange={(event) => setDescriptionColumn(event.target.value)}
        >
          {optionalColumnItems}
        </TextField>

        <TextField
          select
          fullWidth
          label="Type column"
          value={typeColumn}
          onChange={(event) => setTypeColumn(event.target.value)}
          helperText="If omitted, the type is inferred from the amount sign (negative = expense, positive = income)"
        >
          {optionalColumnItems}
        </TextField>

        <TextField
          label="Header row index"
          type="number"
          value={startRow}
          onChange={(e) => setStartRow(Math.max(0, parseInt(e.target.value, 10) || 0))}
          helperText="0 = first row is the header. Increase if your CSV has metadata rows above the headers."
          inputProps={{ min: 0 }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error instanceof Error ? error.message : 'Analysis failed. Check your column mapping and try again.'}
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={handleAnalyze}
        disabled={!isValid || isPending}
        startIcon={isPending ? <CircularProgress size={16} /> : undefined}
        sx={{ mt: 3 }}
      >
        {isPending ? 'Analyzing…' : 'Analyze CSV'}
      </Button>
    </Box>
  );
}
