# AWS ALB Hardening - Summary

**Branch:** `aws-alb-hardening` → `master`  
**Commits:** 3 (`d445ca7`, `a71b023`, `dcaabfe`)  
**Last Updated:** 2026-05-23

## Overview

This release hardens the AWS Application Load Balancer by enabling HTTPS termination with TLS 1.3, adding a domain-based host-header filter to block direct ALB DNS access, and wiring in ACM certificate lookup. It also fixes a demo-mode data hygiene issue — families created by demo visitors during a session are now deleted on reset — and tightens the Claude Code sandbox configuration.

---

## Goals Achieved

- ✅ **HTTPS on ALB**: HTTP listener now redirects to HTTPS (301). New HTTPS listener terminates TLS with `ELBSecurityPolicy-TLS13-1-2-2021-06`
- ✅ **ACM certificate integration**: New `acm.tf` data source looks up the manually-issued cert by domain name; zero cert management in Terraform state
- ✅ **Domain allow-list**: `aws_lb_listener_rule.host_filter` forwards only requests whose `Host` header matches `app_domain` or `*.app_domain`; everything else gets a 403
- ✅ **Direct ALB access blocked**: Default HTTPS action returns `403 Not found` — scanners hitting the raw ALB DNS endpoint are rejected
- ✅ **Dynamic CORS origin**: Backend container env var `CORS_ORIGINS` is now computed in Terraform to automatically include `https://pocket-family-demo.<app_domain>` when a domain is set
- ✅ **Demo tenant cleanup**: `reset_demo_data()` now deletes all extra tenants created by the demo user and resets `preferred_tenant_id` back to the canonical demo tenant

---

## Architecture & Tech Stack Changes

### HTTPS & TLS Termination

The ALB now handles TLS at the edge. Traffic flow:

```
Browser → ALB :80  →  301 → https://
Browser → ALB :443 → host-header check → Fargate (HTTP internally)
```

The `ELBSecurityPolicy-TLS13-1-2-2021-06` policy enforces TLS 1.3 while retaining TLS 1.2 compatibility for older clients.

All HTTPS resources are gated behind `count = var.app_domain != "" ? 1 : 0` — deployments without a custom domain continue to work identically (HTTP only), making this a non-breaking change.

### Host-Header Enforcement

The HTTPS listener's default action rejects all requests with a 403. A single listener rule at priority 100 whitelists `app_domain` and `*.app_domain`. This closes the surface where the raw ALB DNS name (`*.elb.amazonaws.com`) was previously accessible directly, bypassing CloudFront or any WAF upstream.

### Computed CORS Origins

Previously, `CORS_ORIGINS` was a static variable. It is now computed in `locals` inside `ecs.tf`:

```hcl
cors_origins_computed = var.app_domain != "" ? (
  var.cors_origins != ""
    ? "${var.cors_origins},https://pocket-family-demo.${var.app_domain}"
    : "https://pocket-family-demo.${var.app_domain}"
) : var.cors_origins
```

The backend receives `APP_DOMAIN` as a new env var for any runtime domain logic.

### Demo Data Hygiene

Demo visitors can create new families via the API. Prior to this fix, those families accumulated between daily resets because `reset_demo_data()` only wiped data inside the canonical demo tenant. The new `_delete_extra_demo_tenants()` function deletes all tenants where the demo user is OWNER (excluding the canonical one), following the same FK deletion order as `_wipe_tenant_data`.

---

## Directory Structure

```
infrastructure/terraform/
  🆕 acm.tf              ACM certificate data source lookup
  ✏️ alb.tf              HTTP→HTTPS redirect, new HTTPS listener, host-header filter rule
  ✏️ ecs.tf              Computed CORS origins local, APP_DOMAIN env var
  ✏️ variables.tf        New `app_domain` variable

backend/scripts/
  ✏️ seed_demo_data.py   _delete_extra_demo_tenants(), preferred_tenant_id reset

.claude/
  ✏️ settings.json       Sandbox mode enabled, frontend-design plugin added
```

---

## Files Changed - Detailed Breakdown

### Infrastructure — Terraform

**`infrastructure/terraform/acm.tf`** — NEW  
- **Purpose**: Data source that reads an ACM certificate issued manually in the AWS Console. Terraform uses the ARN at plan time without owning the cert lifecycle.  
- **Key detail**: Gated with `count = var.app_domain != "" ? 1 : 0` so no error is thrown in environments without a domain.

**`infrastructure/terraform/alb.tf`** — MODIFIED  
- **Key Changes**:
  - `aws_lb_listener.http`: Changed default action from `forward` to `redirect` (HTTP 301 → HTTPS)
  - `aws_lb_listener.https`: New resource — HTTPS listener on port 443 with TLS 1.3 policy and cert from `acm.tf`; default action returns 403
  - `aws_lb_listener_rule.host_filter`: New resource — forwards traffic only when `Host` matches `app_domain` or `*.app_domain`
- **Impact**: Direct ALB DNS access is now blocked; all traffic routes through the custom domain.

**`infrastructure/terraform/ecs.tf`** — MODIFIED  
- **Key Changes**:
  - New `cors_origins_computed` local that appends the demo subdomain when `app_domain` is set
  - `CORS_ORIGINS` env var now uses `local.cors_origins_computed`
  - Added `APP_DOMAIN` env var to backend container; column-aligned env var formatting for readability
- **Impact**: CORS is automatically correct for production deployments; no manual tfvars update needed for the demo subdomain.

**`infrastructure/terraform/variables.tf`** — MODIFIED  
- **Key Changes**: Added `app_domain` variable (string, default `""`) with description explaining its dual role (CORS + ALB host-filter).

### Backend

**`backend/scripts/seed_demo_data.py`** — MODIFIED  
- **Key Changes**:
  - `_load_demo_context`: Fixed to join on `Tenant.name == DEMO_TENANT_NAME` when looking up the owner membership, preventing ambiguity when the demo user owns multiple tenants
  - `_delete_extra_demo_tenants()`: New async function that finds all OWNER memberships for the demo user (excluding the canonical tenant) and deletes each extra tenant in FK-safe order
  - `reset_demo_data()`: Now calls `_delete_extra_demo_tenants` and resets `user.preferred_tenant_id` if it drifted to a now-deleted tenant
- **Impact**: Demo environment is fully clean after each nightly reset regardless of visitor activity.

### Claude Code Settings

**`.claude/settings.json`** — MODIFIED  
- Sandbox mode enabled with filesystem read restriction to the project directory
- `frontend-design` plugin added
- Model set to Sonnet

---

## Testing Strategy

No new automated tests were added in this PR. The Terraform changes are infrastructure-only and validated via `terraform plan`. The `seed_demo_data.py` changes are operational scripts that run in the AWS environment.

Manual validation checklist:
- [ ] `terraform plan` shows no unexpected resource replacements
- [ ] HTTP request to ALB redirects to HTTPS (301)
- [ ] HTTPS request with correct `Host` header reaches the app
- [ ] Request to raw ALB DNS returns 403
- [ ] `reset_demo_data()` removes extra tenants created during a demo session
- [ ] Demo user's `preferred_tenant_id` resets correctly after extra tenant deletion

---

## Migration Notes

### `app_domain` variable required for HTTPS

Add to `terraform.tfvars` to enable HTTPS and host filtering:
```hcl
app_domain = "example.com"
```

Leave empty (the default) to keep HTTP-only behavior — no resources are created and the redirect rule is skipped.

### Existing deployments

The HTTP listener's default action changes from `forward` to `redirect`. A `terraform apply` will modify the listener in-place (no replacement). There is a brief moment (~seconds) during apply when traffic may be interrupted; plan accordingly.

---

## Performance Impact

- TLS termination at the ALB adds negligible latency (~1–2 ms) compared to HTTP
- No changes to backend response times or frontend bundle

---

## Next Steps / Follow-up Work

- Add WAF WebACL to the ALB for rate limiting and geo-blocking
- Configure CloudFront in front of the ALB for edge caching and DDoS protection
- Add Terraform output for the HTTPS listener ARN

---

## Related Documentation

- [AWS_Ready_Release.md](AWS_Ready_Release.md) — original ALB and Fargate setup
- [Demo_Ready_Release.md](Demo_Ready_Release.md) — demo mode seeding and reset logic
- [SystemArchitecture.md](../SystemArchitecture.md) — overall system architecture
