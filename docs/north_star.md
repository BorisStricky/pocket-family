# North Star Map — Personal Finance SaaS

This document defines the single, authoritative blueprint for the Personal Finance SaaS. It serves as the system’s long-term compass: all features, architecture, and decisions must align with the principles and flows described here.

---

## 1. Domain Pillars

**User** — An identity with email/password and 0+ memberships.

**Tenant** — A scope for data (either personal or family). Every Expense, Budget, Account, or Import Job MUST include `tenant_id`.

**Membership** — Links a User to a Tenant with a `role` (owner, member, viewer).

**Expense** — Atomic transaction containing amount, currency, category, date, description, account, `tenant_id`, and `created_by`.

**Budget** — Spending limit for a tenant and category. Exists for both personal and family tenants.

**CSV Import Job** — Background ingestion pipeline that inserts Expenses from CSV files.

**Recurring Rule** — Schedule that periodically materializes Expense entries via Celery.

**Account** — Financial account (bank/card/cash). Belongs to a tenant.

**Invite** — Mechanism to add external users to an existing tenant.

---

## 2. Core Flows

### 1. Signup → Tenant Creation
Signup creates a User plus a default personal tenant and an owner membership.
Users can later create family tenants or join them via invites.

### 2. Expense Recording
Two equivalent input paths:
- **Manual**: direct API expense creation.
- **CSV Import**: presigned S3 upload → Import Job → Celery workers insert validated expenses.

If no tenant is explicitly selected, user’s personal tenant is used.

### 3. Analysis
Aggregations filtered by tenant, date range, category, or user. Exposed via reporting endpoints.

### 4. Budget Alerts
Budgets are defined per tenant. A background job evaluates spend vs budget and creates alerts.

### 5. Family Flow (Tenants)
A family is represented as a tenant. Users may record expenses in their personal or family tenants. Budgets apply accordingly.

---

## 3. Architectural Anchors

- FastAPI + SQLModel backend
- PostgreSQL single-DB multi-tenant
- JWT authentication with mandatory `tenant_id` claim
- Celery + Redis for background processing
- S3/MinIO for files and CSV upload
- Docker Compose for development
- Alembic for migrations
- Prometheus/Grafana for observability

These are non-negotiable elements of the system.

---

## 4. Invariants / Safety Rules

- Every domain record must include a valid `tenant_id`.
- All tenant-scoped routes enforce membership checks.
- Access tokens must include both `sub` (user_id) and `tenant_id`.
- CSV import must validate rows, isolate by tenant, and support idempotency.
- Background jobs must operate strictly within their provided tenant.
- Expense writes must record `created_by`, timestamp, and source (manual/csv/recurring).
- Support GDPR: user/tenant deletion and data export.

---

## 5. Boundaries & Integration Points

- API <-> DB: strict tenant filtering, FK constraints.
- API <-> Celery: job dispatch (CSV imports, recurring jobs, alerts).
- API <-> S3: presigned PUT uploads.
- Frontend <-> API: React client includes active `tenant_id` context; supports tenant switcher.
- Observability: p95 latency, job failures, import error rate.

---

## 6. Phase Evolution

**Phase 1 (Must):** Auth, Tenants, Membership, Expense CRUD, Basic Reports

**Phase 2 (Should):** CSV Import flow, Budgets + Alerts, Recurring Expenses

**Phase 3 (Could):** Multi-account features, Savings goals, Advanced analytics, optional schema-per-tenant

Phases evolve functionality without altering architectural anchors.

---

## 7. Acceptance Criteria

- Signup creates a personal tenant and membership.
- Expenses default to the personal tenant if none specified.
- CSV upload creates an `import_job`, Celery inserts validated expenses, job marked completed/failed.
- Reports respect tenant boundaries.
- Budget overages generate alert records.

---

## 8. Developer & Testing Rules

- Every model change requires an Alembic migration.
- Tests use SQLite via dependency overrides to validate cross-tenant isolation.
- Celery tasks must be testable via core functions independent of Celery.
- Refresh tokens are stored only as SHA-256 hashes; raw values returned solely in TEST_MODE.

---


