# Backend refactor: extract a `services/` layer, add `require_role`, close the true HIGH findings

## Context

Routers under `backend/api/app/routers/` are "fat" — each handler mixes HTTP/routing concerns with DB queries, business rules, authorization checks, and response building. There is **no existing service/repository/controller layer** (confirmed: no docs prescribe one; `repo-structure.md` documents the flat router-centric layout). Two concrete problems flow from this:

1. **Misleading helpers.** `_serialize_account` doesn't just serialize — it applies the balance-visibility *access policy* and resolves the owner's name. `_serialize_account_share` *enriches* a share with a human-readable tenant name. The names lie about what the code does.
2. **Authorization re-implemented inline per handler.** The QCSD executive summary names this the *root cause* of all three HIGH SoD findings: "Introduce a reusable `require_role(...)` dependency so authorization stops being re-implemented inline per handler" (recommended action #4). There are **18 inline role checks** scattered across 5 routers, plus one that compares against the string `"owner"` instead of the enum (`auth.py:388`).

**Goal:** Introduce `app/services/` (decision: "services"), move non-routing logic there with corrected names, add a reusable `require_role(...)` dependency, and in the same pass close the QCSD HIGH recommended actions (4 actions; 3 true findings — Finding 2 is a documented false positive: accounts are user-scoped/personal, role-independent for CRUD by design). Scope: **all routers in one pass.**

Behavior must be **preserved** everywhere except **one deliberate security fix** (Finding 1, below), which is the point of the exercise.

---

## Part A — New `app/services/` package (extract + rename)

Create `backend/api/app/services/` with `__init__.py` and one module per domain. Service functions take the `AsyncSession` as a **plain first argument** (`session`), *not* via `Depends` — this is what makes them reusable and unit-testable outside the request cycle. Routers keep: route decorators, dependency injection, HTTP status codes, and orchestration only.

**Naming convention to establish** (documented in `backend/CLAUDE.md`):
- `build_<entity>_read(session, record, ...)` → assembles the API response DTO (joins, enrichment, policy-based masking).
- `can_<verb>_<entity>(session, record, actor) -> bool` → authorization predicate (returns bool).
- `authorize_<thing>(session, ...)` → validates and **raises** `HTTPException` on failure, returns the validated object.
- Pure/util helpers keep plain descriptive names (`balance_delta`, `parse_amount`).

### Rename map (the misleading ones flagged first)

| Current (router-private) | New (in `services/`) | Why the rename |
|---|---|---|
| `accounts.py::_serialize_account` (16-59) | `services/accounts.py::build_account_read` | Resolves owner name + applies balance-visibility policy + builds DTO — it *builds a response*, not "serialize". |
| `accounts.py::_serialize_account_share` (62-87) | `services/accounts.py::build_account_share_read` | Enriches the share with the human-readable tenant name; builds the `AccountShareRead` DTO. |
| `accounts.py::_requestor_can_access_account` (245-274) | `services/accounts.py::can_access_account` | Already a clean authz predicate; relocate + drop `_`. |
| `transactions.py::_authorize_account_for_tenant` (26-64) | `services/transactions.py::authorize_account_for_tenant` | Cross-tenant write guard; central place for Finding 3. |
| `transactions.py::_balance_delta` (67-78) | `services/transactions.py::balance_delta` | Pure function. |
| `transactions.py::_fetch_transaction_with_names` (81-132) | `services/transactions.py::build_transaction_read` | Joins names/icons → builds the `TransactionRead` DTO. |
| `transactions.py::_rows_to_transaction_reads` (135-163) | `services/transactions.py::rows_to_transaction_reads` | Relocate. |
| `categories.py::_fetch_category_with_parent` (15-42) | `services/categories.py::build_category_read` | Joins parent name → builds DTO. |
| `budgets.py::_fetch_categories_for_budget`, `_calculate_spent_for_budget`, `_build_budget_read`, `_validate_category_ids_belong_to_tenant`, `_sync_budget_categories` (43-261) | `services/budgets.py::{fetch_categories_for_budget, calculate_spent_for_budget, build_budget_read, validate_category_ids_belong_to_tenant, sync_budget_categories}` | Relocate; `_build_budget_read`→`build_budget_read`. |
| `imports.py::_decode_csv_bytes, _parse_csv, _parse_amount, _normalize_type, _validate_file_key_ownership` (78-186) | `services/imports.py::{decode_csv_bytes, parse_csv, parse_amount, normalize_type, validate_file_key_ownership}` | Relocate (pure CSV/parsing logic). |
| `auth.py::get_membership_for_user` (30-73) | `services/auth.py::resolve_membership_for_user` | Relocate; name reflects the three-tier resolution it does. |

Each router imports its service module (e.g. `from ..services import accounts as account_service`) and replaces inlined helper bodies with calls. Handlers shrink to routing + orchestration.

---

## Part B — Reusable `require_role(...)` dependency (QCSD action #4, the root-cause fix)

Add to `backend/api/app/deps.py`:

```python
def require_role(*allowed_roles: MembershipRole):
    """Dependency factory: allow the request only if the caller's ACTIVE-tenant
    membership role is one of `allowed_roles`; otherwise 403. Returns the same
    ActiveContext so handlers keep their user/tenant/membership."""
    async def _require_role(
        active_context: ActiveContext = Depends(get_active_context),
    ) -> ActiveContext:
        if active_context.active_membership.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="insufficient role for this action")
        return active_context
    return _require_role
```

Provide two intent-revealing aliases next to it:
- `require_owner = require_role(MembershipRole.OWNER)`
- `require_writer = require_role(MembershipRole.OWNER, MembershipRole.MEMBER)`  *(i.e. "not viewer")*

**Apply** by swapping `Depends(get_active_context)` → `Depends(require_owner/require_writer)` and **deleting the now-redundant inline `if ... role ...: raise 403` block**, at these sites (all authorize against the *active* tenant, so the dependency fits cleanly):

- `categories.py:58, 145, 189` (owner-only) → `require_owner`
- `budgets.py:399, 473, 560` (owner-only) → `require_owner`
- `transactions.py:191, 395, 490` (viewer-blocked writes) → `require_writer`
- `imports.py:198, 269, 408, 515, 564` (viewer-blocked) → `require_writer`
- `auth.py:388` — also **fix the latent bug**: it compares `role != "owner"` (string) instead of `MembershipRole.OWNER`. Replace with `require_owner`.

**Explicitly out of scope for `require_role`:** `tenants.py` member/role-management endpoints (142, 175, 267, 341, 390, 405…) authorize against the **path** `tenant_id`, which can differ from the active tenant. `require_role` keys off the *active* context, so applying it there would be incorrect. Leave those as-is in this pass (or factor a separate `resolve_path_membership(session, user, path_tenant_id)` helper into `services/tenants.py` — optional). Personal-account CRUD in `accounts.py` is **intentionally not** given a role guard (see Finding 2).

---

## Part C — Close the QCSD HIGH recommended actions (4 actions; 3 true findings)

- **Action #4 — reusable `require_role`** → delivered by Part B. ✅
- **Action #1 / Finding 2 — account authorization model.** Resolution is to **document the invariant**, not add guards: *Accounts are user-scoped (personal); `create/update/delete` are owner-or-role-independent by design.* Add a short invariant note to `docs/north_star.md` and an inline "why" comment on the accounts router. **No code guard added** (adding one would be the mischaracterized "fix"). ✅
- **Action #2 / Finding 1 — `create_account_share` missing target-tenant guard (REAL).** Extract the inline block in `create_account` (`accounts.py:110-142`: target tenant exists → active membership → non-viewer) into `services/accounts.py::authorize_share_target(session, user, target_tenant_id)` and call it from **both** `create_account` *and* `create_account_share` (339-370), which currently only checks account ownership. **This is the one deliberate behavior change** (a non-member/viewer can no longer share via the dedicated endpoint) — covered by a new test. ✅
- **Action #3 / Finding 3 — `AccountShare` has no read/write scope (REAL).** Full fix = a model field + migration + a product decision on the default, which does not belong in a behavior-preserving refactor PR. In this pass: (a) **centralize** the write guard so there is exactly one place to enforce scope later — `services/transactions.py::authorize_account_for_tenant` and the import write-path both route through it; (b) **document** the current invariant ("any AccountShare = full write delegation") next to the Finding 2 note. Recommend a **follow-up PR** to add `SharePermission(READ|READ_WRITE)` to `AccountShare` + Alembic migration + enforce `READ_WRITE` in the centralized guard. ✅ (documented + centralized; deep fix flagged)

---

## Files touched

- **New:** `backend/api/app/services/__init__.py`, `services/{accounts,transactions,categories,budgets,imports,auth}.py`
- **Edit:** `backend/api/app/deps.py` (add `require_role` + aliases); all 7 routers (thin out, swap dependencies, import services); `docs/north_star.md` + `backend/CLAUDE.md` (invariants + the new layering/naming convention)
- **Verify intact:** the `create_account_share` route decorator (`accounts.py:338`) rendered oddly when read (`@router.post("Ta,`) — confirm the path string is correct before/after editing.

## Verification

1. **Tests (primary gate):** `cd backend/api && uv run pytest -v`. The venv python lives outside the sandbox — run with **sandbox disabled**, and fall back to the venv's `python -m pytest` if `uv` is unavailable. All currently-passing tests must stay green (refactor preserves behavior).
2. **New tests** (follow `backend/CLAUDE.md` conventions, in `backend/api/tests/`):
   - `create_account_share` returns 403 for a viewer / non-member of the target tenant (Finding 1).
   - `require_role`: a viewer gets 403 on a `require_writer` route; a member gets 403 on a `require_owner` route; happy paths pass.
   - Re-assert one multi-tenant isolation test per refactored router still holds.
3. **Coverage:** `uv run pytest --cov=app` — should not regress (logic moved, not removed); targets per `backend/CLAUDE.md` (~85% lines / ~80% branches).
4. **Smoke:** `uv run uvicorn app.main:app --reload` boots without import errors (catches broken service imports).
5. No migration is created in this pass (no model change). No commits/push without explicit request.

## Suggested commit slicing (single PR, reviewable in order)

1. Add `services/` package + move/rename helpers (pure relocation, behavior-identical).
2. Add `require_role` to `deps.py`; swap the 17 active-tenant role sites + fix `auth.py:388`.
3. Finding 1 fix: `authorize_share_target` shared by both share paths (+ test).
4. Docs: invariants (Findings 2 & 3) + layering/naming convention.
