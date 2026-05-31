# Import Service — CLAUDE.md

Module guidance for the CSV import worker. This file auto-loads when you work under `import-service/`. The root [CLAUDE.md](../CLAUDE.md) holds project-wide context; deployment wiring lives in [../infrastructure/CLAUDE.md](../infrastructure/CLAUDE.md).

## Purpose

A standalone **Celery worker**, deployed and scaled independently of the API, that performs the atomic bulk insert of CSV-imported transactions. It is decoupled from the FastAPI backend but **shares the same PostgreSQL database**.

## Data flow

```
User uploads CSV → backend /imports/* parses + dedupes + stores the file →
backend enqueues `import_service.execute_import` (Redis locally / SQS on AWS) →
this worker inserts rows + updates the account balance in ONE transaction →
worker updates the ImportJob row → deletes the uploaded file
```

All CSV parsing and duplicate detection happen in the **backend**. This worker receives pre-parsed rows and only does the atomic DB write + bookkeeping.

## Layout

```
import-service/
  app/
    celery_app.py        # make_celery() factory → celery_app; broker/queue/serialization config
    config.py            # pydantic-settings Settings (all from env vars)
    db.py                # SQLAlchemy core tables + sync get_session()
    tasks/import_csv.py   # execute_import task (the only task)
    storage/             # pluggable file storage: base.py, local.py, s3.py (get_storage())
  Dockerfile             # CMD: celery -A app.celery_app:celery_app worker
  pyproject.toml         # uv-managed deps
```

## Run it

```bash
# Local (Redis broker) — normally started via the root docker-compose.yaml as `import-worker`
celery -A app.celery_app:celery_app worker --loglevel=info
```

## Key conventions & invariants

- **Sync, not async.** Celery tasks run outside asyncio, so this service uses the **psycopg2** sync driver (`postgresql+psycopg2://...`) and SQLAlchemy Core tables in `db.py` — *not* the backend's async SQLModel/asyncpg stack. Keep it that way.
- **Same multi-tenant rules as the backend.** Rows are written with `tenant_id`, `account_id`, `created_by` taken from the task payload (which the authenticated backend produced). Never widen scope beyond the payload's tenant.
- **Atomicity.** All transaction inserts **and** the account balance update happen in a single `get_session()` commit — all-or-nothing. `task_acks_late=True` + `task_reject_on_worker_lost=True`: a crashed worker re-queues the task, and imports are not run twice.
- **Enum casing.** PostgreSQL enum labels are uppercase (`EXPENSE`/`INCOME`, `MANUAL`/`RECURRING`) because the backend ORM stores enum *names*. This worker uppercases `transaction_type` and writes `source="MANUAL"` to stay consistent.
- **Status via the DB, not the result backend.** On AWS no Celery result backend is configured; job status is the `ImportJob` table (`STARTED`/`DONE`/`FAILED`), updated best-effort by `_mark_import_job()` — bookkeeping failures are logged, never raised, so they can't mask the real import outcome.
- **One Docker image, two environments.** All behavior is env-driven (`config.py`): Redis broker + local volume storage in dev; `sqs://` broker (kombu[sqs]) + S3 storage on AWS — **no code changes between them**, only env vars (`BROKER_URL`, `STORAGE_BACKEND`, `S3_BUCKET`, `CELERY_DEFAULT_QUEUE`).
- **Project standards still apply**: full variable names (no abbreviations), inline comments explaining the "why".

## Common env vars (see `config.py`)

`BROKER_URL`, `RESULT_BACKEND` (optional), `CELERY_DEFAULT_QUEUE`, `DATABASE_URL` (psycopg2), `STORAGE_BACKEND` (`local`|`s3`), `LOCAL_UPLOAD_DIR`, `S3_BUCKET`, `S3_REGION`.
