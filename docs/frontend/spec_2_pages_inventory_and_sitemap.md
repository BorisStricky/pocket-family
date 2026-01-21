# SPEC-2 - Pages Inventory & Sitemap

## Background

This document defines the canonical pages, routes, and top-level components for the React frontend MVP. You chose the **component library approach** (MUI v5 assumed by default) and AG Grid for data-heavy tables. The backend OpenAPI spec is available at the workspace path `/mnt/data/openAPI_spec.json` (use as canonical source for operationIds and request/response shapes).

**Important routing change (global):** All authenticated app routes include a `{family_id}` path segment (formerly "tenant_id"). Example: `/app/{family_id}/dashboard`, `/app/{family_id}/transactions`. The `{family_id}` shown in URLs is authoritative for sharing and deep links; the backend must validate that the authenticated user (via token) is authorized for that `family_id` on each API call. Frontend should include the `family_id` in all API calls (e.g. as path param) and handle 403/404 from backend when mismatches occur.

---

## Purpose

Provide a developer-ready, exhaustive list of routes (desktop-first, responsive), whether they are public or protected, the main responsibilities and components per page, and the primary API calls each page requires. Include Family (tenant) and category management flows, AG Grid wrapper usage, and route design using `{family_id}`.

---

## Conventions and assumptions

- React + TypeScript, React Router v6, React Query for data fetching. MUI v5 is the default component library unless you request Chakra/Ant.
- AG Grid will be used for Transactions, Accounts and Import preview tables, via thin wrapper components.
- Family = user-facing name for tenant. In code and API we may refer to `tenantId`, but all UI strings must say `Family` (e.g., "Switch Family").
- Routes under `/app` include `{family_id}` segment for deep links and shareable URLs. Example: `/app/{family_id}/transactions`.
- Backend validates `family_id` authorization using the user's token. The frontend should gracefully handle backend rejections (401/403/404) and redirect to error page or Family switcher.

---

## Pages (MVP) — canonical list (with `{family_id}` in authenticated paths)

| Page name | Route path (React Router style) | Public / Protected | Main responsibilities | Key components used | Primary API calls (OpenAPI ref) |
|---|---|---|---|---|---|
| Landing | `/` | Public | Marketing + CTA | `Hero`, `FeaturesList`, `Footer` | — |
| Signup | `/signup` | Public | Create account / OAuth | `AuthForm`, `OAuthButtons` | `POST /auth/signup` |
| Login | `/login` | Public | Authenticate | `AuthForm` | `POST /auth/login` |
| Password Reset | `/password-reset` | Public | Reset password | `PasswordResetRequest`, `PasswordResetForm` | `POST /auth/password-reset`, `POST /auth/password-reset/confirm` |
| App Shell root | `/app/:family_id/*` | Protected | Layout wrapper for all family-scoped pages (prefetch `GET /me` + `GET /families/:family_id`) | `AppShell`, `FamilySwitcher`, `SideNav`, `TopNav` | `GET /me`, `GET /tenants/{family_id}` |
| Dashboard | `/app/:family_id/dashboard` | Protected | KPI overview, charts, recent activity | `OverviewCard`, `MiniChart`, `RecentTransactions` (AG Grid mini) | `GET /transactions?familyId={family_id}&limit=5`, `GET /accounts/summary?familyId={family_id}` |
| Transactions | `/app/:family_id/transactions` | Protected | List, filter, bulk actions | `TransactionsFilterBar`, `AgTransactionsGrid`, `BulkActions` | `GET /transactions?familyId={family_id}`, `DELETE /transactions/{id}?familyId={family_id}` |
| Add Transaction (modal) | `/app/:family_id/transactions/new` | Protected | Create transaction (modal on desktop; full page on mobile) | `TransactionForm` (modal) | `POST /transactions?familyId={family_id}` |
| Transaction Detail / Edit | `/app/:family_id/transactions/:transactionId` | Protected | Inspect & edit transaction | `TransactionDetail`, `TransactionForm` | `GET /transactions/{transactionId}?familyId={family_id}`, `PUT /transactions/{transactionId}?familyId={family_id}` |
| Accounts | `/app/:family_id/accounts` | Protected | Accounts list & balances | `AgAccountsGrid`, `AccountCard` | `GET /accounts?familyId={family_id}` |
| Account Detail | `/app/:family_id/accounts/:accountId` | Protected | Account transactions, balances & charts | `AccountSummary`, `AgTransactionsGrid` | `GET /accounts/{accountId}?familyId={family_id}` |
| Budgets | `/app/:family_id/budgets` | Protected | Budget management | `BudgetsList`, `BudgetForm` | `GET /budgets?familyId={family_id}` |
| Reports | `/app/:family_id/reports` | Protected | Generate & export reports | `ReportsFilters`, `ReportViewer` | `POST /reports?familyId={family_id}` |
| Import | `/app/:family_id/import` | Protected | Flow to upload/import CSV/OFX | `FileUploader`, `ImportPreviewGrid` (AG Grid), `MappingForm` | `POST /import/upload?familyId={family_id}`, `POST /import/confirm?familyId={family_id}` |
| Family (Tenant) page | `/app/:family_id/family` | Protected | Manage Family settings & categories, members, roles | `FamilyHeader`, `CategoryList` (tree + optional AG Grid), `InviteMember` | `GET /tenants/{family_id}`, `GET /tenants/{family_id}/categories` |
| Add Category (modal) | `/app/:family_id/family/categories/new` | Protected | Create category | `AddCategoryModal` | `POST /tenants/{family_id}/categories` |
| Edit Category (modal) | `/app/:family_id/family/categories/:categoryId/edit` | Protected | Edit category | `EditCategoryModal` | `PUT /tenants/{family_id}/categories/{categoryId}` |
| Delete Category (confirm) | modal/dialog on Family page | Protected | Confirm deletion & reassign transactions | `DeleteCategoryConfirm` | `DELETE /tenants/{family_id}/categories/{categoryId}`, optional reassign `PUT /transactions/reassign-category` |
| Categories Bulk Import | `/app/:family_id/family/import-categories` (optional) | Protected | Import categories via CSV | `CategoryImportUploader`, `ImportPreviewGrid` | `POST /tenants/{family_id}/categories/import` |
| Settings | `/app/:family_id/settings` | Protected | Profile, integrations, API keys | `ProfileForm`, `IntegrationsList` | `GET /me`, `PUT /me`, `GET /integrations?familyId={family_id}` |
| Onboarding | `/app/:family_id/onboarding` | Protected (first-run) | Initial setup wizard (accounts, categories, sample data) | `OnboardingWizard` | various calls (accounts, categories, import) |
| Tenants (list) / Family switcher UI | `/app/families` (non-family-specific index) | Protected | Show list of families the user belongs to and allow switching | `FamilyList`, `FamilySwitcherModal` | `GET /tenants` |
| Admin - Users | `/app/:family_id/admin/users` | Protected (admin) | User management | `UserTable` (AG Grid) | `GET /admin/users?familyId={family_id}` |
| Admin - Tenant Detail | `/app/:family_id/admin/tenant` | Protected (admin) | Tenant-level admin actions | `TenantDetail` | `GET /admin/tenants/{family_id}` |

> Notes: Replace `{family_id}` with the family identifier used in your system. In the codebase the param can be named `familyId` or `tenantId` depending on backend naming — but UI labels MUST display "Family".

---

## Route & Layout rules (detailed)

- `AppShell` is mounted at `/app` and includes navigation; sub-routes include `/:family_id/*`. Load `AppShell` for any `/app/*` routes.
- `ProtectedRoute` checks authentication; it should also ensure a `family_id` exists in the URL and attempt to validate it by prefetching `GET /tenants/{family_id}`. If validation fails (user not part of that family), show a descriptive error and offer Family switcher.
- For convenience, support a family-agnostic index at `/app` which redirects to the user's default family: `/app` → `/app/{default_family_id}/dashboard`.
- Modal flows (add/edit) should be represented as nested routes. Example:
  - `/app/:family_id/transactions` renders Transactions list.
  - Navigating to `/app/:family_id/transactions/new` opens the add-transaction modal over the transactions list. The URL reflects the modal's state and supports sharing.
- On mobile, prefer full-screen pages for forms instead of floating modals; still keep route parity (same URL).
- All API calls that are family-scoped must pass `family_id` as a path/query param so the backend can verify the token authorizes the family.

---

## Component Responsibilities & Reuse (highlighted)

- `AppShell` — handles responsive nav, `FamilySwitcher`, global error boundary, and prefetching `GET /me` and family metadata when route changes.
- `FamilySwitcher` — lists families the user belongs to (`GET /tenants`) and allows switching which triggers a route redirect to `/app/{selected_family_id}/dashboard`.
- `ProtectedRoute` — verifies token and `family_id` route param (prefetch family metadata). Handles unauthorized cases.
- `AgTransactionsGrid` — AG Grid wrapper for transactions. Props sketch: `rows?: Transaction[]`, `queryParams: TransactionsQuery`, `onRowClick(transaction)`, `onSelectionChange(selectedIds)`, `serverSide?: boolean`. Integrates with React Query hooks for server-side pagination.
- `CategoryTree` / `CategoryGrid` — renders hierarchical categories; `CategoryGrid` is AG Grid-based for large lists. Exposes actions to open `AddCategoryModal`, `EditCategoryModal`, `DeleteCategoryConfirm`.
- `AddCategoryModal`, `EditCategoryModal`, `DeleteCategoryConfirm` — modal components that use `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory` hooks respectively.
- `TransactionForm` — form used for create/edit; supports category selection (with search) and optional rule-based split entries.

---

## API mapping approach & hooks

- Use the project OpenAPI spec at `/mnt/data/openAPI_spec.json` to generate TypeScript types and use them in hooks (recommended: `openapi-typescript` or `openapi-generator` to keep types in sync).
- Implement idiomatic React Query hooks that include family-scoped keys. Example naming and query keys:
  - `useFamily(familyId)` → Query key: `['family', familyId]` → `GET /tenants/{familyId}`
  - `useTransactions(familyId, params)` → Query key: `['transactions', familyId, params]` → `GET /transactions?familyId={familyId}&...`
  - `useTransaction(familyId, transactionId)` → `['transaction', familyId, transactionId]` → `GET /transactions/{transactionId}?familyId={familyId}`
  - `useCategories(familyId)` → `['categories', familyId]` → `GET /tenants/{familyId}/categories`
  - Mutations: `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory` — after success invalidate `['categories', familyId]` and `['transactions', familyId]` if reassignments occur.

**Backend validation note:** The frontend must always include `familyId` with API calls; backend must validate that the token corresponds to a user who belongs to that family and return appropriate HTTP codes (401, 403, 404) which the frontend will handle by redirecting or showing an error.

---

## AG Grid integration notes

- Centralize AG Grid setup in `src/components/ag-grid/` wrappers: `AgTransactionsGrid`, `AgAccountsGrid`, `ImportPreviewGrid`, `CategoryGrid`.
- Default column renderers: date, currency, tags, category chips, actions column. Provide server-side sorting/filtering via callbacks integrated with React Query.
- AG Grid themes should be mapped to the chosen component library theme (MUI). Keep CSS isolation in wrappers.
- For very large data sets prefer AG Grid server-side row model; for MVP server-side pagination with client sorting is acceptable.

---

## Family (tenant) & Categories specific behaviors

- All category CRUD happens within the family scope and is invoked with the route `:family_id`.
- Deleting a category must surface the number of affected transactions and provide an option to reassign or mark as `Uncategorized`.
- Category import allows CSV with columns `name,parentId,color,icon` and shows a preview grid (AG Grid) before confirmation.
- Category UI strings: use "Family categories", "Manage Family", "Switch Family".

---

## Accessibility & i18n

- Use MUI accessible components and add aria attributes for custom components and modals. Ensure AG Grid keyboard navigation is enabled and tested.
- Internationalization: keep all user-facing strings externalized; use `Intl` for date/number formatting. Family IDs in URLs should be opaque slugs or UUIDs — avoid exposing PII.

---

## Acceptance Criteria

- All authenticated routes include `:family_id` and can be scaffolded by the dev team using this doc.
- Family-specific pages and category modals are included and linked to API hooks that pass `family_id` to the backend.
- `AppShell`/`ProtectedRoute` define behavior for prefetching/validating `family_id` and handling unauthorized access.
- AG Grid tables and wrappers are specified for Transactions, Accounts, Import preview, and (optionally) Category Grid.

---

## Next steps (recommended)

1. Produce **Navigation & Route Map (PlantUML)** that explicitly shows nested routes, modal flows, and family switch flows with `:family_id` included.  
2. Produce **Component Inventory (atomic)** showing atoms/molecules/organisms with prop sketches and Storybook story names — will include AG Grid wrapper API shape.  
3. Produce **API Endpoint Mapping** by reading `/mnt/data/openAPI_spec.json` and mapping exact operationIds, parameters and expected payloads for each page/hook.

If you'd like I’ll proceed to the Navigation & Route Map next. Otherwise name which of the next steps you want.

---

*File references:* OpenAPI spec used for API mapping: `/mnt/data/openAPI_spec.json`.

*Author:* Software Architect GPT

