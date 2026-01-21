# 🧱 Starting Architecture — Personal Finance App

## 1. Overview

The system will be a **multi-tenant SaaS personal finance platform**.  
It allows users (individuals or family groups) to track income, expenses, budgets, and collaborate securely.

The architecture is modular and service-oriented, built for scalability, background processing, and cloud deployment.

---

## 2. Core Stack

| Layer | Technology | Purpose |
|-------|-------------|----------|
| **Backend API** | **FastAPI (Python)** | Main REST API layer, handles user actions, CRUD, auth, and orchestration |
| **Database** | **PostgreSQL** | Relational data store, multi-tenant via tenant_id column and schema isolation |
| **Async Processing** | **Celery + Redis** | Task queue for background jobs (CSV import, email sending, etc.) |
| **Storage** | **AWS S3 / MinIO** | File uploads (CSV imports, reports, attachments) |
| **Frontend** | **React + TypeScript + React Query** | SPA for user interface, integrates with API |
| **Auth** | **JWT (access/refresh tokens)** | Secure authentication and tenant-level access control |
| **Infra** | **Docker + Docker Compose** | Local development and reproducible deployment |
| **Monitoring** | **Prometheus + Grafana** | Metrics, health checks, and observability |

---

## 3. Logical Architecture

```plaintext
+---------------------------+
|         Frontend          |
| React + TypeScript        |
+------------+--------------+
             |
             v
+------------+--------------+
|          FastAPI          |
| REST API + Auth + Routing |
+------------+--------------+
             |
    +--------+--------+
    |                 |
    v                 v
+---+---+        +----+-----+
|Postgres|        | Celery   |
|(Tenant DB)      | + Redis  |
+---+---+        +----+-----+
    |                 |
    v                 v
+---+-----------------+---+
|     S3 / MinIO Object Store |
+-----------------------------+
```

---

## 4. Tenancy Model

- **Single database, shared schema** (initial phase).  
- Each table includes a `tenant_id` column.  
- Queries always filter by `tenant_id`.  
- Future option: **Schema-per-tenant** for larger customers.

**Tenant-aware layers:**
- `Depends(get_current_tenant)` middleware
- SQLModel / SQLAlchemy query filters
- Role-based access enforcement

---

## 5. Data Flow Example — CSV Import

1. User uploads a CSV file (to S3 or MinIO).
2. API stores metadata and creates an `import_job` record.
3. Celery worker pulls the job from Redis.
4. Worker processes CSV, validates, and stores transactions in Postgres.
5. Job status updated to `completed` or `failed`.

```plaintext
User → FastAPI → S3 → Celery → Postgres
```

---

## 6. Deployment Layout

- **Docker Compose** for local development
- **Services:**
  - `api` (FastAPI)
  - `db` (Postgres)
  - `redis`
  - `celery_worker`
  - `celery_beat`
  - `frontend`
  - `minio`
  - `prometheus`, `grafana`

---

## 7. Security & Isolation

- Tenant isolation enforced by:
  - JWT claims (tenant_id embedded)
  - Query filters (middleware or ORM dependency)
  - Permission model (owner, member, viewer)

- Secure storage via:
  - Pre-signed S3 URLs for uploads/downloads
  - Strict content validation and size limits

- Encryption:
  - HTTPS everywhere
  - Passwords hashed (bcrypt)
  - Secrets via `.env` and Vault

---

## 8. Observability

- **Prometheus exporters** for:
  - API request latency
  - Worker queue length
  - Import job metrics
- **Grafana dashboards**
  - API performance
  - Import processing rates
  - Tenant activity

---

## Milestones & timeline (aggressive learning-oriented)
- DONE **Week 0 — Kickoff**: repo skeleton, FastAPI app, Postgres, basic auth.  
- In Progress **Week 1 — Core CRUD**: accounts, categories, manual transactions, single-tenant flow.  
- **Week 2 — Multi-tenant & sharing**: tenant model, memberships, invite flow.  
- **Week 3 — CSV import pipeline**: presign URLs, Celery worker, basic parsing of 2–3 bank CSV formats.  
- **Week 4 — Hardening**: tests, monitoring, S3, RBAC, simple deployment.  
