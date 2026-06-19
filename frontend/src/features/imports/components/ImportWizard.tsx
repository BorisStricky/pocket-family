// src/features/imports/components/ImportWizard.tsx
// Root wizard component for the CSV import flow.
//
// Manages a 4-step MUI Stepper and all shared wizard state.
// The client holds all state — no server-side session is needed between steps.
// file_key and column_mapping are re-sent to each API call that needs them.

import React, { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  AnalyzeResponse,
  ColumnMapping,
  ExecuteRequest,
  ImportUploadResponse,
  ParsedRow,
  RowEdit,
  RowToImport,
  WizardState,
} from '../types';
import { UploadStep } from './steps/UploadStep';
import { MapColumnsStep } from './steps/MapColumnsStep';
import { ReviewStep } from './steps/ReviewStep';
import { ImportStep } from './steps/ImportStep';

const initialWizardState: WizardState = {
  fileKey: null,
  filename: null,
  detectedColumns: [],
  sampleRows: [],
  rowCount: 0,
  columnMapping: null,
  accountId: null,
  startRow: 0,
  currency: 'BRL',
  analyzedRows: [],
  rowEdits: {},
  jobId: null,
};

/**
 * ImportWizard — orchestrates the 4-step CSV import flow.
 *
 * Step 0: Upload — pick + upload a CSV, see column preview
 * Step 1: Map Columns — choose CSV → transaction field mapping, run analysis
 * Step 2: Review — inspect parsed rows, skip/include, assign categories
 * Step 3: Import — execute background job, poll for status
 */
export function ImportWizard() {
  const { familyId } = useParams<{ familyId: string }>();
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [wizardState, setWizardState] = useState<WizardState>(initialWizardState);

  // Step labels are translated so the stepper renders in the user's locale.
  // These are defined inside the component so the translation hook is in scope.
  const steps = [
    t('imports.stepUpload'),
    t('imports.stepMapColumns'),
    t('imports.stepReview'),
    t('imports.stepImport'),
  ];

  // ── Step 0: Upload ──────────────────────────────────────────────────────────

  const handleUploaded = useCallback((result: ImportUploadResponse) => {
    setWizardState((previous) => ({
      ...previous,
      fileKey: result.file_key,
      filename: result.filename ?? null,
      detectedColumns: result.detected_columns,
      sampleRows: result.sample_rows,
      rowCount: result.row_count,
      // Reset downstream state when a new file is uploaded
      columnMapping: null,
      analyzedRows: [],
      rowEdits: {},
    }));
    setActiveStep(1);
  }, []);

  // ── Step 1: Analyze ─────────────────────────────────────────────────────────

  const handleAnalyzed = useCallback(
    (
      result: AnalyzeResponse,
      mapping: ColumnMapping,
      accountId: string,
      currency: string,
      startRow: number,
    ) => {
      // Pre-populate rowEdits: duplicate rows default to skip=true
      const rowEdits: Record<number, RowEdit> = {};
      result.rows.forEach((parsedRow: ParsedRow) => {
        rowEdits[parsedRow.row_index] = {
          skip: parsedRow.is_duplicate,
          description: parsedRow.description,
          categoryId: undefined,
        };
      });

      setWizardState((previous) => ({
        ...previous,
        columnMapping: mapping,
        accountId,
        currency,
        startRow,
        analyzedRows: result.rows,
        rowEdits,
      }));
      setActiveStep(2);
    },
    []
  );

  // ── Step 2: Review edits ────────────────────────────────────────────────────

  const handleEditRow = useCallback((rowIndex: number, edit: Partial<RowEdit>) => {
    setWizardState((previous) => ({
      ...previous,
      rowEdits: {
        ...previous.rowEdits,
        [rowIndex]: { ...previous.rowEdits[rowIndex], ...edit },
      },
    }));
  }, []);

  const includedRows: RowToImport[] = wizardState.analyzedRows
    .filter((parsedRow) => {
      if (parsedRow.parse_error) return false;
      const edit = wizardState.rowEdits[parsedRow.row_index];
      return !(edit?.skip ?? parsedRow.is_duplicate);
    })
    .map((parsedRow) => {
      const edit = wizardState.rowEdits[parsedRow.row_index];
      return {
        row_index: parsedRow.row_index,
        transaction_date: parsedRow.transaction_date!,
        amount: String(parsedRow.amount),
        transaction_type: edit?.transactionType ?? parsedRow.transaction_type!,
        description: edit?.description ?? parsedRow.description,
        category_id: edit?.categoryId,
      };
    });

  const executeRequest: ExecuteRequest = {
    file_key: wizardState.fileKey ?? '',
    filename: wizardState.filename ?? undefined,
    account_id: wizardState.accountId ?? '',
    currency: wizardState.currency,
    rows: includedRows,
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleBack = () => setActiveStep((previous) => Math.max(0, previous - 1));

  // Reset everything back to the initial Upload step. Used by the
  // "Start Over" button on the final step when an import failed. We can't
  // just navigate to the same route because React Router will keep this
  // component mounted with its existing state.
  const handleStartOver = useCallback(() => {
    setWizardState(initialWizardState);
    setActiveStep(0);
  }, []);

  // The Review step shows a wide AG Grid table, so on that step we let the
  // wizard span the full container width. Other steps keep a narrower
  // 900px width so the form fields stay readable.
  const wizardMaxWidth = activeStep === 2 ? '100%' : 900;

  return (
    <Box sx={{ maxWidth: wizardMaxWidth, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('imports.pageTitle')}
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper sx={{ p: 3 }}>
        {/* Step 0 — Upload */}
        {activeStep === 0 && (
          <UploadStep onUploaded={handleUploaded} />
        )}

        {/* Step 1 — Map Columns */}
        {activeStep === 1 && wizardState.fileKey && (
          <MapColumnsStep
            detectedColumns={wizardState.detectedColumns}
            fileKey={wizardState.fileKey}
            familyId={familyId!}
            wizardState={wizardState}
            onAnalyzed={handleAnalyzed}
          />
        )}

        {/* Step 2 — Review */}
        {activeStep === 2 && (
          <>
            <ReviewStep
              analyzedRows={wizardState.analyzedRows}
              rowEdits={wizardState.rowEdits}
              familyId={familyId!}
              onEditRow={handleEditRow}
            />
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                variant="outlined"
              >
                {t('imports.backButton')}
              </Button>
              <Button
                variant="contained"
                onClick={() => setActiveStep(3)}
                disabled={includedRows.length === 0}
              >
                {t('imports.importButton', { count: includedRows.length })}
              </Button>
            </Box>
          </>
        )}

        {/* Step 3 — Import & Status */}
        {activeStep === 3 && (
          <ImportStep executeRequest={executeRequest} onStartOver={handleStartOver} />
        )}
      </Paper>
    </Box>
  );
}
