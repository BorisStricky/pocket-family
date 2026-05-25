# CSV Import Service — Full-Stack Implementation

**Branch:** `import-service` → `development`
**Last Updated:** 2026-05-24

## Overview

This branch delivers the end-to-end CSV transaction import feature: a 4-step frontend wizard backed by a new `import-service` microservice that performs atomic bulk inserts via a Celery background worker. Users can now bulk-import historical bank statement exports rather than entering transactions one at a time. The architecture is designed to scale from a local Redis/Docker-volume setup all the way to AWS SQS + S3 by changing two environment variables.

## Goals Achieved

- ✅ **4-Step Import Wizard**: Upload → Map Columns → Review & Edit → Import with real-time progress polling
- ✅ **Duplicate Detection**: Analyze step flags rows already present in the target account (matching date + amount)
- ✅ **Standalone Import Microservice**: `import-service/` Celery worker runs in its own container, keeping bulk inserts off the FastAPI async event loop
- ✅ **Storage Abstraction**: `StorageAdapter` interface supports both local Docker volume (dev) and AWS S3 (prod) without code changes
- ✅ **SQS-Ready Queue**: Kombu's built-in SQS transport activates by setting `BROKER_URL=sqs://` — no code changes needed
- ✅ **Atomic Bulk Insert**: All transactions + account balance update committed in a single DB transaction; partial imports cannot occur
- ✅ **Multi-Locale Amount Parsing**: Handles R$, $, €, accounting parentheses, European separators (1.234,56), English separators, and inferred type from sign
- ✅ **Role Enforcement**: VIEWER members cannot trigger imports (403 at the execute endpoint)
- ✅ **Transactions Page Entry Point**: "Import CSV" button added alongside "Add Transaction" for non-viewer members

**Reference:** [CSV Import Plan](../csv-import-plan.md)

---

## Architecture & Tech Stack Changes

### New: Import Microservice Pattern

```
Frontend Wizard (4 steps)
  ↓ HTTP
Main Backend /imports/* API  ──file──→  Storage (Docker volume / S3)
  ↓ queue (Redis or SQS)                     ↑ read
import-service (Celery worker)  ────────────┘
  ↓ SQL (sync psycopg2)
PostgreSQL (same DB, transactions table)
```

**Key design decisions:**

- **Client-held state**: The wizard stores `file_key` and `column_mapping` in React state and re-sends them on each API call. No server-side session is needed between steps.
- **Celery result backend for job status**: Progress tracking reuses Celery's built-in Redis result backend — no new database table required.
- **Sync driver for the worker**: The `import-service` uses `psycopg2` (sync SQLAlchemy) because Celery tasks run outside asyncio context. The main backend continues to use `asyncpg` (async).
- **Dispatch-only Celery client**: `backend/api/app/celery_client.py` is a minimal Celery instance that dispatches tasks but never runs workers. The task name `"import_service.execute_import"` must exactly match the `@task(name=...)` registration in the worker.
- **Tenant-scoped file keys**: `file_key` is always prefixed with `{tenant_id}/`, allowing the backend to reject cross-tenant file access without a DB lookup.
- **No retry on failure**: CSV imports are not idempotent. `task_reject_on_worker_lost=True` prevents double-imports if the worker crashes mid-task.

### New Dependencies

**Backend (`backend/pyproject.toml`):**
- `python-dateutil>=2.9.0` — flexible date parsing (DD/MM/YYYY, MM-DD-YYYY, and many others)
- `kombu[sqs]>=5.3.0` — enables SQS as a Celery broker transport
- `python-multipart>=0.0.29` — required for FastAPI multipart file uploads

**Import Service (`import-service/pyproject.toml`):**
- `celery`, `redis`, `sqlalchemy[psycopg2]`, `boto3`, `pydantic-settings`

### Infrastructure Changes

**Dev compose (`docker-compose.dev.yml`):** Added `redis-dev`, `import-worker-dev`, shared `csv-uploads-dev` volume, `pfin-dev-net` bridge network, and healthchecks on `db-dev`.

**Production compose (`docker-compose.yaml`):** Added `redis`, `import-worker` services with resource limits (`0.5 cpu / 256M`). Backend gains `BROKER_URL`, `RESULT_BACKEND`, `STORAGE_BACKEND`, `S3_BUCKET`, `S3_REGION` env vars and mounts the `csv-uploads` volume.

---

## Directory Structure

```
import-service/                         🆕 NEW microservice directory
├── Dockerfile                          🆕 Python 3.12 slim worker image
├── pyproject.toml                      🆕 Worker package dependencies
└── app/
    ├── __init__.py                     🆕 Package marker
    ├── celery_app.py                   🆕 Celery factory (Redis or SQS broker)
    ├── config.py                       🆕 Pydantic settings (env-driven)
    ├── db.py                           🆕 Sync SQLAlchemy engine (psycopg2)
    ├── storage/
    │   ├── __init__.py                 🆕 get_storage() factory
    │   ├── base.py                     🆕 Abstract StorageAdapter interface
    │   ├── local.py                    🆕 Local filesystem adapter
    │   └── s3.py                       🆕 S3 adapter (boto3)
    └── tasks/
        ├── __init__.py                 🆕 Package marker
        └── import_csv.py              🆕 execute_import Celery task

backend/api/app/
├── celery_client.py                    🆕 Dispatch-only Celery client
├── routers/imports.py                  🆕 /imports/* API router (4 endpoints)
├── storage/
│   ├── __init__.py                     🆕 get_storage_backend() factory
│   ├── base.py                         🆕 StorageAdapter interface (mirrors import-service)
│   ├── local.py                        🆕 LocalAdapter
│   └── s3.py                           🆕 S3Adapter
├── main.py                             ✏️ Registered imports router
├── schemas.py                          ✏️ Added 9 new import schemas
└── pyproject.toml                      ✏️ Added 3 new dependencies

frontend/src/features/imports/          🆕 NEW feature module
├── api/importsApi.ts                   🆕 4 API functions (upload, analyze, execute, poll)
├── types.ts                            🆕 TypeScript interfaces matching backend schemas
├── components/
│   ├── ImportWizard.tsx                🆕 Root wizard: MUI Stepper + shared state
│   └── steps/
│       ├── UploadStep.tsx              🆕 File picker, drag-and-drop, column preview
│       ├── MapColumnsStep.tsx          🆕 Column dropdowns, account selector, analyze trigger
│       ├── ReviewStep.tsx              🆕 Row table: skip/include toggles, category assignment
│       └── ImportStep.tsx             🆕 Execute button + live progress polling display
└── hooks/
    ├── useUploadCsv.ts                 🆕 useMutation for upload step
    ├── useAnalyzeCsv.ts                🆕 useMutation for analyze step
    ├── useExecuteImport.ts             🆕 useMutation for execute step
    └── useJobStatus.ts                 🆕 useQuery polling (2 s interval, auto-stops)

frontend/src/features/transactions/pages/
├── ImportCsvPage.tsx                   ✏️ Replaced placeholder with <ImportWizard />
└── TransactionsPage.tsx                ✏️ Added "Import CSV" button next to "Add Transaction"

docs/
└── csv-import-plan.md                  🆕 Implementation plan and architecture decisions
```

---

## Files Changed — Detailed Breakdown

### Import Microservice

**`import-service/app/tasks/import_csv.py`** — NEW
- **Purpose**: The core Celery task `execute_import`. Receives pre-parsed transaction rows from the backend, performs a single `session.add_all()` + account balance update in one atomic commit, then deletes the uploaded CSV.
- **Key design**: Updates Celery state to `STARTED` with progress metadata immediately on entry so the backend's polling endpoint can show progress before the first insert.
- **Error handling**: No retry on failure (`task_reject_on_worker_lost=True`). On any exception, SQLAlchemy rolls back and Celery marks the task `FAILURE`. The user must re-upload.

**`import-service/app/celery_app.py`** — NEW
- **Purpose**: Celery application factory. Configures JSON serialization, `task_track_started=True` (needed for STARTED state), and `task_acks_late=True` (task re-queued if worker crashes before completion).
- **Broker transparency**: The same code path handles both `redis://` and `sqs://` broker URLs via kombu's transport registry.

**`import-service/app/config.py`** — NEW
- **Purpose**: Pydantic `BaseSettings` that reads all config from environment variables. Supports `STORAGE_BACKEND=local|s3`, `LOCAL_UPLOAD_DIR`, `S3_BUCKET`, `S3_REGION`, and connection URLs.

**`import-service/app/storage/`** — NEW
- **Purpose**: Mirrors the identical interface in `backend/api/app/storage/`. `get_storage()` reads `STORAGE_BACKEND` and returns either `LocalAdapter` or `S3Adapter`. Both implement `read()`, `write()`, `delete()` on the abstract `StorageAdapter` base class.

---

### Backend API

**`backend/api/app/routers/imports.py`** — NEW
- **Purpose**: 4-endpoint router implementing the wizard's server side.
- **Endpoints**:
  | Endpoint | Step | Description |
  |----------|------|-------------|
  | `POST /imports/upload` | 1 | Accept ≤5 MB `.csv`, write to storage, parse headers + 5 sample rows. Return `file_key, detected_columns, sample_rows, row_count`. |
  | `POST /imports/analyze` | 2 | Re-parse CSV with user's `column_mapping`. For each row: parse date (ISO then dateutil fallback), parse amount (multi-locale), infer type from sign. Query existing transactions in date range to flag duplicates by `(date, abs_amount)`. |
  | `POST /imports/execute` | 3 | Validate account ownership, reject VIEWER role, dispatch `execute_import` Celery task with JSON-serialized rows. Return `job_id`. |
  | `GET /imports/jobs/{job_id}` | 4 | Map Celery states `PENDING/STARTED/SUCCESS/FAILURE` → `pending/started/done/failed`. Returns progress counts. Returns `status=unknown` if Redis is unreachable. |
- **Security**: `_validate_file_key_ownership()` ensures `file_key` is prefixed with the authenticated tenant's UUID — prevents tenant A from referencing tenant B's uploaded files.

**`backend/api/app/celery_client.py`** — NEW
- **Purpose**: Minimal Celery instance for dispatch only. Reads `BROKER_URL` and `RESULT_BACKEND` from environment. The task name literal `"import_service.execute_import"` must stay in sync with the worker's `@task(name=...)` decorator.

**`backend/api/app/schemas.py`** — MODIFIED
- **Key changes**: Added 9 new Pydantic schemas for the import wizard: `ImportUploadResponse`, `ColumnMapping`, `AnalyzeRequest`, `ParsedRow`, `AnalyzeResponse`, `RowToImport`, `ExecuteRequest`, `ExecuteResponse`, `JobStatusResponse`.

---

### Frontend Feature

**`frontend/src/features/imports/components/ImportWizard.tsx`** — NEW
- **Purpose**: Root component that manages a 4-step MUI `Stepper` and all shared wizard state (`WizardState`). State flows down to each step via props; the wizard holds `file_key`, `column_mapping`, `analyzedRows`, and `rowEdits` so no server session is needed.
- **Key behavior**: When a new file is uploaded, downstream state (`columnMapping`, `analyzedRows`, `rowEdits`) is reset to prevent stale data carrying over.
- **Pre-population**: After the analyze step, duplicate rows are pre-marked `skip=true` in `rowEdits`.

**`frontend/src/features/imports/components/steps/UploadStep.tsx`** — NEW
- **Purpose**: File picker with dashed drop-zone UI, file size display, and a scrollable 5-row column preview table after upload.

**`frontend/src/features/imports/components/steps/MapColumnsStep.tsx`** — NEW
- **Purpose**: Four `<Select>` dropdowns mapping CSV columns to `date`, `amount`, `description`, `type` fields. Also includes account selector and currency selector. Triggers the analyze API call and advances to Review.

**`frontend/src/features/imports/components/steps/ReviewStep.tsx`** — NEW
- **Purpose**: AG Grid or table showing all parsed rows with `is_duplicate` badges, `parse_error` highlights, skip/include toggles, editable description field, and category selector per row.

**`frontend/src/features/imports/components/steps/ImportStep.tsx`** — NEW
- **Purpose**: Executes the import on mount, then polls `useJobStatus` every 2 seconds. Displays a progress bar (`imported / total`), success confirmation, or error message.

**`frontend/src/features/imports/hooks/useJobStatus.ts`** — NEW
- **Purpose**: `useQuery` with a dynamic `refetchInterval`: returns `2000` ms while `status` is `pending` or `started`, and `false` (stops polling) when `status` is `done` or `failed`.

**`frontend/src/features/imports/api/importsApi.ts`** — NEW
- **Purpose**: 4 typed API functions wrapping `apiFetch`. `uploadCsv` uses `FormData` (no `Content-Type` header — browser sets multipart boundary automatically).

**`frontend/src/features/imports/types.ts`** — NEW
- **Purpose**: TypeScript interfaces that exactly mirror the backend Pydantic schemas. `WizardState` is the canonical shape for all cross-step data.

**`frontend/src/features/transactions/pages/ImportCsvPage.tsx`** — MODIFIED
- **Key change**: Replaced "under construction" placeholder with `<ImportWizard />`.

**`frontend/src/features/transactions/pages/TransactionsPage.tsx`** — MODIFIED
- **Key change**: Added "Import CSV" button (outlined, `FileUploadIcon`) alongside "Add Transaction". Both are hidden for VIEWER role. Navigates to `/app/:familyId/import-csv`.

---

## Testing Strategy

No automated tests were added in this pass — this is a first-pass implementation. The following areas need test coverage before the feature can be considered production-ready:

**Backend (pytest):**
- `POST /imports/upload` — valid CSV, oversized file (413), non-CSV extension (422), cross-tenant file key (403)
- `POST /imports/analyze` — happy path, missing column, all-duplicates, parse errors, date format variations
- `POST /imports/execute` — VIEWER rejection, missing account (404), dispatches correct task payload
- `GET /imports/jobs/{job_id}` — each status mapping (pending, started, done, failed, unknown)
- `execute_import` task — atomic commit, balance delta, cleanup on success, rollback on failure

**Frontend (Vitest + RTL):**
- Full wizard flow (upload → map → review → import) with MSW handlers
- Duplicate row pre-selection in Review step
- Poll auto-stop behavior in Import step
- Error states at each step

---

## Migration Notes

- **No database migrations required** — the import feature writes to the existing `transactions` table. No new tables were added.
- **New environment variables** required for the backend and import worker (both compose files already include them):
  - `BROKER_URL` — Celery broker (default: `redis://localhost:6379/0`)
  - `RESULT_BACKEND` — Celery result store (default: `redis://localhost:6379/1`)
  - `STORAGE_BACKEND` — `local` or `s3` (default: `local`)
  - `LOCAL_UPLOAD_DIR` — filesystem path for CSV uploads (default: `/uploads`)
  - `S3_BUCKET`, `S3_REGION` — required when `STORAGE_BACKEND=s3`

---

## Performance Impact

- Import processing runs off the FastAPI event loop in a dedicated container — no impact on API latency for non-import requests.
- The `/imports/analyze` endpoint performs a single date-range SQL query against `transactions` for duplicate detection, regardless of CSV row count — O(1) DB round-trips.
- File I/O in `upload` and `analyze` endpoints uses `asyncio.to_thread()` to avoid blocking the async event loop.

---

## Next Steps / Follow-up Work

- **Write tests** — see Testing Strategy above; the feature has no automated coverage yet
- **Alembic migration check** — confirm no schema changes are needed once `source` column on `Transaction` is finalized (currently hardcoded to `"manual"`)
- **Error UX polish** — per-row parse error details could be rendered more helpfully in the Review step
- **Idempotency token** — consider adding a client-generated idempotency key to `/imports/execute` to prevent duplicate jobs from double-taps
- **S3 lifecycle policy** — uploaded CSVs are deleted on success but could linger on failure; a 24-hour S3 expiry rule would act as a safety net

---

## Related Documentation

- [CSV Import Plan](../csv-import-plan.md) — original implementation plan and architecture decisions
- [System Architecture](../SystemArchitecture.md) — multi-tenant design and backend patterns
- [North Star](../north_star.md) — domain model invariants (tenant_id on all records, role enforcement)
- [Sprint 7 Release](Sprint_7_Release.md) — previous sprint for context on budgets feature
