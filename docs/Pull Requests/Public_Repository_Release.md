# Public Repository Release — Summary

**Branch:** `development` → `master`  
**Commits:** 15 (`87dc709` through `74a07c8`)  
**Last Updated:** 2026-05-19

## Overview

This release represents the completion of Pocket Family as a public portfolio project. It consolidates three distinct milestones: AWS cloud infrastructure provisioning, a public demo mode, and repository open-sourcing housekeeping. The application is now fully deployed on AWS (ECS Fargate + Aurora Serverless v2), exposes a live demo instance, and has a clean public-facing repository with proper community files, GitHub templates, and no development-only scaffolding.

---

## Goals Achieved

- ✅ **AWS cloud deployment** — full IaC in both Terraform (us-east-1) and CloudFormation (us-east-2); Aurora Serverless v2 with IAM auth; ECS Fargate hosting both containers in a shared task
- ✅ **Demo mode** — a single env flag (`DEMO_MODE=1`) gates all destructive endpoints, rate-limits login, and triggers a realistic 24-hour data reset via EventBridge + ECS RunTask
- ✅ **Live demo UX** — one-click "Try the Demo" login, disclaimer modal, sticky warning banner, and a public `/legal` page
- ✅ **Open-source ready** — `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, GitHub issue templates, and PR template added; README updated to demo-complete status
- ✅ **Repository spring cleaning** — sprint tracking files, memory bank, glossary, inbox docs, and stale frontend specs removed; CLAUDE.md simplified to match the post-sprint workflow

---

## Architecture & Tech Stack Changes

### New: `DB_INSTANCE` connection dispatch

| `DB_INSTANCE` | Strategy |
|---|---|
| `local` (default) | `DATABASE_URL` used directly — no change for local dev |
| `aws_aurora_serverless` | IAM token injected per connection via `boto3` `do_connect` event; pool recycles at 600 s |

`boto3` is a lazy-imported optional dependency — local dev never requires it.

### New: Fargate networking model

ECS `awsvpc` mode gives all containers in a task one shared network namespace. `nginx.aws.conf` proxies `/api/` to `127.0.0.1:8000` (not Docker DNS `backend`) so same-origin routing and `SameSite=lax` cookies work correctly.

### New: `DEMO_MODE` runtime flag

A single backend env var (`DEMO_MODE=1`) activates:
- FastAPI `assert_not_demo()` dependency blocking signup, tenant delete, member management, and invite endpoints (HTTP 403)
- `slowapi` rate limiter capping login at 10 requests/minute per IP
- `ensure_demo_user()` startup hook to self-provision the shared demo account

`VITE_DEMO_MODE` is the compile-time counterpart that bakes demo UI into the frontend bundle.

### New: EventBridge daily reset

An EventBridge rule fires at 06:00 UTC, triggering an ECS RunTask one-shot using the same backend image with a `seed_demo_data.py` command override. The task terminates after the script exits — no long-running process needed.

### New: IaC directory

```
infrastructure/
  terraform/           → us-east-1 (Terraform)
  cloudformation/      → us-east-2 (CloudFormation)
  build-and-push.sh    → ECR image push + optional demo flag
  self-host.sh         → docker-compose runner with env validation
  README.md            → Quickstart and cost notes
```

---

## Directory Structure

```
.                                           (root)
  CONTRIBUTING.md                           🆕 Contribution guidelines and code style rules
  LICENSE                                   🆕 MIT license
  SECURITY.md                               🆕 Vulnerability reporting policy
  README.md                                 ✏️ Commands updated to uv; status → demo-complete
  CLAUDE.md                                 ✏️ Removed sprint/memory-bank references
  .env.example                              ✏️ Added DB_INSTANCE=local default
  .env.production.example                   ✏️ Expanded to 36 lines; split DB vars
  .env.aws.production.example               🆕 AWS Fargate env template (IAM auth path)
  .gitignore                                ✏️ Added .env.aws.production + Terraform state files
  .github/
    pull_request_template.md                🆕 Checklist-based PR template
    ISSUE_TEMPLATE/bug_report.md            🆕 Bug report template
    ISSUE_TEMPLATE/feature_request.md       🆕 Feature request template
  .claude/skills/active_learning/SKILL.md   🆕 Active-learning teaching framework skill
  .claude/skills/add-to-glossary/SKILL.md  ❌ Deleted (glossary removed)
  backend/
    api/
      app/
        auth.py                             ✏️ Added is_demo_mode() + assert_not_demo() dependency
        main.py                             ✏️ Wired rate limiter; auto-seeds demo user at startup
        rate_limit.py                       🆕 Shared slowapi Limiter singleton
        db.py                               ✏️ DB_INSTANCE dispatch; Aurora IAM engine builder
        routers/
          auth.py                           ✏️ Signup blocked in demo; login rate-limited
          tenants.py                        ✏️ Delete + member CRUD blocked in demo
      Dockerfile                            ✏️ Copies scripts/ into image for RunTask use
    scripts/
      ensure_demo_user.py                   🆕 Idempotent demo user/tenant provisioner
      seed_demo_data.py                     🆕 Daily reset: ~1 000 transactions, 90-day window
    pyproject.toml                          ✏️ Added boto3 (optional) + slowapi==0.1.9
  frontend/
    public/
      robots.txt                            🆕 Default: allow all crawlers
      robots.demo.txt                       🆕 Demo: disallow all crawlers
    nginx.aws.conf                          🆕 Fargate nginx — proxies /api/ to localhost:8000
    Dockerfile                              ✏️ NGINX_CONF build arg; VITE_API_URL defaults to /api
    vite.config.ts                          ✏️ demoHtmlMeta() plugin: noindex tag + title suffix
    src/
      components/ui/organisms/
        DemoBanner.tsx                      🆕 Sticky warning bar on all demo pages
        DemoDisclaimerModal.tsx             🆕 First-visit acknowledgement dialog
        SideNav.tsx                         ✏️ Minor updates
        TopNav.tsx                          ✏️ Minor updates
      features/auth/components/
        AuthForm.tsx                        ✏️ Hides signup link in demo mode
      lib/constants.ts                      ✏️ IS_DEMO_MODE, DEMO_CREDENTIALS, ROUTES.LEGAL
      pages/
        legal_page.tsx                      🆕 Public disclaimer + terms page at /legal
        login_page.tsx                      ✏️ "Try the Demo" one-click auto-login button
        signup_page.tsx                     ✏️ Info panel replaces form in demo mode
      router/index.tsx                      ✏️ Mounts DemoBanner + DemoDisclaimerModal at root; /legal route
  infrastructure/
    README.md                              🆕 IaC quickstart, cost notes
    build-and-push.sh                      🆕 ECR push + DEMO_MODE + FORCE_NEW_DEPLOYMENT flags
    self-host.sh                           🆕 docker-compose runner with placeholder validation
    cloudformation/
      pocket-family-stack.yaml             🆕 CloudFormation template (us-east-2)
      deploy.sh                            🆕 CloudFormation deploy wrapper
    terraform/
      versions.tf                          🆕 Provider + Terraform version pins
      variables.tf                         🆕 Input variables (incl. demo_mode, demo_reset_cron)
      terraform.tfvars.example             🆕 Fill-in-the-blanks secrets template
      network.tf                           🆕 Default VPC/subnet data sources
      ecr.tf                               🆕 Two ECR repos with lifecycle policies
      ecs.tf                               🆕 Fargate cluster, task definition, service + DEMO_MODE env
      aurora_free.tf                       🆕 Aurora Serverless v2 free-tier configuration
      aurora.tf.disabled                   ❌ Disabled in favour of aurora_free.tf
      alb.tf                               🆕 ALB + target group + listener
      iam.tf                               🆕 Task role (rds-db:connect) + execution role
      cloudwatch.tf                        🆕 Log group (30-day retention)
      eventbridge.tf                       🆕 Daily demo reset rule + IAM role (demo_mode only)
      outputs.tf                           🆕 ALB DNS, ECR URIs, next-steps reminder
  docs/
    Pull Requests/AWS_Ready_Release.md     🆕 AWS infrastructure milestone summary
    Pull Requests/Demo_Ready_Release.md    🆕 Demo mode milestone summary
    repo-structure.md                      ✏️ Minor updates
    active_context/                        ❌ All sprint files deleted (archived in git history)
    knowledge/glossary/                    ❌ All 14 glossary files deleted (spring cleaning)
    frontend/                              ❌ Sprint summaries + spec files deleted
    Inbox/                                 ❌ Celery, Redis, Recharts notes deleted
    roadmap/import_flow.md                 ❌ Deleted
  .memory_bank/                            ❌ components_used.md + system_architecture.md deleted
  MILESTONE_1_TEST_SUMMARY.md             ❌ Deleted (preserved in git history)
```

---

## Files Changed — Detailed Breakdown

### AWS Infrastructure (Milestone 1)

**`backend/api/app/db.py`** — MODIFIED  
**Purpose**: SQLAlchemy async engine factory.  
**Key Changes**: Added `_build_aurora_engine()` that uses a `do_connect` SQLAlchemy event to inject a fresh IAM auth token (via `boto3`) before every new physical connection. The original local path is unchanged. Pool recycles at 600 s (IAM tokens expire at ~900 s); SSL enforced.

**`backend/pyproject.toml`** — MODIFIED  
**Key Changes**: Added `boto3>=1.34.0` as an optional dependency (comment-tagged so local devs know it's AWS-only) and `slowapi==0.1.9` as a production dependency.

**`frontend/nginx.aws.conf`** — NEW  
**Purpose**: Nginx server block for Fargate. Routes `/api/` → `127.0.0.1:8000`, stripping the prefix so FastAPI sees clean paths. Required because `awsvpc` mode shares a single network namespace with no Docker service DNS.

**`frontend/Dockerfile`** — MODIFIED  
**Key Changes**: `ARG NGINX_CONF=nginx.conf` selects the config at build time (pass `nginx.aws.conf` for AWS). `VITE_API_URL` defaults to `/api` for same-origin routing.

**`infrastructure/terraform/`** — ALL NEW  
Full stack in Terraform (us-east-1): ECR, ECS Fargate (0.5 vCPU / 1 GiB), Aurora Serverless v2 with IAM auth, ALB (HTTP; HTTPS noted as future work), IAM roles, CloudWatch logs (30-day retention), and an EventBridge demo-reset rule gated on `var.demo_mode`.

**`infrastructure/cloudformation/pocket-family-stack.yaml`** — NEW  
Equivalent CloudFormation stack for us-east-2. Takes VPC/subnet IDs as parameters (no `data` source equivalent in CFN). Produces the same resource set as Terraform.

**`infrastructure/build-and-push.sh`** — NEW  
Builds and tags both images (`latest` + git SHA), authenticates to ECR, pushes. `DEMO_MODE=1` maps to `VITE_DEMO_MODE=true` for the frontend build arg. `FORCE_NEW_DEPLOYMENT=1` triggers `aws ecs update-service` after push.

**`infrastructure/self-host.sh`** — NEW  
docker-compose wrapper. Validates `.env.production` exists and that `DB_PASSWORD`/`JWT_SECRET` are not still placeholder strings before starting. Supports `up`, `down`, `restart`, `build`, `logs`.

---

### Demo Mode (Milestone 2)

**`backend/api/app/rate_limit.py`** — NEW  
**Purpose**: Single `slowapi.Limiter` instance shared across `main.py` (app-state registration) and the auth router (per-route decorator). A shared singleton keeps the in-process counter registry consistent and avoids circular imports.

**`backend/api/app/auth.py`** — MODIFIED  
**Key Changes**: Added `is_demo_mode()` (reads `DEMO_MODE` env var) and `assert_not_demo()` — a FastAPI dependency that raises HTTP 403 when the flag is active. Co-located with `is_test_mode()` for consistency.

**`backend/api/app/main.py`** — MODIFIED  
**Key Changes**: Registered the `slowapi` rate limiter and its `RateLimitExceeded` handler. On startup, calls `ensure_demo_user()` when `DEMO_MODE=1`. The call is wrapped in try/except so a seed failure does not crash the API.

**`backend/api/app/routers/auth.py`** — MODIFIED  
**Key Changes**: `/auth/signup` blocked via `dependencies=[Depends(assert_not_demo)]`. `/auth/login` rate-limited to 10 requests/minute per IP with `@limiter.limit("10/minute")`.

**`backend/api/app/routers/tenants.py`** — MODIFIED  
**Key Changes**: `assert_not_demo` added to tenant delete, member create, member update, and member delete routes — preventing visitors from breaking the shared demo tenant.

**`backend/scripts/ensure_demo_user.py`** — NEW  
**Purpose**: Idempotent provisioner. Creates the `demo@pocket-family.com` user, "Demo Family" tenant, owner membership, and default categories/accounts if missing. Safe to call repeatedly on every startup.

**`backend/scripts/seed_demo_data.py`** — NEW  
**Purpose**: Daily reset script. Wipes all mutable demo data (transactions, accounts, non-owner memberships, invites) and re-seeds ~1,000 transactions over a 90-day trailing window. Preserves user/tenant/owner-membership so demo credentials keep working. Five spending categories with realistic descriptions; `random.seed(42)` gives deterministic distribution shape.

**`backend/api/Dockerfile`** — MODIFIED  
**Key Change**: Added `COPY scripts/ /app/scripts/` so the RunTask one-shot shares the same image as the API without a separate build.

**`frontend/src/lib/constants.ts`** — MODIFIED  
**Key Additions**: `IS_DEMO_MODE` (resolved at compile time from `VITE_DEMO_MODE`), `DEMO_CREDENTIALS`, `DEMO_ACK_STORAGE_KEY`, `ROUTES.LEGAL`. All demo-mode UI gates read the single constant rather than reaching into `import.meta.env` directly.

**`frontend/src/components/ui/organisms/DemoBanner.tsx`** — NEW  
**Purpose**: Sticky MUI `Alert severity="warning"` bar mounted above the app bar on every page. Returns `null` when `IS_DEMO_MODE` is false — can be mounted unconditionally at the router root.

**`frontend/src/components/ui/organisms/DemoDisclaimerModal.tsx`** — NEW  
**Purpose**: First-visit acknowledgement dialog. Blocks interaction until the visitor clicks "I understand — continue to demo". Acknowledgement timestamp persisted in localStorage. `disableEscapeKeyDown` prevents dismissal without explicit acceptance.

**`frontend/src/pages/legal_page.tsx`** — NEW  
**Purpose**: Public disclaimer and terms page at `/legal` (no auth required). Ten sections: nature of service, AS-IS warranty, no-PII policy, shared account notice, daily reset, limitation of liability, acceptable use, indemnification, changes, contact.

**`frontend/src/pages/login_page.tsx`** — MODIFIED  
**Key Change**: In demo mode, renders a "Try the Demo" button above the form. Clicking it calls `useLogin` with `DEMO_CREDENTIALS` — no typing required.

**`frontend/src/pages/signup_page.tsx`** — MODIFIED  
**Key Change**: In demo mode, the form is replaced with a static info panel explaining account creation is disabled, with a redirect to `/login`.

**`frontend/src/features/auth/components/AuthForm.tsx`** — MODIFIED  
**Key Change**: "Don't have an account? Sign up" cross-link hidden in demo mode to avoid sending visitors to the blocked signup.

**`frontend/src/router/index.tsx`** — MODIFIED  
**Key Changes**: `<DemoBanner />` and `<DemoDisclaimerModal />` mounted at the router root. `/legal` route added as a public route.

**`frontend/vite.config.ts`** — MODIFIED  
**Key Change**: `demoHtmlMeta()` Vite plugin injects `<meta name="robots" content="noindex,nofollow" />` and suffixes the page title with `— Demo` when `VITE_DEMO_MODE=true`. Build-time injection — no client-side DOM manipulation.

**`infrastructure/terraform/eventbridge.tf`** — NEW  
**Purpose**: All AWS resources for the daily demo reset, gated on `var.demo_mode = true`. Creates a second ECS task definition (`demo-reset`) with a `seed_demo_data.py` command override, an EventBridge cron rule (default: 06:00 UTC), and an IAM role for EventBridge to call `ecs:RunTask`.

---

### Repository Open-Sourcing (Milestone 3: Spring Cleaning)

**`LICENSE`** — NEW  
MIT license for the public repository.

**`CONTRIBUTING.md`** — NEW  
Contribution guidelines covering setup, code style rules (no abbreviations, no `any`, inline "why" comments), testing requirements (pytest + Vitest), and PR submission process.

**`SECURITY.md`** — NEW  
Vulnerability reporting policy — GitHub Issues with `security` label; 5-business-day response SLA.

**`README.md`** — MODIFIED  
**Key Changes**:
- Install commands updated to `uv sync --all-extras` and `uv run uvicorn`/`uv run pytest` (replacing old `pip install` / bare `pytest`)
- Project structure updated: removed `.active_context/` reference, added `ERD.plantuml`
- Documentation links: removed `docs/glossary.md` (deleted)
- Status section changed from "🚧 Active Development" to "Demo-complete — deployed to AWS"

**`CLAUDE.md`** — MODIFIED  
**Key Changes**: Getting-started reading list updated from sprint files to `north_star.md` + `SystemArchitecture.md`. Development workflow simplified to 3 steps (removed sprint tracking, memory bank, and glossary update steps).

**`.github/pull_request_template.md`** — NEW  
Checklist-based PR template with summary, changes, and testing checklist (backend tests, frontend tests, multi-tenant isolation).

**`.github/ISSUE_TEMPLATE/bug_report.md`** — NEW  
Structured bug report template (steps, expected/actual, environment).

**`.github/ISSUE_TEMPLATE/feature_request.md`** — NEW  
Feature request template.

**`.claude/skills/active_learning/SKILL.md`** — NEW  
Time-boxed Socratic learning framework skill: progressive disclosure, comprehension checks (open-ended → multiple choice → re-explain), one concept at a time.

### Deleted — Development Scaffolding

The following files served sprint-era development purposes and have been removed to present a clean public repository. All content is preserved in git history.

- **`docs/active_context/`** — All sprint planning files (`sprint_0.md` through `sprint_8.md`, `frontend_roadmap.md`)
- **`docs/knowledge/glossary/`** — All 14 glossary markdown files (api-communication, authentication-security, concepts-to-learn-more, development-workflow, frontend-build-configuration, glossary, project-structure-concepts, react-patterns-hooks, resources, routing-navigation, state-management, testing, typescript, ui-components-design)
- **`docs/frontend/`** — Sprint summaries (sprint_0 through sprint_2), spec files, pull request summary, progress report, test suite refactor summary, tenant switch fix doc
- **`docs/Inbox/`** — Celery, Redis, Recharts research notes
- **`docs/roadmap/import_flow.md`** — Import flow roadmap
- **`docs/knowledge/network.md`** — Network diagram doc
- **`.memory_bank/`** — `components_used.md` and `system_architecture.md`
- **`MILESTONE_1_TEST_SUMMARY.md`** — Root-level milestone test summary
- **`.claude/skills/add-to-glossary/SKILL.md`** — Glossary maintenance skill (glossary removed)

---

## Testing Strategy

> [!warning] Test Coverage
> The AWS infrastructure and demo mode milestones focused on operational changes. No automated tests were added for:
> - Demo-mode API restrictions (`DEMO_MODE=1` → HTTP 403 assertions)
> - Frontend demo UI components (`DemoBanner`, `DemoDisclaimerModal`, "Try the Demo" button)
> - Demo data seed scripts (smoke test against a test database)
> - Rate limiter behaviour (10/minute cap)
>
> **Recommended follow-up**:
> - Backend: pytest cases for `assert_not_demo()` on signup, tenant delete, and member management routes
> - Frontend: integration tests for `DemoBanner`, `DemoDisclaimerModal` with `IS_DEMO_MODE = true`
> - Seed scripts: smoke test `seed_demo_data.py` against SQLite test database

---

## Migration Notes

### New Environment Variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `DB_INSTANCE` | Backend | `local` | `local` or `aws_aurora_serverless` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` | Backend (AWS path) | — | Aurora connection details |
| `AWS_REGION` | Backend (AWS path) | — | IAM token generation region |
| `DEMO_MODE` | Backend (ECS env) | `0` | Enables API restrictions |
| `VITE_DEMO_MODE` | Frontend (build arg) | `false` | Enables demo UI |

**No breaking changes** for local development: `DB_INSTANCE` defaults to `local`, `DEMO_MODE` defaults to `0`.

### First-time AWS Deploy

1. `terraform apply` (or `./cloudformation/deploy.sh`) to provision infrastructure
2. `./infrastructure/build-and-push.sh` to push images to ECR
3. One-time IAM DB user creation in Aurora (psql in CloudShell — see `infrastructure/README.md`)
4. Run Alembic migrations as one-off ECS task
5. `aws ecs update-service --force-new-deployment` to deploy new images

### Self-hosting

1. Copy `.env.production.example` → `.env.production`; fill in `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS`
2. `./infrastructure/self-host.sh up` — validates placeholders before starting

---

## Performance Impact

- **Backend startup**: `boto3` lazy-imported; local startup unchanged. `ensure_demo_user()` adds one DB round-trip in demo mode, wrapped in try/except.
- **Frontend bundle**: `DemoBanner` and `DemoDisclaimerModal` are in the main bundle but return `null` when `IS_DEMO_MODE` is false. Tree-shaking eliminates the JSX in non-demo builds.
- **Rate limiter**: In-process `slowapi` counter; no external service; negligible overhead.
- **Connection pool**: Aurora path recycles at 600 s vs. no recycle on local — negligible at current scale.

---

## Next Steps / Follow-up Work

- **Automated test coverage** for demo mode (see Testing Strategy)
- **CloudWatch alarm** on `demo-reset` ECS task exit code to catch failed resets
- **Session reset on daily wipe**: Force-expire all demo refresh tokens after `seed_demo_data.py` runs so returning visitors see a clean state
- **HTTPS**: ALB currently HTTP only — wire a certificate when a domain is registered
- **Demo analytics**: Track "Try the Demo" clicks and page views to understand showcase conversion

---

## Related Documentation

- [infrastructure/README.md](../../infrastructure/README.md) — AWS deploy quickstart and cost notes
- [docs/Pull Requests/AWS_Ready_Release.md](AWS_Ready_Release.md) — AWS infrastructure milestone detail
- [docs/Pull Requests/Demo_Ready_Release.md](Demo_Ready_Release.md) — Demo mode milestone detail
- [docs/Pull Requests/Development_Branch_Release.md](Development_Branch_Release.md) — Prior release: production Docker hardening
