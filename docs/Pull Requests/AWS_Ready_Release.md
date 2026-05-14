# AWS-Ready Infrastructure - Summary

**Branch:** `development` → `aws-ready`  
**Commits:** 4 (`b0fe000`, `dc64be3`, `6fc84e3`, `efa9b2e`)  
**Last Updated:** 2026-05-14

## Overview

This release prepares pocket-family for cloud deployment on AWS Fargate + Aurora Serverless v2. It introduces a dual-path Infrastructure as Code setup ([[../knowledge/glossary/project-structure-concepts|Terraform]] and CloudFormation), adds [[../knowledge/glossary/authentication-security|IAM database authentication]] to the backend, adapts the frontend [[../knowledge/glossary/frontend-build-configuration|nginx]] config for Fargate's shared-namespace networking, and ships two operator scripts for building/pushing images and self-hosting via [[../knowledge/glossary/development-workflow|docker-compose]].

---

## Goals Achieved

- ✅ **Dual IaC templates**: [[../knowledge/glossary/project-structure-concepts|Terraform]] (us-east-1) and CloudFormation (us-east-2) both provision the full stack — ECR, ECS Fargate, Aurora Serverless v2, ALB, security groups, IAM roles, CloudWatch logs
- ✅ **[[../knowledge/glossary/authentication-security|IAM database authentication]]**: Backend no longer requires a static DB password at runtime; short-lived IAM tokens are injected per-connection via a SQLAlchemy `do_connect` event
- ✅ **Fargate-compatible [[../knowledge/glossary/frontend-build-configuration|nginx]]**: New `nginx.aws.conf` proxies `/api/` to `localhost:8000` instead of Docker DNS `backend`, matching Fargate's shared network namespace
- ✅ **Parameterised Dockerfile**: `NGINX_CONF` build arg selects local vs AWS nginx config; `VITE_API_URL` defaults to `/api` for same-origin routing
- ✅ **Operator scripts**: `build-and-push.sh` for ECR image delivery; `self-host.sh` for local [[../knowledge/glossary/development-workflow|docker-compose]] deployments with early env-var validation
- ✅ **Environment variable documentation**: Added `.env.aws.production.example` and updated `.env.production.example` to cover the full set of required vars for both deployment paths
- ✅ **Secrets exclusions**: `.gitignore` extended to cover `.env.aws.production` and all Terraform state/lock files

---

## Architecture & Tech Stack Changes

### New: `DB_INSTANCE` connection dispatch

The backend now supports two database connection strategies controlled by a single env var:

| `DB_INSTANCE` value | Connection strategy |
|---|---|
| `local` (default) | Uses `DATABASE_URL` directly — unchanged from before |
| `aws_aurora_serverless` | Uses IAM auth tokens generated via [[../knowledge/glossary/api-communication|`boto3`]] on every new connection; requires `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`, `AWS_REGION` |

[[../knowledge/glossary/api-communication|`boto3`]] is a new optional dependency — it is lazy-imported inside `_build_aurora_engine()` so local dev never requires it installed.

### New: Fargate networking model

ECS Fargate tasks use `awsvpc` network mode. All containers in a task share one network namespace — Docker service DNS (`backend`) does not exist. The new `nginx.aws.conf` proxies to `127.0.0.1:8000` instead, keeping browser traffic same-origin (required for [[../knowledge/glossary/authentication-security|`HttpOnly` refresh-token cookies]] with `SameSite=lax`).

### New: IaC directory

`infrastructure/` contains two parallel, deploy-independent templates:

```
infrastructure/
  terraform/           → us-east-1 (Terraform)
  cloudformation/      → us-east-2 (CloudFormation)
  build-and-push.sh    → ECR image push script
  self-host.sh         → Local docker-compose runner
  README.md            → Quickstart and cost notes
```

---

## Directory Structure

```
.                                     (root)
  .env.aws.production.example         🆕 AWS Fargate env template (IAM auth path)
  .env.example                        ✏️ Added DB_INSTANCE=local default
  .env.production.example             ✏️ Expanded to cover RDS host/port/user/name vars
  .gitignore                          ✏️ Added .env.aws.production + Terraform state exclusions
  MILESTONE_1_TEST_SUMMARY.md         ❌ Deleted (archived; content moved to docs)
  backend/api/app/db.py               ✏️ Added DB_INSTANCE dispatch + Aurora IAM engine builder
  backend/pyproject.toml              ✏️ Added boto3>=1.34.0 as optional dependency
  frontend/Dockerfile                 ✏️ NGINX_CONF build arg; VITE_API_URL default → /api
  frontend/nginx.aws.conf             🆕 Fargate-specific nginx config (proxy to localhost)
  docs/active_context/*.md            ✏️ All sprint context files archived to docs/archive/
  infrastructure/README.md            🆕 IaC quickstart, cost notes, what's not in templates
  infrastructure/build-and-push.sh    🆕 ECR image build + push script
  infrastructure/self-host.sh         🆕 docker-compose self-hosting runner with env validation
  infrastructure/cloudformation/
    pocket-family-stack.yaml          🆕 CloudFormation template (us-east-2)
    deploy.sh                         🆕 CloudFormation deploy wrapper
  infrastructure/terraform/
    versions.tf                       🆕 Provider + Terraform version pins
    variables.tf                      🆕 Input variables with descriptions and defaults
    terraform.tfvars.example          🆕 Fill-in-the-blanks secrets template
    network.tf                        🆕 Default VPC/subnet data sources
    ecr.tf                            🆕 Two ECR repos with lifecycle policies
    ecs.tf                            🆕 Fargate cluster, task definition, service
    aurora.tf                         🆕 Aurora Serverless v2 cluster + IAM-mapped DB user
    alb.tf                            🆕 Application Load Balancer + target group + listener
    iam.tf                            🆕 Task role (rds-db:connect) + execution role
    cloudwatch.tf                     🆕 Log group with 30-day retention
    outputs.tf                        🆕 ALB DNS, ECR URIs, next-steps reminder
```

---

## Files Changed — Detailed Breakdown

### Backend — IAM Database Authentication

**`backend/api/app/db.py`** — MODIFIED  
**Purpose**: Selects and constructs the SQLAlchemy async engine at startup.  
**Key Changes**:
- Added `_build_aurora_engine()` function that creates an async engine for Aurora Serverless v2 with IAM auth. Uses a SQLAlchemy `do_connect` event to inject a fresh `boto3`-generated IAM token before every new physical connection, replacing the placeholder password.
- Wrapped the original engine creation in an `if DB_INSTANCE == "local":` branch. The new `elif DB_INSTANCE == "aws_aurora_serverless":` branch calls `_build_aurora_engine()`.
- Pool recycle set to 600 seconds (IAM tokens expire at ~900s) and SSL enforced via `ssl.create_default_context()`.
- `DATABASE_URL` and `engine` remain exported at module level for backward compatibility.

**`backend/pyproject.toml`** — MODIFIED  
**Key Changes**: Added `boto3>=1.34.0` under a comment `# AWS (lazy-imported only when DB_INSTANCE=aws_aurora_serverless)`.

### Frontend — Fargate Networking

**`frontend/nginx.aws.conf`** — NEW  
**Purpose**: Nginx server block for AWS Fargate deployments. Routes `/api/` requests to `127.0.0.1:8000` (not Docker DNS `backend`) because Fargate's `awsvpc` mode gives all containers in a task the same network namespace. The `/api/` prefix is stripped so `GET /api/auth/login` reaches the FastAPI app as `GET /auth/login`.

**`frontend/Dockerfile`** — MODIFIED  
**Key Changes**:
- `ARG NGINX_CONF=nginx.conf` — selects which config to `COPY` into the image. Pass `--build-arg NGINX_CONF=nginx.aws.conf` for AWS. `build-and-push.sh` does this automatically.
- Default `VITE_API_URL` changed from a hardcoded LAN IP to `/api`, which works for both AWS (same-origin) and new local deployments.

### Infrastructure as Code

**`infrastructure/terraform/`** — ALL NEW  
The Terraform module provisions the full AWS stack in `us-east-1` using the default VPC. Key design decisions:
- **Aurora Serverless v2**: scales to 0 ACU when idle; IAM auth eliminates static DB passwords from ECS task definitions.
- **Single Fargate task**: 0.5 vCPU / 1 GiB with both frontend and backend containers; cost is ~$25/month within the Fargate free tier.
- **ALB HTTP only**: HTTPS listener deferred until a domain is registered (noted in README and `outputs.tf` next-steps).
- `outputs.tf` includes a `next_steps` reminder with the `psql` commands needed to create the IAM-mapped DB user — this one-time step is intentionally left out of IaC.

**`infrastructure/cloudformation/pocket-family-stack.yaml`** — NEW  
Equivalent stack for `us-east-2` using native AWS CloudFormation. Takes VPC ID and subnet IDs as parameters (no `data` source equivalent in CFN). Produces the same resource set as the Terraform module.

**`infrastructure/cloudformation/deploy.sh`** — NEW  
Thin wrapper around `aws cloudformation deploy` that sets stack name, template file, parameter overrides, and `CAPABILITY_NAMED_IAM`.

### Operator Scripts

**`infrastructure/build-and-push.sh`** — NEW  
Builds backend and frontend Docker images, tags them with both `IMAGE_TAG` (default: `latest`) and the current git SHA for immutable references, authenticates to ECR, and pushes. Works for both [[../knowledge/glossary/project-structure-concepts|Terraform]] (us-east-1) and CloudFormation (us-east-2) stacks via `AWS_REGION` env var.

**`infrastructure/self-host.sh`** — NEW  
Wrapper around [[../knowledge/glossary/development-workflow|`docker compose`]] for home-server deployments using `docker-compose.yaml`. Validates the `.env.production` file exists and that `DB_PASSWORD`/`JWT_SECRET` are not still placeholder values before starting. Supports `up`, `down`, `restart`, `build`, and `logs` actions.

### Environment & Configuration

**`.env.aws.production.example`** — NEW  
Documents the full set of env vars for the AWS Fargate path: `DB_INSTANCE=aws_aurora_serverless`, Aurora host/port/user/name, `AWS_REGION`, `JWT_SECRET`, `CORS_ORIGINS`, `VITE_API_URL=/api`.

**`.env.production.example`** — MODIFIED  
Expanded from 5 lines to 36. Now covers both local docker-compose and AWS Fargate paths: split `DATABASE_URL` into individual `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` vars, added `CORS_ORIGINS`, clarified `VITE_API_URL` comment.

**`.env.example`** — MODIFIED  
Added `DB_INSTANCE=local` with inline comment explaining the two valid values.

**`.gitignore`** — MODIFIED  
Added `.env.aws.production` (real secrets, never commit) and Terraform-generated files: `terraform.tfvars`, `*.tfstate`, `*.tfstate.backup`, `.terraform/`, `.terraform.lock.hcl`.

### Documentation & Cleanup

**`docs/active_context/*.md`** — MOVED to `docs/archive/`  
Sprint context files (`sprint_0.md` through `sprint_8.md` and `frontend_roadmap.md`) archived. The `aws-ready` branch represents a post-sprint deployment milestone, not active development work.

**`MILESTONE_1_TEST_SUMMARY.md`** — DELETED  
Milestone test summary removed at root level. Content preserved in git history.

---

## Migration Notes

### First-time AWS deploy (Fargate path)

1. Run `terraform apply` (or `./cloudformation/deploy.sh`) to provision infrastructure.
2. Run `build-and-push.sh` to push Docker images to ECR.
3. Create the IAM-mapped DB user in Aurora (one-time, via psql in AWS CloudShell — see `infrastructure/README.md` Step 3).
4. Run Alembic migrations as a one-off ECS task.
5. Force ECS to pick up new images: `aws ecs update-service --cluster pocket-family --service pocket-family-svc --force-new-deployment`.

### Self-hosting (local [[../knowledge/glossary/development-workflow|docker-compose]] path)

1. Copy `.env.production.example` → `.env.production` and fill in `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS`.
2. Run `./infrastructure/self-host.sh` — the script validates placeholders are replaced before starting.

### No breaking changes to the `development` branch

The `DB_INSTANCE` default is `local`, so all existing local [[../knowledge/glossary/development-workflow|docker-compose]] and test workflows are unchanged. The `DATABASE_URL` variable is still exported and honoured on the local path.

---

## Performance Impact

- **Backend startup**: `boto3` is not imported unless `DB_INSTANCE=aws_aurora_serverless`. Local dev startup time is unchanged.
- **Connection pool**: Aurora path recycles connections at 600s (vs. no recycle on local) — negligible at current scale.
- **Frontend bundle**: `VITE_API_URL=/api` is a relative path; no change to bundle size.

---

## Related Documentation

- [infrastructure/README.md](../../infrastructure/README.md) — Full AWS deploy quickstart and cost notes
- [docs/Pull Requests/Development_Branch_Release.md](Development_Branch_Release.md) — Prior release: production Docker hardening

### Technical Glossary

> [!info] Learning Resources
> Concepts introduced or extended in this release:
> - [[../knowledge/glossary/development-workflow|Development Workflow]] — Docker, Compose, CI/CD patterns
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] — IAM auth, JWT, token lifecycle
> - [[../knowledge/glossary/api-communication|API Communication]] — nginx reverse proxy, same-origin, CORS
> - [[../knowledge/glossary/frontend-build-configuration|Frontend Build & Configuration]] — Vite build args, Docker multi-stage builds
> - [[../knowledge/glossary/project-structure-concepts|Project Structure & Concepts]] — IaC layout, environment separation
