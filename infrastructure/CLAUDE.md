# Infrastructure — CLAUDE.md

Deployment guidance for pocket-family. This file auto-loads when you work under `infrastructure/`. It maps the **deployment options** to the concrete files, scripts, env vars, and flags each one uses. For step-by-step AWS provisioning (Terraform / CloudFormation quickstart, IAM DB user bootstrap, teardown), see [README.md](README.md) — this file is the higher-level "which path am I on and what controls it" guide.

## The application has three services

`docker-compose.yaml` (self-host/prod) runs five containers; AWS runs the same app split across an ECS task plus managed services:

| Service | Local image | What it is |
|---|---|---|
| `db` | postgres:15 | PostgreSQL (Aurora Serverless v2 on AWS) |
| `backend` | `pocket-family-backend` | FastAPI API (`backend/api/Dockerfile`) |
| `redis` | redis:7-alpine | Celery broker + result backend (AWS SQS replaces it) |
| `import-worker` | `pocket-family-import-worker` | CSV import Celery worker (`import-service/`) — see [../import-service/CLAUDE.md](../import-service/CLAUDE.md) |
| `frontend` | `pocket-family-frontend` | React build served by nginx (`frontend/Dockerfile`) |

CSV uploads pass between `backend` (write) and `import-worker` (read/delete) via the shared `csv-uploads` volume locally, or an S3 bucket when `STORAGE_BACKEND=s3`.

---

## Deployment Option 1 — Local dev

Fast iteration; schema drift is expected.

- **Env**: `.env` (copy from [../.env.example](../.env.example)).
- **Infra**: `docker-compose.dev.yml` (Postgres only, on :5433) or a local Postgres; run the API with `uvicorn --reload` and the frontend with `npm run dev` (:5173).
- **Key flags**: `AUTO_CREATE_SCHEMA=1` (models auto-create tables), `TEST_MODE=0`, `DEMO_MODE=0`, `VITE_DEMO_MODE=false`, `DB_INSTANCE=local`.

## Deployment Option 2 — Local prod / self-host

Full stack on a single host (home server / LAN), Alembic-owned schema, persistent data.

- **Env**: `.env.production` (copy from [../.env.production.example](../.env.production.example)) — set `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS` (the LAN URL).
- **Infra**: `docker-compose.yaml` driven by [self-host.sh](self-host.sh):
  ```bash
  ./infrastructure/self-host.sh                 # default ACTION=up: docker compose up --build (detached)
  ACTION=migrate ./infrastructure/self-host.sh  # alembic upgrade head inside the running backend container
  ACTION=build   ./infrastructure/self-host.sh  # build images only
  ACTION=logs    ./infrastructure/self-host.sh  # tail logs
  ACTION=down|restart ./infrastructure/self-host.sh
  ```
  `up` only builds and starts the services — it does **not** run migrations automatically. Run migrations explicitly with `ACTION=migrate` (it `exec`s alembic in the backend container, since the DB port is not published to the host). Service start order is handled by `depends_on` + healthchecks in the compose file.
- **Key flags**: `AUTO_CREATE_SCHEMA=0` (**Alembic owns the schema**), `TEST_MODE=0`, `DEMO_MODE=0`.

## Deployment Option 3 — AWS prod (with optional DEMO MODE)

ECS Fargate (one task: backend + frontend containers) + ALB + Aurora Serverless v2 with **IAM database auth** (no static app password) + SQS/S3. Two regions are templated independently: Terraform (`us-east-1`) and CloudFormation (`us-east-2`).

- **Env**: `.env.aws.production` (copy from [../.env.aws.production.example](../.env.aws.production.example)) — `DB_INSTANCE=aws_aurora_serverless`, `DB_USER=<iam-mapped-user>`, `AWS_REGION`, `CORS_ORIGINS`. `AUTO_CREATE_SCHEMA=0`, `TEST_MODE=0`.
- **Build & push**: [build-and-push.sh](build-and-push.sh) builds both images (frontend uses `nginx.aws.conf`), pushes to ECR, runs migrations via the one-off `pocket-family-migrate` ECS task (`terraform/migrate.tf`), then optionally forces a new deployment.
  ```bash
  AWS_REGION=us-east-1 AWS_ACCOUNT_ID=<id> ./infrastructure/build-and-push.sh
  aws ecs update-service --cluster pocket-family --service pocket-family-svc \
    --force-new-deployment --region us-east-1
  ```
- **Terraform files** (`terraform/`): `ecs.tf` (cluster/task/service), `alb.tf`, `aurora_free.tf`, `ecr.tf`, `iam.tf` (`rds-db:connect`), `network.tf`, `acm.tf`, `cloudwatch.tf`, `eventbridge.tf` (demo reset), `migrate.tf`, `variables.tf`, `outputs.tf`. After the first apply, set `CORS_ORIGINS` to the ALB DNS and re-apply.

### DEMO MODE (a variant of Option 3)

A public read-mostly demo. It is a **dual-layer, three-place** switch — all three must agree:

1. **Backend runtime** — `DEMO_MODE=1` env on the ECS task. `is_demo_mode()` in `backend/api/app/auth.py` makes signup + tenant/invite/member-management endpoints return `403`; startup runs `scripts/ensure_demo_user.py` to seed `demo@pocket-family.com`.
2. **Frontend build-time** — `DEMO_MODE=1 ./infrastructure/build-and-push.sh` bakes `VITE_DEMO_MODE=true` into the image (`IS_DEMO_MODE` in `frontend/src/lib/constants.ts`): signup hidden, `DemoBanner` shown, "Try the Demo" auto-login.
3. **Terraform** — `terraform apply -var="demo_mode=true"` provisions the EventBridge rule + task (`terraform/eventbridge.tf`) that runs `backend/scripts/seed_demo_data.py` daily (default 06:00 UTC, `demo_reset_cron`): wipes the demo tenant's mutable data and re-seeds ~90 days of transactions. The demo user/tenant/owner-membership persist.

To deploy the demo: set `DEMO_MODE=1` + `VITE_DEMO_MODE=true` in `.env.aws.production`, build with `DEMO_MODE=1`, and apply Terraform with `demo_mode=true`. Standard AWS prod leaves all three off and does not provision EventBridge.

---

## Flags quick reference

| Flag | Local dev | Local prod | AWS prod | AWS demo |
|---|---|---|---|---|
| `AUTO_CREATE_SCHEMA` | `1` | `0` | `0` | `0` |
| `DEMO_MODE` / `VITE_DEMO_MODE` | off | off | off | **on** |
| `DB_INSTANCE` | `local` | `local`/RDS | `aws_aurora_serverless` | `aws_aurora_serverless` |
| Terraform `demo_mode` | — | — | `false` | `true` |
| Broker | n/a | Redis | SQS | SQS |

## When editing infrastructure

- Keep the three "places" of demo mode in sync (backend env, frontend build, Terraform var) — inconsistency is a common bug.
- A new backend env var must be added in **all** relevant places: the `.env.*.example` templates, `docker-compose.yaml`, and the ECS task definition in `terraform/ecs.tf`. The code-reviewer checks for this kind of drift.
- Never auto-create schema outside local dev — migrations run as a one-off ECS task (`migrate.tf`) or via `self-host.sh ACTION=migrate`.
