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

## 9. Domain Invariants — QCSD Findings Resolution

### Finding 2 — Accounts are user-scoped (personal), not tenant-scoped

`Account` belongs to a `User` via `user_id`; it has **no `tenant_id` column**. This is intentional: an account (a bank card, a cash wallet, a debit account) is a personal financial instrument that exists independently of any family the user belongs to.

Authorization for account CRUD (create, update, delete) is therefore based on **ownership** — `account.user_id == user.id` — not on family/tenant role. The `viewer` role restricts what a member can do with **shared family data** (transactions, categories, budgets). It is not a global write gate that prevents a user from creating or editing their own personal accounts. A viewer creating or updating their own account is entirely correct behavior.

This is why `create_account`, `update_account`, and `delete_account` in `routers/accounts.py` use `Depends(get_current_user)` (identity only) rather than `Depends(require_role(...))` (active-tenant role gate). Tenant-scoped resources such as `Category` and `Budget` do use `require_owner` / `require_writer` because those resources genuinely belong to the tenant, not the individual. The distinction is load-bearing.

**Resolution**: The prior concern that account CRUD lacked role checks is a **false positive**. The correct fix is to document this invariant (this section), not to add family-role guards to personal account operations. Adding such guards would incorrectly block viewers from managing their own finances.

### Finding 3 — Any AccountShare grants full write delegation (known limitation)

`AccountShare` links a personal account to a tenant (family) and controls one thing: `visibility` (HIDDEN / VISIBLE). Visibility determines whether the **account balance** is surfaced to other family members in the family view — it is a display preference, not a permission scope.

Today, any **active non-viewer** member of a grantee tenant can **write** to a shared account: they may create, update, and delete transactions that mutate the account's balance. This applies regardless of the `visibility` setting. Write access is authorized in a single place: `services/transactions.py::authorize_account_for_tenant`. That function checks whether the requesting user owns the account directly (`account.user_id == active_user.id`) or whether an `AccountShare` row exists for the active tenant; if either is true, full write access is granted.

In short: **sharing an account = full read-write delegation**. There is no read-only share today.

**Known limitation / future work**: To support read-only shares, add a `SharePermission` enum (READ / READ_WRITE) to `AccountShare`, create the corresponding Alembic migration, and enforce `SharePermission.READ_WRITE` in `authorize_account_for_tenant` before allowing balance-mutating operations. Because all write-access enforcement is centralized in that single function, the future change has exactly one enforcement point.

This is documented here as a known limitation, not a current security guarantee.

---


