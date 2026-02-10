# Frontend Development Roadmap

## 1. Architecture Approach

### Hybrid Feature + Atomic Design Structure

We're using a **hybrid approach** that combines feature-centric organization with atomic design principles:

```
src/
  components/
    ui/                   # Shared atomic design system
      atoms/              # Button, Icon, Input, Avatar, Chip, etc.
      molecules/          # SearchInput, FormField, FilterChipRow, etc.
      organisms/          # TopNav, SideNav, AppShell, OverviewCard, etc.
    domain/              # Shared domain-specific components
      ag/                # AG Grid wrappers
        AgTransactionsGrid.tsx
        AgAccountsGrid.tsx
        ImportPreviewGrid.tsx
      CategoryTree.tsx
  features/
    auth/
      components/        # Feature-specific (flat structure)
      pages/
      hooks/
      api/
    transactions/
      components/
      pages/
      hooks/
      api/
    accounts/
      ...
    family/
      ...
  lib/
    apiClient.ts         # Centralized API wrapper
    constants.ts
  hooks/                 # Global shared hooks
  types/                 # Shared TypeScript types
  router/
    index.tsx
```

### Reasoning

**Why Hybrid:**

- **Atomic at shared level** - Promotes reusability for UI components (buttons, inputs, navigation)
- **Flat at feature level** - Avoids deep nesting, easier navigation for feature-specific code
- **Domain layer** - Separates reusable business components (AG Grid wrappers) from pure UI

### Best Practices

1. **Component Placement Rules:**

   - `components/ui/atoms` → Used in more than one place, pure UI, no business logic
   - `components/ui/molecules` → Composed atoms, used in more than one feature
   - `components/domain` → Business-specific reusable (AG Grid wrappers, CategoryTree)
   - `features/*/components` → Feature-specific, even if complex

2. **API & Data Layer:**

   - All API calls go through `lib/apiClient.ts` (reads `VITE_API_URL`)
   - Feature-specific API functions in `features/*/api/`
   - React Query hooks in `features/*/hooks/`
   - Query keys namespaced: `['transactions', familyId, params]`

3. **TypeScript:**

   - All files use `.tsx` or `.ts`
   - Shared types in `src/types/`
   - Feature types co-located in `features/*/types.ts`
   - Generate API types from OpenAPI spec (optional: use `openapi-typescript`)

4. **Routing:**

   - All authenticated routes include `:familyId` param
   - Nested routes for modals (e.g., `/app/:familyId/transactions/new`)
   - Protected route wrapper validates auth + family membership

5. **State Management:**
   - React Query for server state
   - React Context for auth + current family
   - Local state (useState) for UI-only state
   - Avoid Zustand/Redux unless global UI state becomes complex

---

## 2. Practical Checklist (Apply Every Sprint)

### Step-by-Step Implementation Pattern

**For each feature sprint:**

1. **Add route + page shell with guards**

   - Define route in `src/router/index.tsx`
   - Create page component in `features/*/pages/`
   - Wrap with `ProtectedRoute` (validates auth + tenant)
   - Add navigation link in `SideNav`

2. **Implement API client** (Sprint 0 only, reuse after)

   - Create `src/lib/apiClient.ts`
   - Read base URL via `import.meta.env.VITE_API_URL`
   - Add Authorization header with fallback: `localStorage.getItem('pf_access_token')`
   - Handle errors gracefully (401 → logout, 403 → show error)

3. **Create React Query hooks**

   - Define hooks in `features/*/hooks/`
   - Use clear query keys: `['transactions', familyId, filters]`
   - Export mutations: `useCreateTransaction`, `useUpdateTransaction`
   - Invalidate queries on mutations

4. **Use MUI primitives and available custom components for layout**

   - Read which components are currently implemented in the root/.memory_bank/components_used.md
   - Use already implemented components if available. Use MUI primitives if for new ones at start
   - Start with MUI `Box`, `Stack`, `Grid`, `Paper` for page structure
   - Use MUI `TextField`, `Button`, `Select` for forms
   - **Defer custom atoms** at start. We will add them later
   - Focus on working features first
   - List which components were added in the root/.memory_bank/components_used.md for future use

5. **Extract components when needed**

   - When the feature is implemented, extract the new components (as listed in the memory bank).
   - Add Storybook story immediately
   - Run accessibility checks (`axe` or manual keyboard nav)
   - Wire the extracted components into features if necessary (intead of MUI primitives)

6. **AG Grid wrappers (create early if used in multiple sprints)**
   - Build thin wrapper in `components/domain/ag/`
   - Expose props: `rows`, `columns`, `onRowClick`, `serverSide?`
   - Support both client-side and server-side row models
   - Integrate with React Query for data fetching
   - Create wrapper early (Sprint 2) if Transactions, Accounts, Import all need it

---

## 3. Sprint Structure Overview

| Sprint       | Duration | Goal                           | Pages                                   |
| ------------ | -------- | ------------------------------ | --------------------------------------- |
| **Sprint 0** | 3-5 days | Foundation + Auth              | Landing, Login, Signup                  |
| **Sprint 1** | 1 week   | App Shell + Family Context     | AppShell, Family Switcher, Welcome Page |
| **Sprint 2** | 1 week   | First CRUD (Transactions)      | Transactions List, Add/Edit Transaction |
| **Sprint 3** | 1 week   | Accounts CRUD                  | Accounts List, Account Detail           |
| **Sprint 4** | 1 week   | Categories & Family Management | Family Page, Category Tree + Modals     |
| **Sprint 5** | 1 week   | Dashboard (with real data)     | Dashboard Page, Charts, KPI Cards       |
| ~~Sprint 6~~ | -        | ~~Import Flow~~ (Deferred)     | See [docs/roadmap/import_flow.md](../roadmap/import_flow.md) |
| **Sprint 6** | 1 week   | Budgets (Full-Stack CRUD)      | Budgets Page, Backend API               |
| **Sprint 7** | 1 week   | Reports & Settings             | Reports, Settings, Profile              |

---

## 4. Sprints

### Sprint 0: Foundation + Authentication (3-5 days) - 95% COMPLETE

#### Goal

Working development environment with authentication flow. Users can sign up, log in, and tokens are stored. Full stack integration tested.

#### Success Criteria

- [x] User can sign up with email/password
- [x] User can log in and receive access token
- [x] Token stored in localStorage and included in API calls
- [x] Public routes accessible without auth
- [x] Redirect to login when accessing protected routes unauthenticated
- [x] Environment variables working (`VITE_API_URL`)

Read the details in .active_context/sprint_1.md for detailed info

---

### Sprint 1: App Shell + Family Context (1 week)

#### Goal

Authenticated users can access the app shell with navigation, see their families, and switch between them. Foundation for all feature pages.

#### Success Criteria

- [x] AppShell layout works (TopNav + SideNav + main content area)
- [x] User can see list of families they belong to
- [x] User can switch between families (URL updates to `/app/:familyId/...`)
- [x] Family context available throughout app
- [x] Protected routes validate family membership
- [x] Welcome/placeholder page shows after login

Read the details in .active_context/sprint_2.md for detailed info

---

### Sprint 2: Transactions CRUD (1 week)

#### Goal

Users can view, create, edit, and delete transactions. First full CRUD feature with AG Grid table. Establishes patterns for forms, tables, and mutations.

#### Success Criteria

- [X] Users can view list of transactions in AG Grid table
- [X] Users can filter transactions by date, and description
- [X] Users can filter transactions by category, account
- [X] Users can create new transaction via modal form
- [X] Users can edit existing transaction
- [X] Users can delete transaction (with confirmation)
- [X] AG Grid wrapper created for reuse in other features

Read the details in .active_context/sprint_2.md for detailed info

---

### Sprint 3: Accounts CRUD (1 week)

#### Goal

Users can manage financial accounts (bank, credit card, cash). Reuses AG Grid pattern from Sprint 2. Account detail page shows transactions filtered by account.

#### Success Criteria

- [X] Users can view list of accounts with balances
- [X] Users can create new account
- [X] Users can edit account details
- [X] Users can view account detail page with filtered transactions
- [X] Account select dropdowns work in transaction forms
- [X] Global accounts view accessible from user menu
- [X] Users can see all accounts across all families

Read the details in .active_context/sprint_3.md for detailed info

---

### Sprint 4: Categories & Family Management (1 week)

#### Goal

Users can manage categories in hierarchical tree structure. Users can create families, invite members, and manage family membership. Family settings page allows managing members, invites, and categories. Categories now available in transaction forms.

#### Success Criteria

- [x] Users can view category tree (parent-child hierarchy)
- [x] Users can create, edit, delete categories
- [x] Deleting category with transactions prompts reassignment
- [x] Users can create new families and become owners
- [x] Owners can invite users via email (creates pending memberships)
- [x] Users can view pending invitations (full acceptance flow pending backend)
- [x] Owners can remove members from their family
- [x] Members can leave families they don't own
- [x] Owners can delete families with proper safeguards
- [x] Family page shows members, settings, and categories
- [x] Category select works in transaction form

Read the details in .active_context/sprint_4.md for detailed info

---

### Sprint 5: Dashboard (1 week)

#### Goal

Dashboard shows meaningful KPIs, charts, and recent activity using real transaction, account, and category data from previous sprints. Users get overview of financial health.

#### Success Criteria

- [x] Dashboard shows key metrics (total expenses, income, balance)
- [x] Charts display spending by category, trends over time
- [x] Recent transactions widget shows last 5-10 transactions
- [x] Quick actions (Add Transaction, View Reports)86rq
- [x] Data updates when navigating from other pages

Read the details in .active_context/sprint_5.md for detailed info

---

### ~~Sprint 6: Import Flow~~ (Deferred)

Moved to [docs/roadmap/import_flow.md](../roadmap/import_flow.md). Requires backend infrastructure (Celery job queue, file storage) to be implemented first.

---

### Sprint 6: Budgets — Full-Stack CRUD (1 week)

#### Goal

Implement full budget management: backend model, API endpoints, and frontend UI. Users can create, view, edit, and delete monthly budgets per category.

#### Success Criteria

- [ ] Budget model + Alembic migration
- [ ] Full CRUD API endpoints with tenant isolation
- [ ] Frontend budgets page with progress bars (spent vs limit)
- [ ] Create, edit, delete budgets via modal forms
- [ ] Backend + frontend tests

Read the details in .active_context/sprint_7.md for detailed info

---

### Sprint 7: Reports & Settings (1 week)

#### Goal

Add remaining MVP pages: Reports (generate/export) and Settings (user profile). Completes core feature set.

#### Success Criteria

- [ ] Users can generate reports with date range and filters
- [ ] Reports can be exported to CSV/PDF
- [ ] Settings page allows updating profile
- [ ] All core MVP features complete

Details TBD

---

## 5. Post-Sprint: Polish & Deployment

### Final Steps

#### Polish & Performance

- [ ] Add loading skeletons for all pages
- [ ] Optimize bundle size (code splitting, lazy loading)
- [ ] Add error boundaries for all routes
- [ ] Improve mobile responsiveness
- [ ] Add keyboard shortcuts (optional)

#### Accessibility

- [ ] Run axe accessibility audit on all pages
- [ ] Fix keyboard navigation issues
- [ ] Add ARIA labels where missing
- [ ] Test with screen reader

#### Testing

- [ ] Write E2E tests for critical flows (Cypress or Playwright)
- [ ] Increase unit test coverage to 80%+
- [ ] Add visual regression tests (Chromatic)

#### Documentation

- [ ] Update README with full setup instructions
- [ ] Document environment variables
- [ ] Add architecture diagram to docs
- [ ] Create developer onboarding guide

#### Deployment

- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Configure Docker build with multi-stage
- [ ] Deploy to staging environment
- [ ] Deploy to production
- [ ] Set up monitoring (Sentry for errors, analytics)

---

## 6. Summary

This roadmap provides a comprehensive, sprint-by-sprint implementation plan for the personal finance frontend. Each sprint builds on the previous, starting with foundation (auth) and progressively adding features (transactions, accounts, categories, dashboard, import, reports).

**Key Deliverables:**

- ✅ Sprint 0: Working auth flow
- ✅ Sprint 1: App shell + family context
- ✅ Sprint 2: Transactions CRUD + AG Grid pattern
- ✅ Sprint 3: Accounts CRUD
- ✅ Sprint 4: Categories + family management
- ✅ Sprint 5: Dashboard with charts
- Sprint 6: Budgets (full-stack CRUD)
- Sprint 7: Reports & settings
- Deferred: Import flow (see docs/roadmap/import_flow.md)

**Total Timeline:** ~7-8 weeks for MVP (assuming 1-person team, part-time)

---

**Next Steps:**

1. Review this document with stakeholders
2. Adjust sprint priorities if needed
3. Begin Sprint 0 implementation
4. Track progress using checkboxes in each sprint
5. Iterate based on user feedback

---

_Document Version: 2.0_
_Last Updated: 2025-12-08_
