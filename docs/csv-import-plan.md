# CSV Import Feature — Implementation Plan

## Context

Users need to bulk-import historical transactions from CSV exports (e.g. bank statements). The feature is a multi-step wizard in the frontend that guides the user through upload → column mapping → duplicate review → atomic import. The processing is offloaded to a separate `import-service` (Celery worker) in its own Docker container, so the main backend never blocks on bulk inserts. The service is configurable to run locally (Redis broker + Docker volume) or on AWS (SQS broker + S3 storage).

A placeholder route `/app/:familyId/import-csv` and `ImportCsvPage` already exist.

---

## Architecture

```
Frontend Wizard (4 steps)
  ↓ HTTP
Main Backend /imports/* API  ──file──→  Storage (volume / S3)
  ↓ queue (Redis or SQS)                  ↑ read
Import Service (Celery worker)  ─────────┘
  ↓ SQL (sync psycopg2)
PostgreSQL (same DB, same transaction table)
```

**Key design decisions:**
- Client holds all wizard state between steps (no server-side session). `file_key` and `column_mapping` are passed to each API call.
- Celery's built-in result backend (Redis) tracks job status — no new DB table needed.
- Storage is abstracted: `LocalAdapter` (Docker volume) or `S3Adapter` (boto3). Both backend and import-service instantiate the same adapter class.
- Celery supports SQS natively via kombu's `sqs://` broker URL — no code changes needed to switch queues.
- Import worker uses sync SQLAlchemy (`psycopg2`) since Celery tasks run outside asyncio context.

---

## New Files to Create

### `import-service/` (new directory at project root)

```
import-service/
├── Dockerfile
├── pyproject.toml
└── app/
    ├── __init__.py
    ├── config.py          # Pydantic Settings: BROKER_URL, RESULT_BACKEND, STORAGE_BACKEND, DB_URL, etc.
    ├── celery_app.py      # Celery factory (broker from config; SQS works via sqs:// URL)
    ├── db.py              # Sync SQLAlchemy engine + SessionLocal
    ├── models.py          # Copied Transaction/Account enum models (same DB tables)
    ├── storage/
    │   ├── base.py        # Abstract StorageAdapter(read, write, delete)
    │   ├── local.py       # LocalAdapter — reads/writes /uploads volume
    │   ├── s3.py          # S3Adapter — uses boto3
    │   └── __init__.py    # get_storage() factory reads STORAGE_BACKEND env
    └── tasks/
        ├── __init__.py
        └── import_csv.py  # execute_import Celery task
```

**`execute_import` task logic:**
1. `self.update_state(state="STARTED", meta={"imported": 0, "total": N})`
2. Load CSV bytes from storage via `file_key`
3. Create all `Transaction` rows in a single `session.add_all()` + atomic `session.commit()`
4. Update `Account.balance` by the net delta (same atomic commit)
5. Delete the uploaded file from storage
6. Return `{"status": "done", "imported": N}`
7. On any error: `session.rollback()`, re-raise (no retry — user must re-upload)

### `backend/api/app/storage/` (new, mirrors import-service storage/)
Same `base.py`, `local.py`, `s3.py`, `__init__.py` so the backend can write uploaded files.

### `backend/api/app/routers/imports.py` (new router)

| Endpoint | Description |
|----------|-------------|
| `POST /imports/upload` | Accept multipart CSV (≤5 MB), generate `file_key = {tenant_id}/{uuid4()}.csv`, write to storage, parse headers + 5 sample rows. Return `file_key, detected_columns, sample_rows, row_count`. |
| `POST /imports/analyze` | Accept `file_key, account_id, column_mapping, start_row, currency`. Re-parse CSV. For each row: parse date (dateutil), parse amount (strip symbols/commas → Decimal), infer `transaction_type` from sign if no type column. Query existing transactions matching `(account_id, date, abs(amount))` for the CSV date range. Return `rows[]` with `is_duplicate` flag. |
| `POST /imports/execute` | Validate account belongs to tenant, user is not VIEWER. Dispatch `execute_import` Celery task. Return `job_id`. |
| `GET /imports/jobs/{job_id}` | Poll `AsyncResult(job_id)` on Celery client. Map PENDING/STARTED/SUCCESS/FAILURE → `status: pending/started/done/failed` with progress counts. |

### `backend/api/app/celery_client.py` (new — dispatch-only Celery instance)
```python
celery_client = Celery(broker=settings.broker_url, backend=settings.result_backend)
```
The backend only dispatches tasks, never runs workers.

### Frontend: `frontend/src/features/imports/` (new feature module)
```
features/imports/
├── types.ts                   # TypeScript types matching backend schemas
├── api/importsApi.ts          # uploadCsv, analyzeCsv, executeImport, getJobStatus
├── hooks/
│   ├── useUploadCsv.ts        # useMutation
│   ├── useAnalyzeCsv.ts       # useMutation
│   ├── useExecuteImport.ts    # useMutation
│   └── useJobStatus.ts        # useQuery with refetchInterval (2s until done/failed)
└── components/
    ├── ImportWizard.tsx        # Root: MUI Stepper + shared WizardState in useState
    └── steps/
        ├── UploadStep.tsx      # File input → upload → show column preview table
        ├── MapColumnsStep.tsx  # Account select, currency, start row, column dropdowns + auto-propose
        ├── ReviewStep.tsx      # Table of all rows: duplicate chip, category select, description field
        └── ImportStep.tsx      # Execute + poll status → success/failure display
```

**Wizard shared state (client-side only):**
```typescript
interface WizardState {
  fileKey: string | null;
  detectedColumns: string[];
  sampleRows: Record<string, string>[];
  rowCount: number;
  columnMapping: ColumnMapping | null;
  accountId: string | null;
  startRow: number;        // default 0
  currency: string;        // default BRL
  analyzedRows: ParsedRow[];
  rowEdits: Record<number, { categoryId?: string; description?: string; skip: boolean }>;
  jobId: string | null;
}
```

**Auto-propose column mapping (client-side fuzzy match, no API call):**
Match `detectedColumns` against keyword sets: `["date","data","fecha"]`, `["amount","valor","total","debit","credit"]`, `["description","desc","memo","narration"]`, `["type","tipo"]`.

**Duplicate default:** Pre-set `skip: true` for rows where `is_duplicate === true`. User can uncheck to include anyway.

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/api/app/schemas.py` | Add `ImportUploadResponse`, `ColumnMapping`, `AnalyzeRequest`, `ParsedRow`, `AnalyzeResponse`, `RowToImport`, `ExecuteRequest`, `ExecuteResponse`, `JobStatusResponse` |
| `backend/api/app/main.py` | `from .routers import imports` + `app.include_router(imports.router, prefix="/imports", tags=["imports"])` |
| `backend/pyproject.toml` | Add `"python-dateutil>=2.9.0"`, `"kombu[sqs]>=5.3.0"` |
| `docker-compose.dev.yml` | Add `redis-dev` service + `import-worker-dev` service + `csv-uploads-dev` named volume + `pfin-dev-net` network |
| `docker-compose.yaml` | Add `redis` service + `import-worker` service + `csv-uploads` named volume. Add `BROKER_URL`, `RESULT_BACKEND`, `STORAGE_BACKEND`, `LOCAL_UPLOAD_DIR` env vars to `backend` service. |
| `frontend/src/features/transactions/pages/ImportCsvPage.tsx` | Replace `<UnderConstruction>` with `<ImportWizard />` |
| `frontend/src/features/transactions/pages/TransactionsPage.tsx` | Add "Import CSV" outlined button (with `FileUploadIcon`) next to "Add Transaction", hidden for VIEWER role, navigates to `/app/${familyId}/import-csv` |

---

## Docker Services to Add

**`docker-compose.dev.yml`:**
```yaml
redis-dev:
  image: redis:7-alpine
  ports: ["6379:6379"]
  networks: [pfin-dev-net]

import-worker-dev:
  build: ./import-service
  environment:
    BROKER_URL: redis://redis-dev:6379/0
    RESULT_BACKEND: redis://redis-dev:6379/1
    STORAGE_BACKEND: local
    LOCAL_UPLOAD_DIR: /uploads
    DATABASE_URL: postgresql+psycopg2://postgres:postgres@db-dev:5432/pfinancedb_dev
  volumes: [csv-uploads-dev:/uploads]
  depends_on: [redis-dev, db-dev]
  networks: [pfin-dev-net]

volumes:
  pgdata-dev:
  csv-uploads-dev:

networks:
  pfin-dev-net:
```

---

## New Env Vars

| Var | Local Value | AWS Value |
|-----|-------------|-----------|
| `BROKER_URL` | `redis://redis:6379/0` | `sqs://` (kombu SQS transport) |
| `RESULT_BACKEND` | `redis://redis:6379/1` | `redis://...` (or DynamoDB) |
| `STORAGE_BACKEND` | `local` | `s3` |
| `LOCAL_UPLOAD_DIR` | `/uploads` | — |
| `S3_BUCKET` | — | `pocket-family-imports` |
| `S3_REGION` | — | `us-east-1` |

---

## Security

- `file_key` prefix validated against `context.tenant.id` in all endpoints (prevents cross-tenant file access)
- File upload: 5 MB cap enforced before writing to storage
- Content-type check: only `text/csv` or `application/csv` accepted (also check `.csv` extension)
- `/imports/analyze` and `/imports/execute` reject VIEWER role (403)
- Account validated to belong to requesting tenant before dispatch

---

## Verification

1. **Import-service unit tests**: `LocalAdapter` round-trip; `execute_import` with SQLite + in-memory file bytes
2. **Backend unit tests** (`backend-test` agent): upload endpoint returns correct columns; analyze endpoint flags known duplicates; execute dispatches task with correct payload
3. **Frontend integration tests** (`frontend-test` agent): MSW handlers for all 4 endpoints; wizard advances through all 4 steps; duplicate rows pre-checked skip; categories assignable per row
4. **E2E smoke test**: Upload 3-row CSV (1 unique, 1 duplicate, 1 parse error). Verify only the unique row is imported and account balance is updated correctly.
