# Demo-Ready Release — Summary

## Overview

This branch transforms the existing `development` build into a fully
deployable **public demo instance** of Pocket Family. Changes span every
layer of the stack: a new `DEMO_MODE` runtime flag gates destructive API
endpoints, the frontend gains a disclaimer banner, a one-click demo login,
and a legal page, and AWS infrastructure is extended with an EventBridge
rule that wipes and re-seeds demo data every 24 hours.

No production behaviour changes when `DEMO_MODE` is off — the flag defaults
to `0`/`false` everywhere, so existing deployments are unaffected.

---

## Goals Achieved

- **Public-safe demo** — a visitor can click "Try the Demo" on the login page
  and immediately explore a realistic dataset without creating an account.
- **Backend hardening** — signup, tenant deletion, member management, and
  invite endpoints all return `HTTP 403` when `DEMO_MODE=1` so the shared
  demo account cannot be abused.
- **Rate limiting** — login endpoint is capped at 10 requests per minute via
  `slowapi` to prevent credential stuffing against the public demo.
- **Daily data reset** — an EventBridge-scheduled ECS `RunTask` one-shot
  replaces the demo tenant's data every morning at 06:00 UTC.
- **SEO exclusion** — demo builds get a `noindex,nofollow` meta tag and a
  blocking `robots.txt` so the demo host does not compete with the
  marketing site in search results.
- **Legal compliance** — a `/legal` page with full disclaimer and terms is
  linked from the banner, disclaimer modal, and footer.

---

## Architecture & Tech Stack Changes

| Concern | Change |
|---|---|
| Rate limiting | Added `slowapi==0.1.9` (in-process, no Redis needed for the demo tier) |
| Demo flag propagation | `DEMO_MODE` env var (backend runtime) + `VITE_DEMO_MODE` build arg (frontend compile-time) |
| Demo data pipeline | Two new Python scripts (`ensure_demo_user.py`, `seed_demo_data.py`) bundled into the backend Docker image |
| Scheduled automation | New Terraform module (`eventbridge.tf`) provisions an EventBridge → ECS `RunTask` pipeline when `var.demo_mode = true` |
| SEO | `demoHtmlMeta` Vite plugin injects meta robots tag; Dockerfile swaps `robots.txt` with `robots.demo.txt` in demo builds |

---

## Directory Structure

```
.
├── .claude/skills/active_learning/
│   └── 🆕 SKILL.md                          # Active-learning skill definition
├── backend/
│   ├── api/
│   │   ├── app/
│   │   │   ├── ✏️ auth.py                   # Added is_demo_mode() + assert_not_demo() FastAPI dep
│   │   │   ├── ✏️ main.py                   # Wired rate limiter; auto-seeds demo user at startup
│   │   │   ├── 🆕 rate_limit.py             # Shared slowapi Limiter singleton
│   │   │   └── routers/
│   │   │       ├── ✏️ auth.py               # Signup blocked in demo; login rate-limited
│   │   │       └── ✏️ tenants.py            # Tenant delete + member CRUD blocked in demo
│   │   └── ✏️ Dockerfile                    # Copies scripts/ into image so RunTask can import app
│   ├── scripts/
│   │   ├── 🆕 ensure_demo_user.py           # Idempotent demo user/tenant provisioner
│   │   └── 🆕 seed_demo_data.py             # Full daily reset (~1 000 transactions, 90-day window)
│   └── ✏️ pyproject.toml                    # Added slowapi dependency
├── frontend/
│   ├── public/
│   │   ├── 🆕 robots.txt                    # Default: allow all (non-demo builds)
│   │   └── 🆕 robots.demo.txt              # Demo: disallow all crawlers
│   └── src/
│       ├── components/ui/organisms/
│       │   ├── 🆕 DemoBanner.tsx            # Sticky warning bar shown on every demo page
│       │   └── 🆕 DemoDisclaimerModal.tsx   # First-visit acknowledgement modal (localStorage)
│       ├── features/auth/components/
│       │   └── ✏️ AuthForm.tsx              # Hides /signup cross-link in demo mode
│       ├── lib/
│       │   └── ✏️ constants.ts              # IS_DEMO_MODE, DEMO_CREDENTIALS, DEMO_ACK_STORAGE_KEY, ROUTES.LEGAL
│       ├── pages/
│       │   ├── 🆕 legal_page.tsx            # Full disclaimer + terms page (public, no auth)
│       │   ├── ✏️ login_page.tsx            # "Try the Demo" one-click auto-login button
│       │   └── ✏️ signup_page.tsx           # Replaced form with info panel in demo mode
│       ├── router/
│       │   └── ✏️ index.tsx                 # Mounts DemoBanner + DemoDisclaimerModal at router root; adds /legal route
│       └── ✏️ vite.config.ts               # demoHtmlMeta() plugin for noindex + title suffix
├── infrastructure/
│   ├── ✏️ build-and-push.sh                # DEMO_MODE + FORCE_NEW_DEPLOYMENT flags; maps to VITE_DEMO_MODE
│   ├── ✏️ README.md                        # Updated build + deploy instructions
│   ├── cloudformation/
│   │   └── ✏️ pocket-family-stack.yaml     # Minor updates
│   └── terraform/
│       ├── 🆕 aurora_free.tf               # Aurora Serverless v2 free-tier config
│       ├── ❌ aurora.tf → aurora.tf.disabled # Disabled in favour of aurora_free.tf
│       ├── ✏️ ecs.tf                        # DEMO_MODE env var injected; cpu allocated per container; demo reset task def
│       ├── 🆕 eventbridge.tf               # EventBridge daily reset rule + IAM role (demo_mode=true only)
│       ├── ✏️ network.tf                   # Minor VPC/subnet tweaks
│       ├── ✏️ outputs.tf                   # Added outputs for new resources
│       └── ✏️ variables.tf                 # Added demo_mode (bool) and demo_reset_cron variables
├── .env.aws.production.example              # DEMO_MODE + VITE_DEMO_MODE documented
└── .env.example                             # Updated accordingly
```

---

## Files Changed — Detailed Breakdown

### Demo Mode Flag & Backend Hardening

**`backend/api/app/auth.py`** — MODIFIED
- **Purpose**: Central auth utility module (JWT, hashing, token helpers).
- **Key changes**: Added `is_demo_mode()` (reads `DEMO_MODE` env var) and
  `assert_not_demo()` — a lightweight FastAPI dependency that raises
  `HTTP 403` when the flag is set. Keeping these in `auth.py` (rather than
  a separate file) co-locates them with the other environment-flag helpers
  like `is_test_mode()`.

**`backend/api/app/rate_limit.py`** — NEW
- **Purpose**: Shared `slowapi.Limiter` singleton imported by both `main.py`
  (for app-state registration) and individual routers (for per-route
  `@limiter.limit(...)` decorators). A single shared instance keeps the
  limit registry consistent and avoids circular imports.

**`backend/api/app/main.py`** — MODIFIED
- **Purpose**: FastAPI application entry point.
- **Key changes**:
  - Registered the rate limiter and its `RateLimitExceeded` exception handler.
  - On `startup`, if `DEMO_MODE=1`, calls `ensure_demo_user()` so a fresh
    deploy is immediately usable without manual intervention.
  - The call is wrapped in a try/except so a failing seed step does not
    crash the API on startup.

**`backend/api/app/routers/auth.py`** — MODIFIED
- **Key changes**:
  - `/auth/signup` gets `dependencies=[Depends(assert_not_demo)]` — the
    backend 403s the endpoint independently of any UI-level gating so the
    restriction cannot be bypassed by an API client.
  - `/auth/login` is rate-limited to **10 requests per minute** per IP via
    `@limiter.limit("10/minute")`. The `request: Request` parameter is added
    to satisfy `slowapi`'s inspection requirement.
  - `/tenants/{tenant_id}/invite` blocked in demo mode.

**`backend/api/app/routers/tenants.py`** — MODIFIED
- **Key changes**: `assert_not_demo` dependency added to tenant delete,
  member create, member update, and member delete routes — preventing a
  visitor from destroying the shared demo tenant or its membership.

### Demo Data Scripts

**`backend/scripts/ensure_demo_user.py`** — NEW
- **Purpose**: Idempotent provisioner for the shared demo account. Creates
  the `demo@pocket-family.com` user, a "Demo Family" tenant, an owner
  membership, and seeds default categories/accounts if any of those are
  missing. Safe to call repeatedly — existing rows are left untouched.
- **Impact**: Called on every API startup (when `DEMO_MODE=1`) and can also
  be run as a one-shot ECS task for repair or verification.

**`backend/scripts/seed_demo_data.py`** — NEW
- **Purpose**: Daily reset script. Wipes the demo tenant's mutable data
  (transactions, accounts, budgets, non-owner memberships, invites) and
  re-seeds ~1 000 transactions spread across a 90-day trailing window.
  Preserves the user/tenant/owner-membership so the demo login credentials
  keep working across resets.
- **Impact**: Produces a realistic, always-fresh dataset across five spending
  categories (Food 30%, Leisure 20%, Bills 20%, Transport 15%, Other 15%)
  with believable descriptions and amount ranges. Uses `random.seed(42)` for
  deterministic shape across runs; dates roll forward because they're
  anchored to `date.today()` at run time.

**`backend/api/Dockerfile`** — MODIFIED
- **Key change**: Added `COPY scripts/ /app/scripts/` so the one-shot
  `seed_demo_data.py` reset task can share the same backend Docker image
  rather than requiring a separate image build.

**`backend/pyproject.toml`** — MODIFIED
- **Key change**: Added `slowapi==0.1.9` to production dependencies (pinned
  for reproducibility; no Redis required — in-process counters are
  sufficient for the demo traffic profile).

### Frontend — Demo UI

**`frontend/src/lib/constants.ts`** — MODIFIED
- **Key additions**:
  - `IS_DEMO_MODE` — resolved at compile time from `VITE_DEMO_MODE` env var.
    All demo-mode UI gates read this single constant rather than reaching
    into `import.meta.env` directly, keeping demo logic centralised.
  - `DEMO_CREDENTIALS` — email/password of the shared account, referenced
    by the "Try the Demo" button.
  - `DEMO_ACK_STORAGE_KEY` — localStorage key for the first-visit
    acknowledgement timestamp.
  - `ROUTES.LEGAL` — `/legal` added to the centralised route map.

**`frontend/src/components/ui/organisms/DemoBanner.tsx`** — NEW
- **Purpose**: Sticky warning bar mounted at the top of every page on the
  demo instance (above the app bar). Returns `null` when `IS_DEMO_MODE` is
  false, so it can be mounted unconditionally at the router root without
  any call-site logic.
- **Impact**: Uses MUI `Alert severity="warning" variant="filled"` in
  borderless full-width mode. Links to `/legal` for full terms.

**`frontend/src/components/ui/organisms/DemoDisclaimerModal.tsx`** — NEW
- **Purpose**: First-visit acknowledgement dialog. Blocks all interaction
  until the visitor explicitly clicks "I understand — continue to demo".
  The acknowledgement timestamp is persisted in localStorage so returning
  visitors are not re-prompted. Returns `null` for non-demo builds.
- **Impact**: Uses `disableEscapeKeyDown` to prevent dismissal without
  explicit acceptance; `fullWidth maxWidth="sm"` for mobile readability.

**`frontend/src/pages/legal_page.tsx`** — NEW
- **Purpose**: Public disclaimer and terms-of-use page reachable at `/legal`
  without authentication. Ten sections covering nature of the service, AS-IS
  warranty, no-PII policy, shared account / no-privacy notice, daily data
  reset, limitation of liability, acceptable use, indemnification, changes,
  and contact.
- **Impact**: Linked from `DemoBanner`, `DemoDisclaimerModal`, and the
  `/signup` info panel. No auth required — accessible from any app state.

**`frontend/src/pages/login_page.tsx`** — MODIFIED
- **Key change**: When `IS_DEMO_MODE` is true, renders a prominent
  "Try the Demo" `Button` above the standard login form. Clicking it
  invokes the same `useLogin` mutation with `DEMO_CREDENTIALS` so the
  visitor is signed in immediately without typing anything.

**`frontend/src/pages/signup_page.tsx`** — MODIFIED
- **Key change**: In demo mode the `AuthForm` is replaced with a static
  info panel explaining that account creation is disabled, and a button
  redirecting to `/login`. This prevents visitors from accidentally trying
  to sign up and hitting the backend 403.

**`frontend/src/features/auth/components/AuthForm.tsx`** — MODIFIED
- **Key change**: The "Don't have an account? Sign up" cross-link is hidden
  in demo mode (when `IS_DEMO_MODE && !isSignup`). The "Already have an
  account? Log in" link is always shown because it is useful even on the
  informational signup page.

**`frontend/src/router/index.tsx`** — MODIFIED
- **Key changes**:
  - `<DemoBanner />` and `<DemoDisclaimerModal />` mounted at the router
    root so they appear on every public and protected page without any
    per-route conditionals.
  - `/legal` route added (public, no auth wrapper needed).

**`frontend/vite.config.ts`** — MODIFIED
- **Key change**: New `demoHtmlMeta()` Vite plugin intercepts
  `transformIndexHtml` to inject `<meta name="robots" content="noindex,nofollow" />`
  and suffix the page title with `— Demo` when `VITE_DEMO_MODE=true`.
  Runs at build time so no client-side DOM manipulation is needed.

**`frontend/public/robots.txt`** — NEW
- Default policy for non-demo builds: `Allow: /` (permits all crawlers).

**`frontend/public/robots.demo.txt`** — NEW
- Demo-instance policy: `Disallow: /` (blocks all crawlers). The backend
  Dockerfile copies this over `robots.txt` when `VITE_DEMO_MODE=true`.

### Infrastructure

**`infrastructure/terraform/eventbridge.tf`** — NEW
- **Purpose**: All AWS resources for the daily demo data reset, gated on
  `var.demo_mode = true` via `count = var.demo_mode ? 1 : 0`.
  - A second ECS task definition (`demo-reset`) using the same backend image
    with a command override: `uv run python /app/scripts/seed_demo_data.py`.
  - An EventBridge rule on `var.demo_reset_cron` (default: 06:00 UTC daily).
  - An IAM role EventBridge assumes to call `ecs:RunTask`, plus
    `iam:PassRole` for the task execution + task roles.
- **Impact**: RunTask spins up a Fargate task on demand and terminates it
  when the script exits, so the reset incurs only seconds of compute cost.

**`infrastructure/terraform/ecs.tf`** — MODIFIED
- **Key changes**:
  - `DEMO_MODE` injected into `backend_environment` locals (value is
    `"1"` or `"0"` depending on `var.demo_mode`).
  - Explicit `cpu = 256` added to both container definitions so Fargate
    can schedule them on the smallest (0.25 vCPU) allocation.

**`infrastructure/terraform/variables.tf`** — MODIFIED
- **Key additions**:
  - `demo_mode` (bool, default `false`) — master switch for all demo
    infrastructure.
  - `demo_reset_cron` (string, default `"cron(0 6 * * ? *)"`) — overridable
    EventBridge cron expression.

**`infrastructure/terraform/aurora_free.tf`** — NEW
- Free-tier Aurora Serverless v2 configuration used for the demo deployment
  (replaces `aurora.tf` which is renamed to `aurora.tf.disabled`).

**`infrastructure/build-and-push.sh`** — MODIFIED
- **Key changes**:
  - `DEMO_MODE=0/1` flag added; mapped to `VITE_DEMO_MODE=false/true` for
    the Vite build arg (frontend needs it baked in; backend reads it at
    runtime from ECS task definition environment).
  - `FORCE_NEW_DEPLOYMENT=1` flag triggers `aws ecs update-service
    --force-new-deployment` after the push, useful when the image tag
    stays `latest` and the task definition is otherwise unchanged.

---

## Testing Strategy

> [!warning] Test Coverage
> This branch focuses on operational / demo infrastructure. No new automated
> tests were added for the demo-mode UI gates or the seed scripts.
>
> **Recommended follow-up**:
> - Frontend: integration tests for `DemoBanner`, `DemoDisclaimerModal`,
>   and the "Try the Demo" login button under `IS_DEMO_MODE = true`.
> - Backend: pytest cases asserting `HTTP 403` on signup and member-management
>   routes when `DEMO_MODE=1`.
> - Seed script: smoke test that `seed_demo_data.py` runs to completion
>   against a test database without errors.

---

## Migration Notes

### New Environment Variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `DEMO_MODE` | Backend (ECS env) | `0` | Enables API restrictions |
| `VITE_DEMO_MODE` | Frontend (build arg) | `false` | Enables UI demo mode |

**Non-demo deployments**: no action required — both variables default to off.

**Demo deployment**:
1. Pass `DEMO_MODE=1` to `build-and-push.sh` to bake `VITE_DEMO_MODE=true` into the frontend image.
2. Add `-var="demo_mode=true"` to `terraform apply` to create the EventBridge reset rule.
3. Set `DEMO_MODE=1` in the ECS task definition environment (Terraform handles this automatically).

### Rate Limiter Dependency

`slowapi==0.1.9` is now a **production dependency** (not dev-only). The
`uv.lock` file is updated accordingly. No additional infrastructure is
needed — the limiter runs in-process.

---

## Performance Impact

- **Backend startup**: `ensure_demo_user()` adds one DB round-trip on startup
  in demo mode. Wrapped in try/except; does not delay non-demo startups.
- **Frontend bundle**: `DemoBanner` and `DemoDisclaimerModal` are part of
  the main bundle in all builds but are no-op components (return `null`)
  unless `IS_DEMO_MODE` is true. Tree-shaking eliminates the JSX in
  production non-demo builds.
- **Rate limiter**: In-process counter with negligible overhead; no external
  service dependency.

---

## Next Steps / Follow-up Work

- **Automated tests** for demo mode UI and API restrictions (see Testing
  Strategy above).
- **Monitoring**: Add a CloudWatch alarm on the `demo-reset` ECS task's
  exit code so failed resets are caught before the next day's visitors see
  stale data.
- **Token / session reset on daily wipe**: Currently a visitor who is logged
  in when the nightly reset runs will hold a valid JWT but the underlying
  data will look different. A forced logout (e.g. invalidating all refresh
  tokens for the demo user) after the seed script would give a cleaner
  experience.
- **Demo analytics**: Consider logging demo visits (page views, "Try the
  Demo" clicks) to understand showcase conversion before investing further
  in the demo experience.

---

## Related Documentation

> [!info] Related Concepts
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] — `assert_not_demo()` FastAPI dependency, JWT, demo credential flow
> - [[../knowledge/glossary/api-communication|API Communication]] — rate limiting, HTTP 403 patterns, endpoint gating
> - [[../knowledge/glossary/frontend-build-configuration|Frontend Build & Configuration]] — `VITE_DEMO_MODE`, Vite plugins, build-time env vars
> - [[../knowledge/glossary/ui-components-design|UI Components & Design]] — `DemoBanner`, `DemoDisclaimerModal`, MUI Alert / Dialog patterns
> - [[../knowledge/glossary/routing-navigation|Routing & Navigation]] — `/legal` public route, router-root component mounting
> - [[../knowledge/glossary/development-workflow|Development Workflow]] — Terraform, EventBridge, ECS RunTask, build-and-push.sh
> - [[../knowledge/glossary/state-management|State Management]] — localStorage for demo acknowledgement persistence

### Technical Glossary

> [!info] Learning Resources
> New to the project? Start with the [[../knowledge/glossary/glossary|Technical Glossary]] for:
> - [[../knowledge/glossary/frontend-build-configuration|Frontend Build & Configuration]] — Vite, TypeScript, build-time vs runtime config
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] — FastAPI dependencies, JWT, multi-tenant safety
> - [[../knowledge/glossary/development-workflow|Development Workflow]] — Docker, Terraform, ECS, CI/CD patterns
> - [[../knowledge/glossary/testing|Testing]] — recommended test patterns for this feature
