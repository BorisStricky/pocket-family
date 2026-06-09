// src/features/imports/components/steps/MapColumnsStep.tsx
// Step 1 of the CSV import wizard: map CSV columns to transaction fields.
//
// Auto-proposes mappings using keyword matching against common column name patterns.
// The user can override any auto-proposed mapping via dropdowns.
// Clicking "Analyze" calls the backend to parse rows and flag duplicates.

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { AccountSelect } from '@/components/domain/AccountSelect';
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

  // Controls how the amount sign is classified. Credit-card statements report
  // purchases (expenses) as positive and payments as negative — the opposite of
  // a bank statement — so this defaults on for credit accounts (see the effect
  // below). We track whether the user has manually toggled it so the per-account
  // default never clobbers an explicit choice.
  const [positiveAmountsAreExpenses, setPositiveAmountsAreExpenses] = useState(false);
  const userToggledClassification = useRef(false);

  const { data: accountsResponse, isLoading: isLoadingAccounts } = useAccounts(familyId);
  const accounts = Array.isArray(accountsResponse) ? accountsResponse : [];

  // Default the classification to the selected account's convention: credit-card
  // accounts use positive = expense, while cash/debit keep the bank convention.
  // Skipped once the user has toggled the checkbox themselves.
  useEffect(() => {
    if (userToggledClassification.current) return;
    const selectedAccount = accounts.find((account) => account.id === accountId);
    setPositiveAmountsAreExpenses(selectedAccount?.type === 'credit');
  }, [accountId, accounts]);

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
        // When a Type column is mapped the checkbox is disabled and sign-based
        // classification is irrelevant, so send false to keep the request value
        // consistent with the (greyed-out) control rather than leaking a stale flag.
        positive_amounts_are_expenses: typeColumn ? false : positiveAmountsAreExpenses,
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

        <AccountSelect
          value={accountId || null}
          onChange={(id) => setAccountId(id ?? '')}
          accounts={accounts}
          label="Account"
          required
          loading={isLoadingAccounts}
          disabled={isLoadingAccounts}
          error={!accountId}
          helperText={!accountId ? 'Select the account these transactions belong to' : undefined}
        />

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

        {/* Sign-classification control. The full explanation lives in the hover
            tooltip on the info icon rather than as a helper line, keeping the
            row compact. Disabled when a Type column is mapped, since an explicit
            type takes precedence over sign-based inference. */}
        <FormControlLabel
          control={
            <Checkbox
              checked={positiveAmountsAreExpenses}
              disabled={Boolean(typeColumn)}
              onChange={(event) => {
                // Mark as user-controlled so the per-account default stops overriding it
                userToggledClassification.current = true;
                setPositiveAmountsAreExpenses(event.target.checked);
              }}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Use positive values as expenses
              <Tooltip
                title="Controls how the sign of the amount is classified. When on, positive amounts are expenses and negative amounts are income — the convention for credit-card statements. When off, negative = expense and positive = income (bank/debit statements). Only applies when no Type column is mapped."
                arrow
              >
                <InfoOutlinedIcon fontSize="small" color="action" aria-label="info" />
              </Tooltip>
            </Box>
          }
        />

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
