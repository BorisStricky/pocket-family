# Move the CSV Import Worker from ECS Fargate → AWS Lambda

## Context

The CSV import worker is a **persistent Celery worker** running as an ECS Fargate
service (`aws_ecs_service.import_worker`, `desired_count = 1`, `ecs.tf:217-240`). It
runs 24/7 — polling SQS forever — even though real imports are short (seconds),
bursty, and completely stateless. That is ~$9–10/month of always-on Fargate for a
job that is idle almost all the time.

An **SQS → Lambda** trigger is a much better fit: AWS runs the poller, scales to zero
when idle, and bills per invocation. The worker's actual work (`execute_import`,
`import_csv.py:72-194`) is plain Python — download nothing (rows arrive pre-parsed
from the backend), insert transactions + update the account balance in one DB
commit, update the `importjob` row, delete the uploaded CSV. None of Celery's
machinery (worker loop, concurrency, beat, result backend) is actually used on AWS,
so **on AWS, Lambda makes Celery redundant.**

**Decisions (confirmed with user):**
- **Keep Celery + Redis for local dev / self-host** (docker-compose has no AWS/SQS).
  Celery stops being "the architecture" and becomes just the local background runner.
- **One shared core function** `process_import(payload)` is used by *both* the local
  Celery task and the AWS Lambda. Only the trigger differs.
- **Backend stays unchanged.** It keeps dispatching with `celery_client.send_task(...)`
  (`celery_client.py:17`) to SQS. The **Lambda decodes the Celery/kombu envelope** to
  recover the payload — the only component that changes is the *consumer* (ECS Celery
  worker → Lambda). (Tradeoff: this couples the handler to Celery's wire format — see
  Risks. The raw-SQS-JSON alternative is documented there as an escape hatch.)
- **Container-image Lambda** (not zip). `psycopg2` is a native dependency; building it
  inside a Linux image avoids manylinux/platform gymnastics, and it reuses the
  existing ECR + `uv` Dockerfile + `build-and-push.sh` pipeline rather than bolting on
  a new zip/layer artifact type.

**Outcome:** AWS import path becomes serverless (SQS → Lambda, scale-to-zero); the
always-on Fargate worker is removed; local/self-host is untouched.

### Architecture before → after

| | Trigger | Consumer | Celery? |
|---|---|---|---|
| **Local / self-host** (unchanged) | backend `send_task` → Redis | ECS-less docker-compose **Celery worker** | yes |
| **AWS before** | backend `send_task` → SQS | **ECS Fargate Celery worker** (always on) | yes |
| **AWS after** | backend `send_task` → SQS (unchanged) | **Lambda** (SQS event source mapping) | no — handler decodes envelope, calls shared core |

---

## Part A — import-service: shared core + Lambda handler + image

### A1 — Extract the shared core (`import-service/app/tasks/import_csv.py`)
Refactor the body of `execute_import` into a plain module-level function
`process_import(payload: dict) -> dict` (no Celery, no `self`). The existing Celery
task becomes a thin wrapper:
```python
@celery_app.task(bind=True, name="import_service.execute_import")
def execute_import(self, payload: dict) -> dict:
    return process_import(payload)
```
`_mark_import_job`, `get_session`, storage cleanup, enum casing — all stay exactly as
they are, just moved under `process_import`. This keeps local behavior identical.

### A2 — Lambda handler (`import-service/app/lambda_handler.py`, new)
`def handler(event, context):` iterate `event["Records"]`; for each SQS record,
**decode the kombu envelope** to recover the original `payload`, then call
`process_import(payload)`. Robust decode (kombu's SQS format):
1. `record["body"]` → try `json.loads`; if that fails, base64-decode first then
   `json.loads` (kombu may base64 the whole SQS body).
2. From the envelope dict, take `envelope["body"]`; if
   `envelope["properties"]["body_encoding"] == "base64"`, base64-decode it.
3. `args, kwargs, embed = json.loads(message_body)` (Celery protocol v2) →
   `payload = kwargs["payload"]`.
With `batch_size = 1` (Part B3) each invocation handles one message; let exceptions
propagate so SQS retries → DLQ (matches today's `task_acks_late` semantics).

### A3 — Idempotency claim (recommended, small)
Lambda retries (timeout/transient error) could re-run a non-idempotent import and
double-insert. *Today's Celery setup has the same risk*, but it is cheap to fix here:
at the top of `process_import`, atomically claim the job —
`UPDATE importjob SET status='STARTED' WHERE id=:id AND status='PENDING'` — and if
`rowcount == 0` (already STARTED/DONE/FAILED), log and return without inserting. This
replaces the current unconditional `_mark_import_job(..., "STARTED")`.

### A4 — Lambda image (`import-service/Dockerfile.lambda`, new)
Base on `public.ecr.aws/lambda/python:3.11`. `pip/uv install` the same pinned deps as
the worker **minus** celery/kombu/redis (the handler doesn't need them):
`sqlalchemy==2.0.35`, `psycopg2-binary`, `python-dateutil`, `pydantic-settings`
(`boto3` ships in the Lambda runtime). `COPY app/ ${LAMBDA_TASK_ROOT}/app/`, then
`CMD ["app.lambda_handler.handler"]`. The existing `Dockerfile` (Celery worker) is
kept for local/self-host.

---

## Part B — Terraform (`infrastructure/terraform/`)

### B1 — ECR repo for the Lambda image
Add `aws_ecr_repository.import_lambda` (mirror `ecr.tf:64` + its lifecycle policy
`ecr.tf:74`). Expose `repository_url` in `outputs.tf`. (Reusing the existing
`import_worker` repo is possible but a dedicated repo keeps the two image types
distinct.)

### B2 — `lambda.tf` (new): `aws_lambda_function.import`
- `package_type = "Image"`, `image_uri = "${aws_ecr_repository.import_lambda.repository_url}:${var.image_tag}"`
- `timeout = 300` (≤ the SQS 1800s visibility timeout, and 6× margin = 1800 — no SQS
  change needed), `memory_size = 512` (matches the worker today)
- `reserved_concurrent_executions = 5` to cap concurrent DB connections to Aurora
  (mirrors the old `--concurrency=2` intent, with headroom)
- `vpc_config` = the default subnets (`data.aws_subnets.default`) + the existing
  `aws_security_group.fargate` SG, so Aurora's current inbound rule (from the fargate
  SG) already permits the Lambda — Aurora lives in the VPC and is not public.
- `environment` = the DB/storage vars only (no broker): `DB_INSTANCE=aws_aurora_serverless`,
  `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`, `AWS_REGION`, `STORAGE_BACKEND=s3`,
  `S3_BUCKET`, `S3_REGION`. (Reuse `local.worker_environment` minus `BROKER_URL` /
  `CELERY_DEFAULT_QUEUE`; `config.py` defaults make the broker vars optional.)
- CloudWatch log group for `/aws/lambda/${var.project_name}-import`.

### B3 — Event source mapping (`lambda.tf`)
`aws_lambda_event_source_mapping`: `event_source_arn = aws_sqs_queue.celery.arn`,
`function_name = aws_lambda_function.import.arn`, `batch_size = 1`,
`scaling_config { maximum_concurrency = 5 }`. The existing redrive policy
(`maxReceiveCount = 3` → `celery_dlq`, `sqs.tf`) keeps working natively under Lambda
retries — no SQS change.

### B4 — IAM (`iam.tf`): `aws_iam_role.import_lambda`
Assume-role for `lambda.amazonaws.com`. Attach:
- inline `rds-db:connect` for `var.db_app_user` (copy `worker_rds_connect`,
  `iam.tf:101-114`)
- inline `s3:GetObject` + `s3:DeleteObject` on the uploads bucket (copy
  `worker_s3_read`, `iam.tf:134-145`)
- managed `AWSLambdaBasicExecutionRole` (logs) + `AWSLambdaVPCAccessExecutionRole`
  (ENI create/delete for VPC access)
- **No SQS policy on the function role** — the Lambda *service* polls/deletes SQS via
  the event source mapping; the function code never calls SQS.

### B5 — Networking: S3 access for an in-VPC Lambda
The default subnets have **no NAT and no VPC endpoints** (ECS reaches AWS via
`assign_public_ip`; Lambda ENIs get no public IP). Add an **S3 gateway VPC endpoint**
(`aws_vpc_endpoint`, `Gateway`, associated with the default VPC's route tables) so the
Lambda's `s3:DeleteObject` cleanup works without a NAT. Gateway endpoints are free.
> Alternative (avoids the endpoint entirely): drop the S3 delete from `process_import`
> and rely on the existing **1-day S3 lifecycle expiration** (`s3.tf`) to clean up
> uploads. Keeping the explicit delete (with the endpoint) preserves parity with the
> Celery path and immediate cleanup — recommended.

### B6 — Remove the ECS worker
Delete `aws_ecs_task_definition.import_worker` + `aws_ecs_service.import_worker`
(`ecs.tf:189-240`), and `worker_task_cpu` / `worker_task_memory` vars +
`worker_task` IAM role/policies if nothing else references them. Keep the SQS queue,
DLQ, S3 bucket, and `import_worker_image`/repo only if still used elsewhere (else
remove). **Backend env is unchanged** — it still has `BROKER_URL=sqs://` and keeps
dispatching to the same queue.

---

## Part C — Deploy scripts

**`infrastructure/build-and-push.sh`:**
- Build + push `Dockerfile.lambda` to `aws_ecr_repository.import_lambda` (new
  `BUILD_IMPORT_LAMBDA` step, parallel to the existing image builds).
- After push: `aws lambda update-function-code --function-name <project>-import
  --image-uri <repo>:<tag>` so the function picks up the new image.
- Remove the `import_worker` ECS `force-new-deployment` rollout step.

**`docker-compose.yaml` / `self-host.sh`:** unchanged — the `import-worker` Celery
service (built from the original `Dockerfile`) stays for local/self-host.

---

## Part D — Docs
- `import-service/CLAUDE.md`: document the two entry points (Celery task for
  local/self-host, Lambda handler for AWS) sharing one `process_import()` core; note
  the envelope decode.
- `infrastructure/CLAUDE.md`: SQS → Lambda replaces the ECS import worker on AWS.

---

## Verification
1. **Infra:** `terraform plan` shows the Lambda + event source mapping + IAM role +
   S3 endpoint **created** and the import-worker ECS task/service **destroyed**;
   `terraform apply` succeeds.
2. **Decoder unit test:** capture a real kombu message produced by
   `celery_client.send_task("import_service.execute_import", kwargs={"payload": {...}})`
   on the SQS transport and assert the handler recovers the exact `payload`. Unit-test
   `process_import` against an in-memory/SQLite-style session (rows inserted, balance
   updated, status DONE).
3. **End-to-end on AWS:** upload a CSV through the ALB → `importjob` row `PENDING` →
   Lambda fires → status `STARTED → DONE`, transactions appear, balance updated, the
   S3 object is deleted, CloudWatch shows the invocation.
4. **Failure path:** send a deliberately bad payload → Lambda errors → SQS retries →
   message lands in `celery_dlq` after 3 attempts; `importjob` shows `FAILED`.
5. **Idempotency:** re-deliver the same message after success → `process_import`
   sees status ≠ PENDING and no-ops (no duplicate transactions).
6. **Local unaffected:** `docker-compose up` → import still processed by the Celery
   worker; `cd backend && uv run pytest` still passes.
7. **Cost:** confirm no always-on import task in ECS; Lambda billed per invocation.

---

## Risks / notes
- **Envelope-decode coupling.** The handler depends on Celery protocol v2 + kombu's
  SQS body encoding. Pin celery/kombu in the backend, unit-test the decoder against a
  real captured message, and keep it isolated in `lambda_handler.py`. **Escape hatch:**
  if the format proves troublesome, switch the AWS dispatch to raw JSON
  (`boto3 sqs.send_message(MessageBody=json.dumps(payload))`, env-gated in the
  backend; `sqs:SendMessage` is already granted at `iam.tf:63`) and have the handler
  do `json.loads(record["body"])`.
- **VPC egress.** Lambda is in-VPC for Aurora; S3 needs the gateway endpoint (B5).
- **Idempotency** under Lambda retries — addressed by A3.

---

## Files touched
**import-service:** `app/tasks/import_csv.py` (extract `process_import`),
`app/lambda_handler.py` *(new)*, `Dockerfile.lambda` *(new)*, `CLAUDE.md`.
**terraform:** `lambda.tf` *(new)*, `ecr.tf`, `iam.tf`, `outputs.tf`, `ecs.tf`
(remove worker), `variables.tf` (remove worker vars), `network.tf`/new endpoint.
**scripts:** `infrastructure/build-and-push.sh`.
**docs:** `infrastructure/CLAUDE.md`.
Backend, `docker-compose.yaml`, `self-host.sh`, SQS/DLQ config: **unchanged.**
