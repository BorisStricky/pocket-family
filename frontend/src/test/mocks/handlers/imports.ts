// src/test/mocks/handlers/imports.ts
// MSW handlers for the CSV import wizard endpoints (/imports/*)
//
// Provides an in-memory store that simulates the 4-endpoint wizard flow:
//   1. POST /imports/upload   — accepts a CSV file, returns file_key + columns
//   2. POST /imports/analyze  — parses rows, flags duplicates
//   3. POST /imports/execute  — dispatches a background job, returns job_id
//   4. GET  /imports/jobs/:id — polled to track job progress
//
// The job-status handler advances the job state every time it is called so
// tests that poll see the natural pending -> started -> done transition.
// Tests can override any handler via server.use() to simulate errors or
// different responses.

import { http, HttpResponse } from 'msw';
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ExecuteRequest,
  ImportUploadResponse,
  JobStatusResponse,
  ParsedRow,
} from '@/features/imports/types';

const API_BASE = 'http://localhost:8000';

// Internal representation of a job tracked by the polling endpoint.
// We use a 3-poll progression (pending -> started -> done) so tests can
// observe each state without waiting for real timers to expire.
interface JobState {
  status: 'pending' | 'started' | 'done' | 'failed';
  imported: number;
  total: number;
  error?: string;
  // pollCount tracks how many times GET /imports/jobs/:id has been called
  // for this job_id so we can deterministically advance the state.
  pollCount: number;
  // forceStatus lets tests pin the job to a specific status (e.g. always "failed")
  forceStatus?: 'pending' | 'started' | 'done' | 'failed';
}

// In-memory job store keyed by job_id. Reset between tests via resetImportStore().
const importJobStore: Map<string, JobState> = new Map();

// Default upload response — three columns plus 2 sample rows.
// Column names ("Date", "Valor", "Description") are chosen to exercise the
// auto-mapping logic in MapColumnsStep:
//   - "Date" matches the date keyword set
//   - "Valor" matches the amount keyword set (Portuguese)
//   - "Description" matches the description keyword set
const defaultUploadResponse: ImportUploadResponse = {
  file_key: 'tenant-uuid-456/test-file-key.csv',
  detected_columns: ['Date', 'Valor', 'Description'],
  sample_rows: [
    { Date: '2025-01-15', Valor: '-50.00', Description: 'Supermarket' },
    { Date: '2025-01-16', Valor: '-25.50', Description: 'Coffee shop' },
  ],
  row_count: 3,
};

// Default analyze response — three rows covering each state the Review step
// needs to handle: a unique row, a duplicate (pre-skipped), and a parse error.
const defaultAnalyzeRows: ParsedRow[] = [
  {
    row_index: 0,
    transaction_date: '2025-01-15',
    amount: '50.00',
    transaction_type: 'expense',
    description: 'Supermarket',
    is_duplicate: false,
  },
  {
    row_index: 1,
    transaction_date: '2025-01-16',
    amount: '25.50',
    transaction_type: 'expense',
    description: 'Coffee shop',
    is_duplicate: true,
    matching_transaction_id: 'existing-transaction-uuid',
  },
  {
    row_index: 2,
    is_duplicate: false,
    parse_error: 'Unable to parse date "not-a-date"',
  },
];

const defaultAnalyzeResponse: AnalyzeResponse = {
  rows: defaultAnalyzeRows,
  duplicate_count: 1,
  parse_error_count: 1,
  date_range_start: '2025-01-15',
  date_range_end: '2025-01-16',
};

/**
 * Reset the import job store to an empty state.
 * Call this in beforeEach to keep tests isolated.
 */
export function resetImportStore(): void {
  importJobStore.clear();
}

/**
 * Seed a job with a specific final status so tests can deterministically
 * exercise the success or failure UI without running through polling steps.
 *
 * @example
 * seedImportJob('job-abc', { status: 'done', imported: 5, total: 5 });
 * seedImportJob('job-fail', { status: 'failed', error: 'Boom!' });
 */
export function seedImportJob(jobId: string, state: Partial<JobState> & { status: JobState['status'] }): void {
  importJobStore.set(jobId, {
    imported: 0,
    total: 0,
    pollCount: 0,
    forceStatus: state.status,
    ...state,
  });
}

export const importHandlers = [
  // POST /imports/upload — accept a multipart CSV upload and return preview info
  http.post(`${API_BASE}/imports/upload`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    // The wizard sends FormData; we don't need to inspect the bytes — we just
    // return the canned preview so the wizard advances to the mapping step.
    return HttpResponse.json(defaultUploadResponse);
  }),

  // POST /imports/analyze — return parsed rows with duplicate flags
  http.post(`${API_BASE}/imports/analyze`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    // Consume the body so tests can inspect it via server.use() overrides
    // if they need to assert on the mapping payload sent by the wizard.
    await request.json() as AnalyzeRequest;

    return HttpResponse.json(defaultAnalyzeResponse);
  }),

  // POST /imports/execute — dispatch the import job and return a job_id
  http.post(`${API_BASE}/imports/execute`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json() as ExecuteRequest;

    // Generate a deterministic-ish job id and pre-seed the job store with
    // the total row count from the request so progress updates make sense.
    const jobId = `import-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    importJobStore.set(jobId, {
      status: 'pending',
      imported: 0,
      total: body.rows?.length ?? 0,
      pollCount: 0,
    });

    return HttpResponse.json({ job_id: jobId });
  }),

  // GET /imports/jobs/:job_id — poll job status. State advances each call:
  //   poll 1 -> pending, poll 2 -> started, poll 3+ -> done
  // Unless seedImportJob() pinned the job to a specific final status, in
  // which case we return that status on every poll.
  http.get(`${API_BASE}/imports/jobs/:job_id`, ({ params, request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const jobId = params.job_id as string;
    const jobState = importJobStore.get(jobId);

    if (!jobState) {
      // Unknown job — return an "unknown" status response so the polling
      // hook still resolves cleanly without throwing.
      const unknownResponse: JobStatusResponse = {
        job_id: jobId,
        status: 'unknown',
      };
      return HttpResponse.json(unknownResponse);
    }

    jobState.pollCount += 1;

    // When a test pinned a forceStatus we always return it; otherwise we
    // walk through the natural state progression to mimic the worker.
    if (jobState.forceStatus) {
      const responseBody: JobStatusResponse = {
        job_id: jobId,
        status: jobState.forceStatus,
        imported: jobState.imported,
        total: jobState.total,
        error: jobState.error,
      };
      return HttpResponse.json(responseBody);
    }

    // Auto-advance the natural progression based on pollCount.
    // Poll 1 stays at pending; poll 2 transitions to started; poll 3 finishes.
    if (jobState.pollCount === 1) {
      jobState.status = 'pending';
    } else if (jobState.pollCount === 2) {
      jobState.status = 'started';
      jobState.imported = Math.floor(jobState.total / 2);
    } else {
      jobState.status = 'done';
      jobState.imported = jobState.total;
    }

    const responseBody: JobStatusResponse = {
      job_id: jobId,
      status: jobState.status,
      imported: jobState.imported,
      total: jobState.total,
    };
    return HttpResponse.json(responseBody);
  }),
];

// Export the default canned responses so individual tests can build
// custom variations on top of them (e.g. add more rows, change columns).
export { defaultUploadResponse, defaultAnalyzeRows, defaultAnalyzeResponse };
