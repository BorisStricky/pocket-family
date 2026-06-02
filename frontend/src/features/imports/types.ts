// src/features/imports/types.ts
// TypeScript types for the CSV import wizard, matching the backend Pydantic schemas.

/**
 * Maps CSV column names to transaction fields.
 * Only date and amount are required; type is inferred from sign when omitted.
 */
export interface ColumnMapping {
  date_column: string;
  amount_column: string;
  description_column?: string;
  type_column?: string;
}

/**
 * Response from POST /imports/upload — contains file reference and column preview.
 */
export interface ImportUploadResponse {
  file_key: string;
  filename?: string;
  detected_columns: string[];
  sample_rows: Record<string, string>[];
  row_count: number;
}

/**
 * Request body for POST /imports/analyze.
 */
export interface AnalyzeRequest {
  file_key: string;
  account_id: string;
  column_mapping: ColumnMapping;
  start_row?: number;
  currency?: string;
  // When true, flips sign-based classification: positive amounts become expenses
  // and negative amounts income (credit-card statement convention). Defaults to
  // false on the backend (bank/debit convention).
  positive_amounts_are_expenses?: boolean;
}

/**
 * A single transaction row parsed from the CSV.
 * parse_error is set when the row could not be parsed; other fields are null.
 */
export interface ParsedRow {
  row_index: number;
  transaction_date?: string;   // YYYY-MM-DD
  amount?: string;             // decimal string, always positive
  transaction_type?: 'expense' | 'income';
  description?: string;
  is_duplicate: boolean;
  matching_transaction_id?: string;
  parse_error?: string;
}

/**
 * Response from POST /imports/analyze.
 */
export interface AnalyzeResponse {
  rows: ParsedRow[];
  duplicate_count: number;
  parse_error_count: number;
  date_range_start?: string;
  date_range_end?: string;
}

/**
 * A single transaction row confirmed by the user for import.
 */
export interface RowToImport {
  row_index: number;
  transaction_date: string;   // YYYY-MM-DD
  amount: string;             // decimal string
  transaction_type: string;   // "expense" or "income"
  description?: string;
  category_id?: string;
}

/**
 * Request body for POST /imports/execute.
 */
export interface ExecuteRequest {
  file_key: string;
  filename?: string;
  account_id: string;
  currency?: string;
  rows: RowToImport[];
}

/**
 * Response from POST /imports/execute — the Celery job ID for polling.
 */
export interface ExecuteResponse {
  job_id: string;
}

/**
 * Response from GET /imports/jobs/{job_id}.
 * Poll every 2 seconds until status is "done" or "failed".
 */
export interface JobStatusResponse {
  job_id: string;
  status: 'pending' | 'started' | 'done' | 'failed' | 'unknown';
  imported?: number;
  total?: number;
  error?: string;
}

/**
 * Per-row edits the user makes during the Review step.
 * skip=true means the row will be excluded from the import payload.
 * transactionType overrides the type inferred from the CSV (e.g. when
 * the sign-based inference is wrong for a particular row).
 */
export interface RowEdit {
  categoryId?: string;
  description?: string;
  transactionType?: 'expense' | 'income';
  skip: boolean;
}

/**
 * Status of a CSV import job stored in the history table.
 */
export type ImportJobStatus = 'pending' | 'started' | 'done' | 'failed';

/**
 * One row in the import history list returned by GET /imports/jobs.
 */
export interface ImportJobRead {
  id: string;
  account_id: string;
  account_name?: string;
  filename?: string;
  total_rows: number;
  imported_rows: number;
  status: ImportJobStatus;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

/**
 * All state shared across the wizard steps.
 * The client holds this state — no server-side session is used.
 */
export interface WizardState {
  // Step 0 (Upload) outputs
  fileKey: string | null;
  filename: string | null;
  detectedColumns: string[];
  sampleRows: Record<string, string>[];
  rowCount: number;

  // Step 1 (Map Columns) inputs
  columnMapping: ColumnMapping | null;
  accountId: string | null;
  startRow: number;
  currency: string;

  // Step 2 (Review) outputs from analyze + user edits
  analyzedRows: ParsedRow[];
  rowEdits: Record<number, RowEdit>;   // keyed by row_index

  // Step 3 (Import) output
  jobId: string | null;
}
