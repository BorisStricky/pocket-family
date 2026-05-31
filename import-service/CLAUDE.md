# Import Service — CLAUDE.md

Module guidance for the CSV import worker. This file auto-loads when you work under `import-service/`. The root [CLAUDE.md](../CLAUDE.md) holds project-wide context; deployment wiring lives in [../infrastructure/CLAUDE.md](../infrastructure/CLAUDE.md).

## Purpose

Performs the atomic bulk insert of CSV-imported transactions, decoupled from the FastAPI backend but **sharing the same PostgreSQL database**. The actual work lives in one framework-agnostic core, `process_import(payload)` (`app/tasks/import_csv.py`), invoked through **two entry points**:

- **Local / self-host**: a thin **Celery task** (`app/tasks/celery_tasks.py`, registered as `import_service.execute_import`) running in the `import-worker` container, polling Redis.
- **AWS**: an **SQS-triggered Lambda** (`app/lambda_handler.py`) — no Celery worker. The backend still dispatches with `celery_client.send_task(...)` to SQS unchanged; the Lambda handler **decodes the Celery/kombu envelope** to recover the payload, then calls the same `process_import` core.

Only the trigger differs; the import logic is identical on both. See [../infrastructure/CLAUDE.md](../infrastructure/CLAUDE.md) for the AWS wiring (`terraform/lambda.tf`).

## Data flow

```
User uploads CSV → backend /imports/* parses + dedupes + stores the file →
backend enqueues `import_service.execute_import` (Redis locally / SQS on AWS) →
  • local: Celery task → process_import()
  • AWS:   SQS event source mapping → Lambda handler decodes envelope → process_import()
process_import() inserts rows + updates the account balance in ONE transaction →
updates the ImportJob row → deletes the uploaded file
```

All CSV parsing and duplicate detection happen in the **backend**. This service receives pre-parsed rows and only does the atomic DB write + bookkeeping.

## Layout

```
import-service/
  app/
    celery_app.py         # make_celery() factory → celery_app; broker/queue/serialization config
    config.py             # pydantic-settings Settings (all from env vars)
    db.py                 # SQLAlchemy core tables + sync get_session()
    lambda_handler.py     # AWS entry point: handler() + decode_sqs_record() (kombu envelope → payload)
    tasks/
      import_csv.py       # SHARED CORE: process_import() + _mark_import_job() + _claim_import_job() — NO celery import
      celery_tasks.py     # local/self-host entry point: thin @celery_app.task wrapper → process_import (only module importing celery_app)
    storage/              # pluggable file storage: base.py, local.py, s3.py (get_storage())
  Dockerfile              # Celery worker image (local/self-host). CMD: celery -A app.celery_app:celery_app worker
  Dockerfile.lambda       # AWS Lambda image (public.ecr.aws/lambda/python:3.11). CMD: app.lambda_handler.handler
  tests/                  # pytest: decoder + process_import (in-memory SQLite) + celery-free-import guard
  pyproject.toml          # uv-managed deps (+ pytest dev dep)
```

> **Keep the core celery-free.** `app/tasks/import_csv.py` and `app/lambda_handler.py` must never import `celery`/`kombu`/`redis` (directly or transitively) — the Lambda image omits them, so any such import crashes the function at cold start. The Celery binding is isolated in `celery_tasks.py`; `tests/test_celery_free_import.py` guards this.

## Run it

```bash
# Local (Redis broker) — normally started via the root docker-compose.yaml as `import-worker`
celery -A app.celery_app:celery_app worker --loglevel=info

# Tests
uv sync --dev          # installs pytest (uv includes dev deps by default)
uv run pytest          # decoder + process_import + celery-free-import guard
```

## Key conventions & invariants

- **Sync, not async.** Celery tasks run outside asyncio, so this service uses the **psycopg2** sync driver (`postgresql+psycopg2://...`) and SQLAlchemy Core tables in `db.py` — *not* the backend's async SQLModel/asyncpg stack. Keep it that way.
- **Same multi-tenant rules as the backend.** Rows are written with `tenant_id`, `account_id`, `created_by` taken from the task payload (which the authenticated backend produced). Never widen scope beyond the payload's tenant.
- **Atomicity.** All transaction inserts **and** the account balance update happen in a single `get_session()` commit — all-or-nothing. `task_acks_late=True` + `task_reject_on_worker_lost=True`: a crashed worker re-queues the task, and imports are not run twice.
- **Idempotency claim.** Both triggers can be handed the same message twice (Celery re-queue / Lambda retry). `process_import` first runs `_claim_import_job()` — an atomic `UPDATE importjob SET status='STARTED' WHERE id=:id AND status='PENDING'`; if `rowcount == 0` (already claimed/finished) it returns `{"status": "skipped"}` without inserting, so transactions are never double-inserted. When `import_job_id` is absent (local/test) there is nothing to claim and it proceeds.
- **Enum casing.** PostgreSQL enum labels are uppercase (`EXPENSE`/`INCOME`, `MANUAL`/`RECURRING`) because the backend ORM stores enum *names*. This worker uppercases `transaction_type` and writes `source="MANUAL"` to stay consistent.
- **Status via the DB, not the result backend.** On AWS no Celery result backend is configured; job status is the `ImportJob` table (`STARTED`/`DONE`/`FAILED`), updated best-effort by `_mark_import_job()` — bookkeeping failures are logged, never raised, so they can't mask the real import outcome.
- **Two images, env-driven behavior.** `Dockerfile` builds the **Celery worker** image (local/self-host); `Dockerfile.lambda` builds the **AWS Lambda** image (celery/kombu/redis omitted). Both run the same `process_import` core; behavior is otherwise env-driven (`config.py`): Redis broker + local volume storage in dev; S3 storage on AWS — only env vars change (`BROKER_URL`, `STORAGE_BACKEND`, `S3_BUCKET`, `CELERY_DEFAULT_QUEUE`). The Lambda needs no broker vars (the SQS event source mapping feeds it directly).
- **Project standards still apply**: full variable names (no abbreviations), inline comments explaining the "why".

## Common env vars (see `config.py`)

`BROKER_URL`, `RESULT_BACKEND` (optional), `CELERY_DEFAULT_QUEUE`, `DATABASE_URL` (psycopg2), `STORAGE_BACKEND` (`local`|`s3`), `LOCAL_UPLOAD_DIR`, `S3_BUCKET`, `S3_REGION`.
