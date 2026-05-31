# Move the CSV Import Worker from ECS Fargate → AWS Lambda

## Summary

Replaces the always-on ECS Fargate Celery worker (`desired_count = 1`, idle almost
all the time) with an **SQS → Lambda** consumer that scales to zero when idle and
bills per invocation. **Local / self-host is unchanged** — it keeps Celery + Redis.

The backend is **untouched**: it still dispatches with `celery_client.send_task(...)`
to the same SQS queue. Only the *consumer* changed (ECS Celery worker → Lambda). The
Lambda decodes the Celery/kombu envelope to recover the payload and runs **one shared
`process_import()` core** — the same code the local Celery task runs.

| | Trigger | Consumer | Celery? |
|---|---|---|---|
| **Local / self-host** (unchanged) | backend `send_task` → Redis | Celery worker | yes |
| **AWS after** | backend `send_task` → SQS (unchanged) | **Lambda** (SQS event source mapping) | no — handler decodes envelope, calls shared core |

## Changes

### import-service (Part A)
- **Shared core**: `process_import(payload)` extracted into `app/tasks/import_csv.py`
  (no Celery import). The Celery task is now a thin wrapper in the new
  `app/tasks/celery_tasks.py` — the only module that imports `celery_app`, so the
  Lambda image can import the core without celery installed.
- **Lambda handler** (`app/lambda_handler.py`): iterates SQS records, decodes the
  Celery protocol-v2 / kombu envelope (`decode_sqs_record`, handling base64 outer
  and inner bodies), and calls `process_import`. Exceptions propagate so SQS retries
  → DLQ (matching `task_acks_late`).
- **Idempotency claim** (`_claim_import_job`): atomic `UPDATE importjob SET
  status='STARTED' WHERE id=:id AND status='PENDING'`; a re-delivered message
  (Lambda retry / Celery re-queue) no-ops instead of double-inserting.
- **`Dockerfile.lambda`**: `public.ecr.aws/lambda/python:3.11`, deps minus
  celery/kombu/redis. The worker `Dockerfile` is kept for local/self-host.

### infrastructure (Parts B & C)
- **`lambda.tf`** (new): `aws_lambda_function.import` (Image, timeout 300, memory
  512, reserved concurrency 5, in-VPC on default subnets + the fargate SG) and the
  SQS `aws_lambda_event_source_mapping` (batch_size 1, max concurrency 5).
- **ECR**: dedicated `import_lambda` repo + lifecycle policy + output.
- **IAM**: `import_lambda` role — `rds-db:connect`, `s3:GetObject`/`s3:DeleteObject`,
  managed Basic + VPC execution. **Plan deviation (intentional):** the plan said "no
  SQS policy on the function role," but an SQS event source mapping **requires**
  `sqs:ReceiveMessage`/`DeleteMessage`/`GetQueueAttributes` on the *execution role*,
  so that policy is included (commented in `iam.tf`).
- **Networking**: S3 **gateway** VPC endpoint so the in-VPC Lambda reaches S3
  without a NAT.
- **`AWS_REGION`** is omitted from the Lambda environment block (reserved runtime
  key AWS injects automatically); the env is derived from `local.worker_environment`
  minus the broker vars + `AWS_REGION`.
- **Removed** the ECS import worker task/service and `worker_task_cpu`/`_memory`
  vars. SQS queue, DLQ, S3 bucket, and the backend env are unchanged.
- **`build-and-push.sh`**: builds/pushes `Dockerfile.lambda` then runs
  `aws lambda update-function-code`; drops the import-worker ECS rollout.

### docs (Part D)
- `import-service/CLAUDE.md`: two entry points sharing one `process_import` core,
  the envelope decode, the idempotency claim, two images, and how to run the tests.
- `infrastructure/CLAUDE.md`: SQS → Lambda replaces the ECS import worker on AWS.

## Tests
`import-service/tests/` (pytest, in-memory SQLite, no Postgres/network/SQS):
- **Decoder** — recovers the exact payload across all base64/plain inner+outer
  combinations, the handler forwards it to the core, and (when kombu is available)
  it matches kombu's own encoding.
- **`process_import`** — rows inserted, balance updated (income +, expense −),
  status → DONE, and idempotent no-op (no duplicate rows) on re-delivery.
- **Celery-free guard** — the core and handler import with celery/kombu/redis
  blocked (the Lambda-image constraint), while the Celery wrapper still requires
  celery.

**Result: 13 passed** on the project's pinned Python 3.11
(`uv run --python 3.11 pytest`), stable across repeated runs and module orderings.
The kombu-encoding test runs here because `kombu[sqs]` is a declared dependency
(`uv` installs it); in a celery/kombu-free environment that one test skips,
giving the equivalent 12 passed + 1 skipped.

## Verification not covered here
Steps requiring live AWS / Docker were **not** executed in this environment and
should be run before/after merge: `terraform plan/apply`, the end-to-end CSV upload
on AWS, the failure→DLQ path, and `docker build` of `Dockerfile.lambda`. `terraform
validate` passes; `terraform plan` was not run against real state.

## Review summary
- **Iterations used:** 2 / 3.
- **Final state:** Blocking 0 · High 0 · Medium 0 · Low (known follow-ups below).
- Iteration 1 surfaced a Blocking (failing tests — a test-harness bug, **not** a
  product bug: the SQLite mirror tables bound `uuid.UUID` objects via a fragile
  global `sqlite3` adapter, so the idempotency claim's `WHERE id = UUID(...)` matched
  zero rows once other tests had run), a High (`import-service/CLAUDE.md` not
  updated), and two Mediums. All fixed in iteration 2 — the UUID binding now uses a
  deterministic SQLAlchemy `TypeDecorator`.
- **Final verification on Python 3.11** surfaced a second test-isolation bug (again
  a test-harness bug, **not** a product bug): the celery-free guard restored
  `sys.modules` after its block but left the *parent package* attribute
  (`app.lambda_handler`) pointing at the freshly re-imported module, so a later
  `import app.lambda_handler as ...` diverged from the top-level-imported `handler`,
  the decode test's monkeypatch missed, and the real `process_import` tried to reach
  Postgres. Fixed by re-pointing each restored submodule onto its parent package in
  the guard's cleanup; the suite is now 13 passed, stable across orderings.
- **Known follow-ups (Low):** the `rds-iam-auth` inline-policy name is reused across
  two roles (cosmetic — inline policies are scoped per-role); `BUILD_IMPORT_WORKER`
  still defaults to `1` (builds the local-only Celery image).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
