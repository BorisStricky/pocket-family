# Frontend — CLAUDE.md

Module guidance for the React + TypeScript + MUI frontend. This file auto-loads when you work under `frontend/`. It is the source of truth for frontend implementation **and** test conventions (these used to live in the `frontend-dev` / `frontend-test` agents). The root [CLAUDE.md](../CLAUDE.md) holds project-wide context.

## Scope & Setup

```bash
cd frontend
npm install
npm run dev            # Vite dev server on :5173
npm run build          # type-check + production build
npm test               # vitest run (once, no watch)
npm run test:coverage  # coverage report
npm run storybook      # Storybook on :6006
```

Tech stack: React 18 · TypeScript · Vite · Material-UI v5 · TanStack React Query · React Router v6 · React Hook Form · AG Grid Community · Vitest + React Testing Library + MSW.

---

## Architecture

### Layout (hybrid: atomic design + feature modules)

```
src/
  components/
    ui/{atoms,molecules,organisms}/  # shared, no business logic (Button, AppShell)
    domain/                          # business components reused across features (AG Grid wrappers, CategoryTree)
  features/<feature>/                # FLAT per feature: api/ hooks/ context/ components/ pages/ types.ts
  lib/                               # apiClient.ts, constants.ts, jwtUtils.ts
  router/                            # React Router config, ProtectedRoute, FamilyGuard
  __tests__/                         # integration tests (see "Testing")
  lib/__tests__/                     # unit tests for pure utilities
  test/                              # shared test infra (utils.tsx, mocks/, setup.ts)
```

### Component placement rules

- **`components/ui/*`** — pure UI used across features (no business logic).
- **`components/domain/*`** — business logic reused across features (e.g. `AgTransactionsGrid`, `CategoryTree`).
- **`features/<feature>/components/`** — used by one feature only; keep flat (no subdirectories).

Ask before changing folder structure, routing patterns, the state-management approach, or adding/removing dependencies (see root CLAUDE.md §5).

### State & data

- **Server state → React Query.** Namespace query keys: `['transactions', familyId, filters]`. Mutations invalidate related queries on success. Gate queries with `enabled: !!familyId`.
- **Auth state → `AuthContext`** (`user`, `isAuthenticated`, `setTokens`, `clearAuth`).
- **Family/tenant state → `FamilyContext`** (`currentFamily`, `families`, `switchFamily`).
- **UI state → local `useState`.**

### API integration

All calls go through `apiFetch` from `@/lib/apiClient` — it injects the `Authorization: Bearer` header from localStorage and handles `401 → logout`. **Every tenant-scoped call must include `tenant_id`** (query param or body). Guard components that need a tenant: bail early if `!currentFamily`.

```typescript
const { currentFamily } = useFamilyContext();
const { data: transactions } = useQuery({
  queryKey: ["transactions", currentFamily.id],
  queryFn: () => apiFetch(`/transactions?tenant_id=${currentFamily.id}`),
  enabled: !!currentFamily,
});
```

### Code quality

- **No abbreviations**: `transaction` not `tx`, `response` not `res`, `handleClick` not `hdl`, `userTransactions` not `data`, `isLoadingCategories` not `loading`.
- **No `any`.** Props interfaces required for every component; export feature types from `types.ts`. Use `unknown` + narrowing if a type is genuinely unknown.
- **Inline comments explain the "why"** (learning project); file-level comment describes each component's purpose.
- Handle loading and error states; prefer MUI components before custom ones.

### Demo mode

`IS_DEMO_MODE` in `src/lib/constants.ts` reads `VITE_DEMO_MODE` (baked at build time). When true: signup hidden, `DemoBanner` / `DemoDisclaimerModal` render, login offers a "Try the Demo" auto-login. See [../infrastructure/CLAUDE.md](../infrastructure/CLAUDE.md).

---

## Testing Conventions

Integration-first. Render full pages and assert on visible UI; do **not** test hook internals, React Query cache mechanics, or MUI behavior.

- **Location**: integration tests in `src/__tests__/*.integration.test.tsx`; pure-utility unit tests in `src/lib/__tests__/`. **Never co-locate tests with source.**
- **Use the shared infra** from `@/test/utils`: `renderWithProviders` (QueryClient + AuthProvider + Router), `setupAuthenticatedUser(tenantId)`, `server` (MSW). Don't build custom wrappers.
- **Semantic queries only**: `getByRole`, `getByLabelText`, `getByText`. Avoid `getByTestId`. Use `queryBy*` for absence assertions.
- **MSW with in-memory stores**: reset the relevant store (`resetTransactionStore()`, etc.) in `beforeEach`; override per-test with `server.use(...)`. Pages read `useParams`, so wrap them in `<Routes><Route path=.../></Routes>` with `initialEntries`.
- **Async**: always `await waitFor(...)` for API/AG-Grid content; `userEvent.setup()` per test (not shared).
- **QueryClient**: `retry: false`; never set `gcTime: 0` with `staleTime > 0` (causes refetch loops/timeouts). Rely on the global 20s timeout — no per-test timeout overrides.
- **Naming**: state behavior plainly — `it("displays error message when API call fails")`, not `it("works")` or `it("should ...")`.

```typescript
describe("TransactionsPage Integration", () => {
  beforeEach(() => {
    setupAuthenticatedUser(TEST_TENANT_ID);
    resetTransactionStore();
  });

  it("displays transactions after loading", async () => {
    renderTransactionsPage();
    await waitFor(() =>
      expect(screen.getByText("Supermarket purchase")).toBeInTheDocument()
    );
  });
});
```

---

## Pre-completion checklist

- [ ] `npm run build` (no TS errors) and `npm test` pass
- [ ] No `any`; props interfaces defined; no abbreviations
- [ ] Inline "why" comments; loading + error states handled
- [ ] Files in the correct directory per placement rules
- [ ] API calls include `tenant_id`; React Query keys namespaced + invalidated on mutate
- [ ] Integration tests added/updated in `src/__tests__/` with store resets + auth setup
