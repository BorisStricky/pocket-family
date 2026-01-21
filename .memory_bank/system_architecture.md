# System architecture — Personal Finance (memory bank)

Last updated: 2025-11-13

Purpose
This file consolidates the project's architecture notes and serves as a short, persistent memory entry describing the system design and operational model for the Personal Finance SaaS repo.

Overview
A multi-tenant SaaS personal finance platform. The backend is a Python FastAPI service exposing a REST API, backed by PostgreSQL. Background processing uses Celery with Redis as broker. Object storage is S3 or MinIO. The frontend is a React SPA served via a CDN. Authentication uses JWT (access + refresh tokens) and tenant isolation is enforced at the application layer.

Core stack
- Backend API: FastAPI (Python)
- Database: PostgreSQL (single DB, tenant_id column)
- Async processing: Celery workers + Redis broker
- Object storage: AWS S3 / MinIO (uploads & reports)
- Frontend: React + TypeScript (SPA)
- Auth: JWT (access + refresh tokens)
- Infra: Docker + Docker Compose for local dev
- Observability: Prometheus + Grafana (metrics & dashboards)

Logical architecture (summary)
Browser (React SPA) → CDN → Load Balancer / API Gateway → FastAPI REST API
FastAPI interacts with:
- Postgres (all transactional data; queries include tenant_id)
- S3/MinIO (file uploads/downloads such as CSVs)
- Redis (enqueue/import jobs)
Celery workers pull tasks from Redis, download CSVs from S3, process data, write transactions to Postgres, and send notifications via an email provider.

Diagram reference
See docs/Diagram.plantuml for the PlantUML representation of the flow:
- FE -> CDN -> LB -> API
- API -> DB / S3 / REDIS
- REDIS -> Celery Workers -> (DB, S3, Email)

Tenancy model
- Current approach: single database, shared schema.
- Each table includes a tenant_id column and queries always filter by tenant_id.
- Tenant-aware enforcement is implemented via dependencies / middleware (example: Depends(get_current_tenant)) and JWT claims include tenant_id.
- Future option: schema-per-tenant for large customers.

Data flow example — CSV import
1. User uploads CSV to S3/MinIO (or API accepts upload and forwards to S3).
2. API creates an import_job record (metadata) and enqueues a Celery task via Redis.
3. Celery worker downloads CSV from S3, validates rows, and inserts transactions into Postgres.
4. Worker updates job status (completed / failed) and triggers notifications (email) if needed.

Deployment & services (local dev)
- Docker Compose is used for local development. Typical services in compose:
  - api (FastAPI)
  - db (Postgres)
  - redis (broker)
  - celery_worker
  - celery_beat
  - minio (if used)
  - frontend (if included)
  - prometheus / grafana (monitoring)
- Local compose file: backend/docker-compose.yml

Security & isolation
- JWT with tenant_id claim; server-side checks enforce tenant boundaries.
- Pre-signed URLs for S3 uploads/downloads.
- Passwords hashed (bcrypt or similar).
- Secrets via environment variables; recommend using a secrets manager (Vault) for production.
- HTTPS enforced in production; strict content validation for uploads.

Observability & monitoring
- Export API metrics (request latency, errors).
- Monitor Celery queue and job processing rates.
- Prometheus collectors + Grafana dashboards for API, workers, and system health.

Operational notes & next steps
- Add Prometheus exporters to API and workers.
- Harden tenant enforcement with unit/integration tests.
- Consider schema-per-tenant migration plan for large-customer onboarding.
- Add migration and deployment runbooks to docs/ (migrations, environment variables, secrets).

Sources & references
- starting-architecture.md
- Starting Architecture.txt
- docs/Diagram.plantuml
