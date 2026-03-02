---
Overview: "Hardening" consolidates critical security and reliability fixes across the full stack: a same-origin reverse proxy that permanently resolves the SameSite cookie logout bug, backend RBAC enforcement for the viewer role, frontend role-aware UI, modal-first navigation for transactions and accounts, and a suite of smaller UX bug fixes.
Date: 2026-02-26
branch: "`hardening` → `master`"
code_changed: 25 files changed, +332 insertions, -143 deletions
commits: uncommitted working-tree changes
tags:
  - release_notes
  - frontend
  - backend
  - security
  - bugfix
---

# Hardening Release: Security, RBAC, and UX Reliability

## Overview

This release addresses three interconnected problem areas discovered after Sprint 7:

1. **Users were being logged out every 15 minutes** — The refresh token cookie was silently dropped by the browser due to a SameSite cross-origin mismatch between the Vite dev server and the backend. The fix routes all API traffic through a same-origin proxy (Vite in dev, nginx in production).
2. **Viewers could bypass role restrictions** — The `viewer` membership role was only a convention; no backend endpoint actually enforced it. The backend now returns 403 for all write operations when the caller's role is `viewer`.
3. **Add Transaction / Add Account UX was fragmented** — Dedicated `/new` routes required full page navigations for simple creation flows. These are replaced with inline modal dialogs that keep users in context.

---

## Goals Achieved

- ✅ Eliminate the 15-minute forced logout caused by cross-origin cookie blocking
- ✅ Enable silent session restoration when the access token has expired but the refresh cookie is valid
- ✅ Enforce `viewer` role server-side for transactions and accounts
- ✅ Enforce `owner`-only budget creation in the frontend UI
- ✅ Surface role-awareness in all list pages (`TransactionsPage`, `AccountsPage`, `BudgetsPage`)
- ✅ Replace dedicated `/new` page routes with inline modal dialogs
- ✅ Add session memory for transaction creation (pre-fill repeated fields)
- ✅ Fix global accounts view (was including other members' shared accounts)
- ✅ Auto-unshare accounts when a member leaves or is removed from a family
- ✅ Fix `AddCategoryModal` stale state on re-open
- ✅ Document the proxy/cookie/CORS architecture in `docs/knowledge/network.md`

---

## Architecture & Tech Stack Changes

### New: Same-Origin Reverse Proxy

> [!info] Related Concepts
> - [[../glossary/authentication-security|Authentication & Security]] — HttpOnly cookies, SameSite attribute, refresh token lifecycle
> - [[../glossary/frontend-build-configuration|Frontend Build & Configuration]] — Vite proxy, `vite.config.ts`, environment variables
> - [[../glossary/api-communication|API Communication]] — `credentials: 'include'`, CORS, same-origin policy

All API calls from the browser now go through a proxy on the same origin as the frontend, rather than directly to `backend:8000`. This is the foundational change that makes [[../glossary/authentication-security|HttpOnly cookie]] delivery reliable across all environments. See [[../glossary/frontend-build-configuration|Vite proxy configuration]] and [[../glossary/development-workflow|Docker Compose networking]] for implementation details.

| Layer | Old | New |
|---|---|---|
| `VITE_API_URL` (dev & prod) | `http://192.168.1.101:8000` | `/api` |
| Vite dev server | Direct cross-origin calls | Proxies `/api/*` → `localhost:8000/*` |
| nginx (production) | Not proxying | Proxies `/api/*` → `backend:8000/*` |

See `docs/knowledge/network.md` for the full technical explanation.

### New: Backend Role Enforcement (RBAC)

> [!info] Related Concepts
> - [[../glossary/authentication-security|Authentication & Security]] — Role-based access control, membership roles
> - [[../glossary/api-communication|API Communication]] — 403 Forbidden responses, FastAPI dependency injection

The `MembershipRole.VIEWER` constant was already in the data model but was never checked at the endpoint level. This release adds explicit guards to prevent viewers from writing data.

### New: Modal-First Navigation Pattern

> [!info] Related Concepts
> - [[../glossary/react-patterns-hooks|React Patterns & Hooks]] — State-driven modals, conditional rendering
> - [[../glossary/routing-navigation|Routing & Navigation]] — React Router `location.state`, `useNavigate`
> - [[../glossary/state-management|State Management]] — `sessionStorage` for cross-render persistence, `useState` for modal control

Dedicated `/new` routes for transactions and accounts are removed in favour of [[../glossary/ui-components-design|`Dialog`-based modals]] managed with local `useState`. This avoids unnecessary page navigations for simple creation forms.

---

## Directory Structure

```
backend/api/app/routers/
  ✏️ accounts.py       — Added viewer check on create; fixed global list (own-only)
  ✏️ tenants.py        — Auto-unshare accounts on member removal
  ✏️ transactions.py   — Added viewer check on create, update, delete

docker-compose.dev.yml   ✏️ MODIFIED — VITE_API_URL changed to /api
docker-compose.yaml      ✏️ MODIFIED — Build arg VITE_API_URL changed to /api

frontend/nginx.conf      ✏️ MODIFIED — Added /api/ reverse proxy block
frontend/vite.config.ts  ✏️ MODIFIED — Added Vite dev server proxy for /api

frontend/src/
  lib/
    ✏️ apiClient.ts               — Skip refresh on login/signup 401s; only logout on 401/403 not network errors

  features/
    auth/context/
      ✏️ AuthContext.tsx           — Silent refresh on app mount; removed hard page reload on auth failure

    family/hooks/
      🆕 useCurrentRole.ts         — Hook: decode current user's membership role from JWT

    accounts/
      components/
        ✏️ AccountForm.tsx          — Added `hideTitle` prop for modal embedding
        🆕 AddAccountModal.tsx      — New: Dialog wrapper for inline account creation
      pages/
        ✏️ AccountsPage.tsx         — Uses AddAccountModal; hides Add button for viewers
        ✏️ AllAccountsPage.tsx      — Uses AddAccountModal instead of /new route

    budgets/pages/
      ✏️ BudgetsPage.tsx           — Owner-only Add Budget button; viewer info alert

    category/components/
      ✏️ AddCategoryModal.tsx      — Sync form state when modal reopens (useEffect on `open`)

    dashboard/components/
      ✏️ QuickActions.tsx          — Navigate to TransactionsPage with openAddModal state flag

    settings/pages/
      ✏️ SettingsPage.tsx          — Auto-close invite modal 1.5 s after success

    transactions/
      components/
        ✏️ TransactionForm.tsx      — Added `hideTitle` + `defaultOverrides` for session memory
        🆕 AddTransactionModal.tsx  — New: Dialog wrapper with sessionStorage-backed defaults
      pages/
        ✏️ TransactionsPage.tsx     — Uses AddTransactionModal; reads openAddModal location state; hides Add for viewers

  components/ui/organisms/
    ✏️ SideNav.tsx                 — Removed flex-shrink reservation; Paper is position:fixed

  router/
    ✏️ index.tsx                   — Removed /new routes for transactions and accounts

docs/knowledge/
  🆕 network.md                    — Knowledge doc: proxy, CORS, SameSite cookie architecture
```

---

## Files Changed — Detailed Breakdown

### Infrastructure: Same-Origin Proxy

**`frontend/vite.config.ts`** — MODIFIED
- **Purpose**: [[../glossary/frontend-build-configuration|Vite development server configuration]].
- **Key Changes**: Added a `server.proxy` block that forwards all `/api/*` requests to the backend (`BACKEND_URL` env var or `localhost:8000`). The `/api` prefix is stripped before forwarding so the backend routes remain unchanged.
- **Impact**: Resolves the cross-origin SameSite cookie problem in development. Developers accessing the app from any host (localhost, LAN IP, etc.) now get reliable cookie delivery.

**`frontend/nginx.conf`** — MODIFIED
- **Purpose**: nginx configuration for the production [[../glossary/development-workflow|Docker]] container that serves the frontend static files.
- **Key Changes**: Added a `location /api/` block that proxies to `http://backend:8000/`. The trailing slash on `proxy_pass` strips the `/api` prefix. The `Cookie` header is explicitly forwarded so FastAPI receives the HttpOnly refresh token.
- **Impact**: Production users no longer get logged out after 15 minutes.

**`docker-compose.dev.yml`** — MODIFIED
- **Key Changes**: `VITE_API_URL` changed from `http://192.168.1.101:8000` to `/api`.
- **Impact**: All `apiFetch()` calls now construct relative URLs (e.g., `/api/auth/login`) that the Vite proxy intercepts.

**`docker-compose.yaml`** — MODIFIED
- **Key Changes**: `VITE_API_URL` build argument changed from `http://192.168.1.101:8000` to `/api`.
- **Impact**: The value is baked into the production JS bundle at build time; the nginx proxy handles routing.

---

### Auth: Silent Refresh and Error Handling

**`frontend/src/features/auth/context/AuthContext.tsx`** — MODIFIED
- **Purpose**: Global authentication state provider, mounted once at the app root.
- **Key Changes**:
  - **Silent refresh on mount**: When the access token is missing or expired at app load, `AuthContext` now calls `POST /auth/refresh` with `credentials: 'include'`. If the [[../glossary/authentication-security|HttpOnly refresh cookie]] is still valid, the user gets a new access token transparently — no redirect to `/login`.
  - **Removed `window.location.href`**: The `clearAuth` callback no longer hard-reloads the page. `ProtectedRoute` handles the redirect reactively when `isAuthenticated` becomes `false`, which avoids losing in-flight UI state.
- **Impact**: Users with valid refresh cookies (logged in within 30 days) are no longer bounced to the login page on every page load after 15 minutes.

**`frontend/src/lib/apiClient.ts`** — MODIFIED
- **Purpose**: Centralized `fetch` wrapper that injects auth headers and auto-refreshes tokens.
- **Key Changes**:
  - **Skip refresh for credential endpoints**: `apiFetch` no longer attempts a token refresh when a login or signup call returns 401. Previously, a failed login attempt triggered a refresh which failed and swallowed the "invalid credentials" error message.
  - **Selective logout trigger**: `refreshAccessToken` now only calls `onAuthFailureCallback` (which clears auth state) when the error is a server-side 401 or 403 `ApiError`. Transient network failures (`TypeError`) are re-thrown without logging the user out.
- **Impact**: Login error messages are shown correctly; poor network conditions don't force unnecessary logouts.

---

### Backend: Role-Based Access Control (RBAC)

> [!info] Related Concepts
> See [[../glossary/authentication-security|Authentication & Security]] for the membership role model (`owner`, `member`, `viewer`) and [[../glossary/api-communication|API Communication]] for FastAPI dependency injection patterns.

**`backend/api/app/routers/transactions.py`** — MODIFIED
- **Key Changes**: Added `MembershipRole` import. Added a `viewer` role guard at the start of `create_transaction`, `update_transaction`, and `delete_transaction` — each raises HTTP 403 with a descriptive message before any other validation runs.
- **Impact**: Viewers can read transactions but cannot create, modify, or delete them. This enforces the role contract that was previously only a frontend convention.

**`backend/api/app/routers/accounts.py`** — MODIFIED
- **Key Changes**:
  - **Viewer guard on create**: When sharing an account into a family, viewers are now rejected with HTTP 403.
  - **Fixed global account list**: The default (no `tenant_id`) account list endpoint previously joined through `AccountShare` and included other members' accounts visible in the user's families. This was incorrect — the global view should show only the calling user's own accounts. The join was removed; shared accounts are only visible in the family-scoped view (`?tenant_id=...`).
- **Impact**: Viewers cannot share accounts into families. The global "All Accounts" page no longer shows other people's accounts.

**`backend/api/app/routers/tenants.py`** — MODIFIED
- **Purpose**: Tenant management endpoints including member removal and family deletion.
- **Key Changes**: When a membership is deleted (via leave or removal), all `AccountShare` records for that user's accounts in the affected tenant are deleted atomically in the same transaction. This uses a subquery to find owned account IDs and a bulk `delete()` statement.
- **Impact**: A departing member's private accounts are no longer visible to remaining family members after they leave.

---

### Frontend: Role-Aware UI

**`frontend/src/features/family/hooks/useCurrentRole.ts`** — NEW
- **Purpose**: Custom hook that reads the authenticated user's membership role for the currently active family from the JWT token.
- **Implementation**: Reads `user.roles[0]` from `AuthContext`. The JWT `roles` claim is a single-element array reflecting the user's role in the token's scoped tenant.
- **Impact**: Any component can call `useCurrentRole()` to make role-based rendering decisions without repeating JWT decoding logic.

**`frontend/src/features/transactions/pages/TransactionsPage.tsx`** — MODIFIED
- **Key Changes**:
  - Imports `useCurrentRole` and sets `isViewer` flag.
  - "Add Transaction" button hidden for viewers in both the header and empty state.
  - Empty state message differs for viewers ("No transactions have been recorded yet") vs. members/owners ("Get started by adding your first transaction").
  - Reads `location.state?.openAddModal` on mount to auto-open the modal when navigated from Dashboard quick actions.
- **Impact**: Viewers see a clean read-only UI without disabled buttons.

**`frontend/src/features/accounts/pages/AccountsPage.tsx`** — MODIFIED
- **Key Changes**: Uses `useCurrentRole`; "Add Account" button and empty-state creation button hidden for viewers. Empty state message is viewer-aware.
- **Impact**: Consistent with viewer semantics — no write affordances shown.

**`frontend/src/features/budgets/pages/BudgetsPage.tsx`** — MODIFIED
- **Key Changes**: "Add Budget" button restricted to `owner` role (not just non-viewer — budget creation is owner-only by design). Viewer-specific `Alert` info banner displayed.
- **Impact**: Members and viewers see the info banner; only owners see the create button.

---

### Modal-First Navigation

> [!info] Related Concepts
> - [[../glossary/react-patterns-hooks|React Patterns & Hooks]] — Controlled modals with `useState`, conditional rendering to force remount
> - [[../glossary/routing-navigation|Routing & Navigation]] — React Router `location.state` for cross-route communication

**`frontend/src/features/transactions/components/AddTransactionModal.tsx`** — NEW
- **Purpose**: Dialog wrapper for inline transaction creation. Replaces the old `/transactions/new` dedicated page.
- **Key Feature — Session Memory**: After each successful submission, the modal writes `account_id`, `transaction_type`, `category_id`, `currency`, and `transaction_date` to [[../glossary/state-management|`sessionStorage`]]. The next time the modal opens, it reads these as `defaultOverrides` for the form — useful when entering multiple transactions in a row (same account, type, and date; only amount and description vary).
- **Implementation**: The modal is conditionally rendered (`{addModalOpen && <AddTransactionModal />}`) so it remounts on each open, picking up fresh defaults.

**`frontend/src/features/accounts/components/AddAccountModal.tsx`** — NEW
- **Purpose**: Dialog wrapper for inline account creation. Replaces the old `/accounts/new` dedicated page.
- **Key Feature — Context-Aware Sharing**: When `familyId` prop is provided (family context), the new account is automatically shared with that family on creation. Without `familyId` (global context), no share is created.
- **Impact**: Account creation is now a same-page modal interaction in both `AccountsPage` and `AllAccountsPage`.

**`frontend/src/router/index.tsx`** — MODIFIED
- **Key Changes**: Removed `/transactions/new`, `/accounts/new`, and `/app/accounts/new` routes. Removed `AddTransactionPage`, `AddAccountPage`, and `GlobalAddAccountPage` imports.
- **Impact**: These URLs now 404 (or fall through to the parent list page). Navigation code has been updated to use modals instead.

**`frontend/src/features/dashboard/components/QuickActions.tsx`** — MODIFIED
- **Key Changes**: The "Add Transaction" quick action navigates to `/app/:familyId/transactions` with `{ state: { openAddModal: true } }` instead of the now-removed `/transactions/new` route. `TransactionsPage` reads this [[../glossary/routing-navigation|`location.state`]] on mount and opens the modal.
- **Impact**: Dashboard quick action still works; no hard-coded route dependency.

---

### Form Enhancements

**`frontend/src/features/transactions/components/TransactionForm.tsx`** — MODIFIED
- **Key Changes**:
  - `hideTitle?: boolean` prop — when `true`, suppresses the "Add Transaction" / "Edit Transaction" heading and removes the top margin, so the form sits flush inside a `Dialog`.
  - `defaultOverrides?: Partial<TransactionCreate>` prop — allows the parent (`AddTransactionModal`) to inject session-remembered values as React Hook Form `defaultValues`.
- **Impact**: Form is reusable both as a standalone page form and as a dialog-embedded form without duplicate titles.

**`frontend/src/features/accounts/components/AccountForm.tsx`** — MODIFIED
- **Key Changes**: Same `hideTitle` pattern as `TransactionForm`.
- **Impact**: No duplicate "Add Account" title when the form is rendered inside `AddAccountModal`.

---

### Bug Fixes

**`frontend/src/features/category/components/AddCategoryModal.tsx`** — MODIFIED
- **Bug**: When the modal was closed and reopened with different `kind` or `parentId` props, the form still showed the old values. [[../glossary/react-patterns-hooks|`useState`]] only uses the initial value on first mount; re-renders with new props did not update state.
- **Fix**: Added [[../glossary/react-patterns-hooks|`useEffect`]] that listens to the `open` prop and resets `selectedKind`, `selectedParentId`, `name`, and `nameError` whenever the modal opens.
- **Impact**: The "Add Subcategory" flow now correctly pre-fills the parent each time.

**`frontend/src/components/ui/organisms/SideNav.tsx`** — MODIFIED
- **Bug**: The `Drawer` root element was reserving space in document flow (`width: ..., flexShrink: 0`), which caused layout conflicts with the `AppShell` content margin calculation on desktop.
- **Fix**: Removed those inline styles from the root. The `MuiDrawer-paper` is `position: fixed` and does not participate in document flow; the AppShell uses a `margin-left` value instead.
- **Impact**: Sidebar no longer causes extra blank space beside the content area.

**`frontend/src/features/settings/pages/SettingsPage.tsx`** — MODIFIED
- **Bug**: After a successful member invitation, the invite modal stayed open indefinitely.
- **Fix**: Added a [[../glossary/react-patterns-hooks|`useEffect`]] that watches `isInviteSuccess`; when `true`, sets a 1.5-second timer to close the modal and call `resetInvite()` to clear the success flag.
- **Impact**: Users see the success message briefly, then the modal closes automatically.

---

### Documentation

**`docs/knowledge/network.md`** — NEW
- **Purpose**: Explains the same-origin proxy architecture, why it was needed (SameSite cookie blocking on cross-origin fetch), and how it is implemented in both Vite (dev) and nginx (production).
- **Contents**: Problem description, before/after diagrams, implementation details for `vite.config.ts` and `nginx.conf`, CORS implications, security properties (HttpOnly cookie preservation), and a token lifecycle flow diagram.
- **Audience**: Any developer who needs to understand why API calls use `/api` prefix or why cookies are HttpOnly-only.

---

## Testing Strategy

No new automated tests were added in this release (hardening fixes and UX changes). The following manual test scenarios were validated:

| Scenario | Expected |
|---|---|
| App load with expired access token + valid refresh cookie | Silent refresh — no redirect to `/login` |
| App load with both tokens expired | Redirect to `/login` |
| Viewer logs in and visits TransactionsPage | No "Add Transaction" button visible |
| Viewer calls `POST /transactions` directly | HTTP 403 Forbidden |
| Viewer calls `PUT /transactions/:id` directly | HTTP 403 Forbidden |
| Viewer calls `DELETE /transactions/:id` directly | HTTP 403 Forbidden |
| Viewer calls `POST /accounts` with `share_with` | HTTP 403 Forbidden |
| Member is removed from a family | Their `AccountShare` records for that family are deleted |
| `GET /accounts` (no tenant_id) | Returns only the calling user's own accounts |
| Add Transaction modal opened from Dashboard | Modal auto-opens; second modal pre-fills last account/type/category |
| Add Account modal in family context | Account is auto-shared with the family |
| AddCategoryModal opened twice with different parentId | Second open shows correct parent |
| Failed login attempt | Shows "invalid credentials" — does NOT trigger refresh |

---

## Migration Notes

### Route Changes (Breaking for Bookmarks)
The following URL routes have been removed. Any bookmarks or external links will land on the parent list page rather than a creation form:

| Removed Route | Replacement |
|---|---|
| `/app/:familyId/transactions/new` | Open "Add Transaction" modal from `/app/:familyId/transactions` |
| `/app/:familyId/accounts/new` | Open "Add Account" modal from `/app/:familyId/accounts` |
| `/app/accounts/new` | Open "Add Account" modal from `/app/accounts` |

### `VITE_API_URL` Change
All environments now use `VITE_API_URL=/api`. If you have local `.env` files overriding this to a direct backend URL, update them. The Vite proxy (`BACKEND_URL` env var) handles routing in development.

---

## Performance Impact

- **Bundle size**: Negligible change. Three page components (`AddTransactionPage`, `AddAccountPage`, `GlobalAddAccountPage`) are removed; two modal components (`AddTransactionModal`, `AddAccountModal`) are added with similar code weight.
- **Network**: Silent refresh adds one `POST /auth/refresh` call on cold load when the access token is expired. This resolves within ~100 ms on LAN and prevents a redirect + reload cycle.
- **Rendering**: Modals are conditionally rendered (`{open && <Modal />}`) so they carry no cost when closed.

---

## Next Steps / Follow-up Work

- **Write backend tests for RBAC**: Viewer 403 responses on transactions and accounts are not yet covered by automated tests. Add to `backend-test` agent scope.
- **Silent refresh test**: Add a frontend integration test that mocks an expired access token + valid refresh cookie and verifies no `/login` redirect occurs.
- **Expose port 8000 hardening**: Now that all browser traffic flows through nginx, `ports: - "8000:8000"` can be removed from `docker-compose.yaml` to close that attack surface. Requires confirming no other tooling depends on direct access.
- **Member role updates**: Currently only `viewer` is restricted. Consider adding a `member` restriction to budget creation to match the `owner`-only UI guard.

---

## Related Documentation

> [!info] Learning Resources
> New to the project? Start with the [[../glossary/glossary|Technical Glossary]] for:
> - [[../glossary/authentication-security|Authentication & Security]] — JWT, HttpOnly cookies, RBAC, SameSite attribute
> - [[../glossary/api-communication|API Communication]] — REST patterns, error handling, `credentials: 'include'`
> - [[../glossary/frontend-build-configuration|Frontend Build & Configuration]] — Vite proxy, environment variables, nginx
> - [[../glossary/react-patterns-hooks|React Patterns & Hooks]] — Controlled modals, `useEffect` for state sync
> - [[../glossary/state-management|State Management]] — `sessionStorage`, React Context, React Query
> - [[../glossary/routing-navigation|Routing & Navigation]] — `location.state`, route removal, React Router patterns
> - [[../glossary/development-workflow|Development Workflow]] — Docker Compose networking, multi-container setup

### Knowledge Articles
- [Network Architecture: Proxy, CORS & Cookie Strategy](../knowledge/network.md) — Full explanation of the same-origin proxy change
- [System Architecture](../SystemArchitecture.md) — Overall system design
- [Frontend Roadmap](../active_context/frontend_roadmap.md) — Sprint progress overview

### Source Files Referenced
- [vite.config.ts](../../frontend/vite.config.ts) — Dev proxy configuration
- [nginx.conf](../../frontend/nginx.conf) — Production proxy configuration
- [apiClient.ts](../../frontend/src/lib/apiClient.ts) — Centralized fetch wrapper
- [AuthContext.tsx](../../frontend/src/features/auth/context/AuthContext.tsx) — Silent refresh on mount
- [useCurrentRole.ts](../../frontend/src/features/family/hooks/useCurrentRole.ts) — Role hook
- [transactions.py](../../backend/api/app/routers/transactions.py) — Viewer RBAC enforcement
- [accounts.py](../../backend/api/app/routers/accounts.py) — Viewer RBAC + global list fix
- [tenants.py](../../backend/api/app/routers/tenants.py) — Auto-unshare on member removal

---

_Document Version: 1.0_
_Last Updated: 2026-02-26_
_Branch: `hardening`_
