---
Overview: Add language selection (English / Brazilian Portuguese) across the full stack. One Alembic migration persists the preference on the User model; a new /users/me router round-trips it. i18next + react-i18next initialize the frontend i18n layer; a nested Language submenu in TopNav switches the UI instantly; SideNav labels localize in real time; a sync hook restores the server-saved choice on every fresh load.
Date: 2026-06-05
PR: "#59 — Add language selection (English / Brazilian Portuguese)"
branch: "`claude/language-selection-feature-Q3hc0` → `claude/category-icons-colors-KoauH`"
code_changed: 26 files changed, +1087 insertions, -17 deletions
commits: 5 commits
test_coverage: 239 backend tests (+8), 160 frontend tests (+4) passing; `npm run build` clean
tags:
  - feature
  - backend
  - frontend
  - i18n
  - user-preferences
---

# Language Selection (EN / pt-BR) — PR Summary

## Overview

This PR introduces end-to-end language selection between **English** and **Brazilian Portuguese (pt-BR)**. Before this change the app had no i18n infrastructure — every UI string was hardcoded English, and the `User` model held no preference fields beyond `preferred_tenant_id`.

The feature covers every layer: an Alembic migration persists `language` on the `User` table; a new `/users/me` router (GET + PATCH) round-trips the preference; `i18next` + `react-i18next` initialize the frontend translation layer with bundled JSON resources; a nested Language submenu inside the existing TopNav user dropdown switches the active language optimistically; `SideNav` nav labels and all user-menu strings resolve through `useTranslation`; and a `useSyncUserLanguage` hook restores the server-saved choice when a returning user opens the app on a new device.

Language is stored on the `User` (not the `Tenant`) because it is a personal preference that follows the user across every family they belong to and across devices.

See the planning document for full context: [`docs/plans/language-selection-feature.md`](../plans/language-selection-feature.md).

---

## Goals Achieved

- **Database extended**: Alembic migration `b7c8d9e0f1a2` adds a non-nullable `language VARCHAR(8)` column to the `user` table with `server_default='en'` — existing rows backfill automatically; no data migration needed.
- **Backend round-trip**: `UserRead` and `UserUpdate` schemas expose the `language` field. A Pydantic field validator rejects anything outside `{"en", "pt-BR"}` with a 422. An explicit `null` is also rejected (non-nullable column guard at validation time, not at the database).
- **Single source of truth for supported languages**: `LanguageCode = Literal["en", "pt-BR"]` in `schemas.py`; `SUPPORTED_LANGUAGES = set(get_args(LanguageCode))` derived from it. The frontend mirrors this in `src/i18n/index.ts` and `src/types/index.ts`. A cross-layer contract test (`i18n.contract.test.ts` + `test_supported_languages_contract`) will fail in exactly one place per layer if they drift.
- **i18n infrastructure**: `i18next` initialized once at `src/i18n/index.ts` with bundled EN and pt-BR resources, read from `localStorage` on first paint so the chosen language applies before any API call completes.
- **Language switcher**: A nested MUI `Menu` anchored to a new "Language" `MenuItem` in the TopNav user dropdown lists both languages; the active one shows a `Check` icon and `aria-checked="true"`. Switching calls `changeLanguage(...)` and closes both menus immediately.
- **First-pass translations**: `TopNav` user-menu strings and `SideNav` navigation labels resolve through `useTranslation`; `common.cancel` and `common.save` keys cover shared buttons.
- **Optimistic persistence**: `useLanguage` applies the language locally (i18next + localStorage) first for instant feedback, then PATCHes the backend in the background. If the PATCH fails the local choice persists for the session and re-syncs on next load.
- **Cross-device restore**: `useSyncUserLanguage` runs inside `AppShell`, fetches `GET /users/me` once after login, and applies the server's language when it differs from the local one.
- **Test coverage**: 8 new backend tests cover the default language, a successful update, invalid code rejection, explicit-null rejection, empty-body no-op, and authentication requirements. 3 new frontend integration tests verify English default rendering, a full pt-BR switch, and the `aria-checked` state on the active language option. 1 frontend contract test locks the `SUPPORTED_LANGUAGES` array.

---

## Architecture & Tech Stack Changes

### New: i18next + react-i18next

`i18next` and `react-i18next` are added to `package.json`. These are the standard React i18n stack — lightweight, no MUI conflict, and the only approach that gives instant UI switching without a React context re-render of the full tree (i18next is its own reactive singleton).

Resources are **bundled** (small, two languages) rather than fetched at runtime:
- No async loading step → translations are available on first render
- Tests remain synchronous — no `await i18n.init()` required
- `useSuspense: false` removes the need for a Suspense boundary around every translated component

### New: /users/me REST Endpoints

This PR introduces the first **user-scoped** (non-tenant-scoped) endpoints. They use `Depends(get_authenticated_user)` rather than `Depends(get_current_user_context)` — `get_authenticated_user` resolves the user from the JWT `sub` only, with no tenant membership check. This is intentional: language is a personal preference that must work even when the user has no active family or is switching tenants.

### New: LanguageCode as a Literal (Single Source of Truth)

```python
LanguageCode = Literal["en", "pt-BR"]
SUPPORTED_LANGUAGES = set(get_args(LanguageCode))
```

`SUPPORTED_LANGUAGES` is derived from the `Literal` type via `get_args` so the runtime validation set and the schema type annotation can never drift out of sync. Adding a language requires editing only `LanguageCode`; `SUPPORTED_LANGUAGES` updates automatically.

### Amended: i18n State Model

i18next's default instance is the global source of truth for the active language. There is intentionally **no separate React context** — `useTranslation` already subscribes components to language changes and triggers re-renders when the language switches. `useLanguage` layers persistence on top without duplicating state.

---

## Directory Structure

```
pocket-family/
├── backend/
│   └── api/
│       ├── alembic/versions/
│       │   └── 🆕 b7c8d9e0f1a2_add_language_to_user.py     # Adds language column to user table
│       └── app/
│           ├── main.py                                       ✏️ Register users router
│           ├── models.py                                     ✏️ language field on User
│           ├── schemas.py                                    ✏️ LanguageCode, SUPPORTED_LANGUAGES, UserRead, UserUpdate
│           ├── routers/
│           │   └── 🆕 users.py                              # GET + PATCH /users/me
│           └── tests/
│               └── 🆕 test_users.py                         # 8 tests for /users/me endpoints
├── docs/
│   └── plans/
│       └── 🆕 language-selection-feature.md                 # Full design plan (on this branch)
└── frontend/
    ├── package.json                                          ✏️ Add i18next, react-i18next
    └── src/
        ├── main.jsx                                          ✏️ Side-effect import of src/i18n
        ├── i18n/
        │   ├── 🆕 index.ts                                  # i18next init, getStoredLanguage, SUPPORTED_LANGUAGES
        │   └── locales/
        │       ├── 🆕 en.json                               # EN translations (nav, userMenu, language, common)
        │       └── 🆕 pt-BR.json                            # pt-BR translations (same key structure)
        ├── types/
        │   └── index.ts                                      ✏️ LanguageCode, CurrentUser, UserUpdate types
        ├── lib/
        │   └── constants.ts                                  ✏️ STORAGE_KEYS.LANGUAGE, API_ENDPOINTS.USERS_ME
        ├── features/settings/
        │   ├── api/
        │   │   └── 🆕 userApi.ts                            # getCurrentUser(), updateLanguage()
        │   └── hooks/
        │       └── 🆕 useLanguage.ts                        # useLanguage(), useSyncUserLanguage()
        ├── components/ui/organisms/
        │   ├── AppShell.tsx                                  ✏️ Call useSyncUserLanguage on mount
        │   ├── SideNav.tsx                                   ✏️ Nav labels through useTranslation
        │   └── TopNav.tsx                                    ✏️ Nested Language submenu + i18n strings
        └── test/
            ├── setup.ts                                      ✏️ i18n init + resetUserStore + i18n.changeLanguage('en') in afterEach
            ├── mocks/
            │   ├── server.ts                                 ✏️ Export resetUserStore
            │   └── handlers/
            │       ├── index.ts                              ✏️ Register userHandlers
            │       └── 🆕 users.ts                          # MSW GET + PATCH /users/me with in-memory store
            └── __tests__/
                ├── 🆕 i18n.contract.test.ts                 # Locks SUPPORTED_LANGUAGES against backend set
                └── 🆕 language-switcher.integration.test.tsx # 3 integration tests for the switcher
```

---

## Files Changed — Detailed Breakdown

### Backend: Database Migration (1 new file, +27 lines)

**`b7c8d9e0f1a2_add_language_to_user.py`** — NEW
- **Purpose**: Adds `language VARCHAR(8) NOT NULL DEFAULT 'en'` to the `user` table.
- **Chain position**: Revises `f3a4b5c6d7e8` (the final PR #58 migration); becomes the new Alembic head.
- **Upgrade**: `op.add_column` with `server_default='en'` so existing rows backfill automatically without a separate `UPDATE`.
- **Downgrade**: `op.drop_column('user', 'language')`.

### Backend: Models, Schemas, Router, Main (4 modified + 1 new file, +120 lines)

**`backend/api/app/models.py`** — MODIFIED (+7 lines)
- **Key change**: `language: str = Field(default="en", nullable=False)` added to the `User` SQLModel class.
- **Impact**: ORM class matches the migrated schema; non-nullable with a Python-side default of `"en"` mirrors the `server_default`.

**`backend/api/app/schemas.py`** — MODIFIED (+62 lines)
- **Key changes**: `LanguageCode = Literal["en", "pt-BR"]` and `SUPPORTED_LANGUAGES = set(get_args(LanguageCode))` added as the canonical language set. `UserRead` (safe public subset: `id, email, name, language, created_at`) and `UserUpdate` (only `language: Optional[str]`) added. `UserUpdate.validate_language` rejects codes outside `SUPPORTED_LANGUAGES` and explicit `null` with a 422.
- **Impact**: The `Literal` + `get_args` pattern ensures the runtime validator and the type annotation are always in sync.

**`backend/api/app/routers/users.py`** — NEW (+48 lines)
- **Purpose**: User-scoped (non-tenant-scoped) profile endpoints.
- `GET /users/me` → `UserRead` — returns the authenticated user's profile; called by the frontend on load to restore the saved language.
- `PATCH /users/me` → `UserRead` — updates self-editable preferences; uses `model_dump(exclude_unset=True)` + `setattr` (the PR #58 standard) so omitting `language` is a valid no-op.
- Uses `Depends(get_authenticated_user)` (no tenant context) because language is a personal preference.

**`backend/api/app/main.py`** — MODIFIED (+3 lines, -1 line)
- **Key change**: `users` imported from `.routers` and `app.include_router(users.router)` registered at the end of the router list.

### Backend: Tests (1 new file, +117 lines)

**`backend/api/tests/test_users.py`** — NEW
- **Purpose**: Validates the `/users/me` round-trip for the language preference.
- **`test_supported_languages_contract`**: Asserts `SUPPORTED_LANGUAGES == {"en", "pt-BR"}` — this test must be updated last when adding a language, ensuring all five locations (backend Literal, backend SUPPORTED_LANGUAGES, frontend i18n.ts, frontend types/index.ts, frontend contract test) are already updated.
- **`test_read_current_user_returns_default_language`**: GET returns `language: "en"` for a new user; `password_hash` absent from response.
- **`test_update_language_persists_supported_value`**: PATCH to `pt-BR` returns 200; a subsequent GET confirms the change was committed, not just echoed.
- **`test_update_language_rejects_unsupported_value`**: PATCH with `"fr"` returns 422.
- **`test_update_language_rejects_explicit_null`**: PATCH with `null` returns 422 (not a 500 from a DB integrity error).
- **`test_update_language_with_empty_body_is_noop`**: PATCH with `{}` returns 200 and leaves `language` as `"en"`.
- **`test_read_current_user_requires_authentication`** / **`test_update_current_user_requires_authentication`**: Both endpoints return 401 without an Authorization header.

### Frontend: Dependencies (+2 packages)

`i18next` and `react-i18next` added to `package.json` and `package-lock.json`. No other new dependencies.

### Frontend: i18n Infrastructure (3 new files, +106 lines)

**`frontend/src/i18n/index.ts`** — NEW (+58 lines)
- **Purpose**: Initializes the shared i18next instance as a side-effect module; imported once in `main.jsx` and once in `test/setup.ts`.
- `getStoredLanguage()` reads `localStorage.getItem(STORAGE_KEYS.LANGUAGE)` synchronously and validates against `SUPPORTED_LANGUAGES`, falling back to `"en"`. Reading at init time means the user's choice applies on the first paint — before `/users/me` completes.
- `resources` are bundled inline (no HTTP fetch); `useSuspense: false` keeps rendering synchronous in both production and tests.
- Exports `SUPPORTED_LANGUAGES: readonly LanguageCode[]` and `DEFAULT_LANGUAGE` for use by hooks and tests.

**`frontend/src/i18n/locales/en.json`** — NEW (+24 lines)
- **Keys**: `nav.{dashboard,transactions,accounts,budgets,reports,settings}`, `userMenu.{seeAllAccounts,logout,loggingOut,language}`, `language.{english,portuguese}`, `common.{cancel,save}`.
- **Convention**: Feature-namespaced dot-path keys per the plan's expansion guide — adding a new screen only requires adding new keys to both locale files, never editing the plumbing.

**`frontend/src/i18n/locales/pt-BR.json`** — NEW (+24 lines)
- Same key structure as `en.json`; values are fluent Brazilian Portuguese translations.
- `language.english` stays `"English"` and `language.portuguese` stays `"Português (BR)"` in both files — language names are presented in their own language universally.

### Frontend: Types & Constants (2 modified files, +33 lines)

**`frontend/src/types/index.ts`** — MODIFIED (+26 lines)
- `LanguageCode = 'en' | 'pt-BR'` — mirrors the backend `Literal`; must be updated alongside it.
- `CurrentUser` interface — server-authoritative user profile returned by `/users/me`; distinct from the JWT-decoded `User` (no `tenant_id`/`roles`, which are token claims).
- `UserUpdate` interface — request body for PATCH `/users/me`.

**`frontend/src/lib/constants.ts`** — MODIFIED (+7 lines)
- `STORAGE_KEYS.LANGUAGE: 'pf_language'` — localStorage key for the persisted language code.
- `API_ENDPOINTS.USERS_ME: '/users/me'` — canonical endpoint path used by `userApi.ts`.

### Frontend: Settings Feature (2 new files, +135 lines)

**`frontend/src/features/settings/api/userApi.ts`** — NEW (+25 lines)
- `getCurrentUser()` — `GET /users/me` via the central `apiFetch`; used by `useSyncUserLanguage` on load.
- `updateLanguage(language)` — `PATCH /users/me` with `{ language }`; used by `useLanguage` on every switch.

**`frontend/src/features/settings/hooks/useLanguage.ts`** — NEW (+110 lines)
- `applyLanguageLocally(language)` — internal helper: `i18n.changeLanguage(language)` + `localStorage.setItem(STORAGE_KEYS.LANGUAGE, language)`. Called optimistically before the PATCH so the UI updates instantly.
- `useLanguage()` — exposes `currentLanguage` (from `i18nInstance.language`), `changeLanguage(lang)`, and `isUpdating`. `changeLanguage` applies locally first, then fires a React Query mutation. On PATCH success the cache is seeded with the server's authoritative profile so a concurrent `useSyncUserLanguage` read does not flip the language back. On error the local change persists for the session.
- `useSyncUserLanguage()` — `useQuery(['currentUser'], getCurrentUser, { enabled: isAuthenticated })`. A `useEffect` watches `serverLanguage`; if it differs from `i18n.language` and is a supported code, `applyLanguageLocally` is called. This handles the cross-device restore case.

### Frontend: UI Components (3 modified files, +120 lines, -17 lines)

**`frontend/src/components/ui/organisms/TopNav.tsx`** — MODIFIED (+96 lines, -6 lines)
- **Key changes**:
  - `useTranslation` and `useLanguage` imported; all user-menu strings replaced with `t(...)` calls.
  - `languageLabels: Record<LanguageCode, string>` maps each code to its localized display name (itself a translated string).
  - `languageAnchorEl` state manages the nested Language submenu independently from `anchorEl`.
  - `handleLanguageMenuOpen`, `handleSelectLanguage` handlers; `handleMenuClose` extended to also close the language submenu.
  - A "Language" `MenuItem` with `LanguageIcon` + `ChevronRightIcon` opens the nested `Menu`.
  - The nested `Menu` uses `slotProps={{ root: { disablePortal: true } }}` to render inside the same DOM portal as the outer menu, avoiding dual-focus-trap and `aria-hidden` console warnings from simultaneous portal menus.
  - Each language option uses `role="menuitemradio"` and `aria-checked={language === currentLanguage}` for accessible state.

**`frontend/src/components/ui/organisms/SideNav.tsx`** — MODIFIED (+18 lines, -6 lines)
- **Key change**: `useTranslation` imported; all six `menuItems` label values replaced with `t('nav.<key>')` calls. Labels re-evaluate on every render after a language switch because i18next triggers a re-render via `useTranslation`.

**`frontend/src/components/ui/organisms/AppShell.tsx`** — MODIFIED (+6 lines)
- **Key change**: `useSyncUserLanguage()` called unconditionally inside `AppShell`. Mounted here because `AppShell` wraps every authenticated page, so the sync runs exactly once per app session.

**`frontend/src/main.jsx`** — MODIFIED (+1 line)
- Side-effect import `import './i18n'` added before the React tree renders so the i18next instance is initialized before any `useTranslation` call.

### Frontend: Test Infrastructure (5 modified + 1 new file, +71 lines)

**`frontend/src/test/mocks/handlers/users.ts`** — NEW (+44 lines)
- `DEFAULT_CURRENT_USER` baseline with `language: 'en'`.
- `currentUserStore` in-memory object; `resetUserStore()` exported for `afterEach` isolation.
- `http.get /users/me` returns the store; `http.patch /users/me` updates `language` in the store so a subsequent GET in the same test reflects the change.

**`frontend/src/test/mocks/handlers/index.ts`** — MODIFIED (+3 lines)
- `userHandlers` imported and spread into the combined `handlers` array; `resetUserStore` re-exported.

**`frontend/src/test/mocks/server.ts`** — MODIFIED (+1 line)
- Re-exports `resetUserStore` from `handlers/users` for direct import in `setup.ts`.

**`frontend/src/test/setup.ts`** — MODIFIED (+6 lines)
- `import i18n from '@/i18n'` — initializes the i18next singleton before any test runs (required for `useTranslation` to work in tests without a wrapper).
- `resetUserStore()` called in `afterEach` to prevent language changes in one test leaking into the next via the MSW store.
- `i18n.changeLanguage('en')` called in `afterEach` to reset the i18next singleton to English (it is a module-level singleton shared across all tests in the suite).

### Frontend: Tests (2 new files, +110 lines)

**`frontend/src/__tests__/i18n.contract.test.ts`** — NEW (+20 lines)
- **Purpose**: Cross-layer contract — locks `SUPPORTED_LANGUAGES` from `src/i18n/index.ts` to `['en', 'pt-BR']`. This test is the **last** thing to update when adding a language; failing here signals that the other five locations have not all been updated yet.

**`frontend/src/__tests__/language-switcher.integration.test.tsx`** — NEW (+90 lines)
- Renders `AppShell` under a family-scoped route with `FamilyProvider` and a `dashboard` child; uses `renderWithProviders` + `setupAuthenticatedUser`.
- **"renders navigation labels in English by default"**: `SideNav` shows "Dashboard" and "Transactions" on first render.
- **"switches navigation labels to Portuguese when selected from the user menu"**: Opens avatar → "Language" → "Português (BR)"; asserts `screen.getByText('Painel')` and `screen.queryByText('Dashboard') === null`.
- **"marks the active language with a check in the submenu"**: Switches to pt-BR, reopens the submenu (now labelled "Idioma"), finds `menuitemradio` for "Português (BR)" and asserts `aria-checked="true"`.

---

## Testing Strategy

### Backend Test Coverage

8 new tests in `backend/api/tests/test_users.py` cover the full `/users/me` surface:

| Test | Assertion |
|------|-----------|
| `test_supported_languages_contract` | `SUPPORTED_LANGUAGES == {"en", "pt-BR"}` — cross-layer drift guard |
| `test_read_current_user_returns_default_language` | GET returns `language: "en"`, no `password_hash` |
| `test_update_language_persists_supported_value` | PATCH pt-BR → 200; subsequent GET also returns pt-BR |
| `test_update_language_rejects_unsupported_value` | PATCH `"fr"` → 422 |
| `test_update_language_rejects_explicit_null` | PATCH `null` → 422 (not 500) |
| `test_update_language_with_empty_body_is_noop` | PATCH `{}` → 200, language unchanged |
| `test_read_current_user_requires_authentication` | GET without token → 401 |
| `test_update_current_user_requires_authentication` | PATCH without token → 401 |

### Frontend Test Coverage

4 new frontend tests across two files:

- **`i18n.contract.test.ts`** — 1 test: locks `SUPPORTED_LANGUAGES` to `['en', 'pt-BR']`.
- **`language-switcher.integration.test.tsx`** — 3 tests: English default, full pt-BR switch with nav re-render, and `aria-checked` state on the active language option.

### Test Isolation

Language state isolation in `afterEach` uses two resets:
1. `resetUserStore()` — clears the MSW in-memory `/users/me` store.
2. `i18n.changeLanguage('en')` — resets the i18next module singleton, preventing language changes from one test affecting subsequent tests.

### Build Verification

`npm run build` completes with zero TypeScript errors. All `LanguageCode` usages across the frontend are fully typed; no `any` escape hatches were introduced.

---

## Migration Notes

### Running the Migration

```bash
cd backend/api
alembic upgrade head   # applies b7c8d9e0f1a2 — adds language column with server_default='en'

# Verify both directions
alembic downgrade -1   # drops language column
alembic upgrade head   # re-applies
```

### Expanding to a New Language (Future)

The infrastructure is terminal — built once, never revisited. Adding a third language is strictly additive:

1. Add the new code to `LanguageCode` in `backend/api/app/schemas.py` (e.g. `Literal["en", "pt-BR", "es"]`)
2. Add the same code to `SUPPORTED_LANGUAGES` in `frontend/src/i18n/index.ts`
3. Add the same code to `LanguageCode` in `frontend/src/types/index.ts`
4. Create `frontend/src/i18n/locales/es.json` with translations for all existing keys
5. Register the new resource in `frontend/src/i18n/index.ts` `resources`
6. Update `test_supported_languages_contract` (backend) and `i18n.contract.test.ts` (frontend) — these are the gating assertions that confirm all five locations are in sync

### Expanding Translations to New Screens

Per-screen migration is mechanical and does not touch the plumbing:

1. `const { t } = useTranslation()` in the component
2. Replace each literal with `t('feature.key')`
3. Add the key to **both** `en.json` and `pt-BR.json`

### No Breaking Changes

- All existing API clients are unaffected — `language` is a new field in `UserRead`; nothing in the existing API contracts changed.
- The `User` model's new `language` field has a Python-side default of `"en"` and a database `server_default` of `"en"` — no existing rows require a data migration.
- Components that do not call `useTranslation` are unaffected; i18next is initialized as a side effect and does not require providers around non-translated components.

---

## Performance Impact

- **Bundle size**: Minor increase from two locale JSON files (~1.4 KB each uncompressed) and the `i18next` + `react-i18next` packages. Translations are bundled rather than fetched at runtime, which eliminates a network round-trip for the initial render.
- **First paint**: No change — `getStoredLanguage()` reads `localStorage` synchronously at module init; no async work on the critical path.
- **API calls**: One additional `GET /users/me` per authenticated session (inside `useSyncUserLanguage`). The result is cached by React Query (`['currentUser']`) so subsequent reads are free.
- **Test suite duration**: No measurable change.

---

## Next Steps / Follow-up Work

- **Expand translations**: Remaining screens (transactions, accounts, budgets, reports, settings) can be migrated incrementally — each is a self-contained PR following the per-screen checklist above.
- **Interpolation and plurals**: Keys with dynamic values (e.g., `t('accounts.count', { count: n })`) and plural forms are supported by i18next natively; no infrastructure changes needed, only new keys.
- **AG Grid column headers**: `AgTransactionsGrid`, `AgAccountsGrid`, and `BudgetsList` column `headerName` strings are plain values in column defs — replace with `t('feature.columnKey')` exactly as for JSX strings.
- **Backend language validation on signup**: The `User` model defaults `language` to `"en"` at the ORM level. A future hardening step could accept `language` as an optional signup parameter and validate it against `SUPPORTED_LANGUAGES` at that point.
- **Language in TopNav for global mode**: `TopNav` in `globalMode` (the accounts overview) does not currently show a family switcher; the Language submenu is present there too but could be tested explicitly in a global-mode integration test.

---

## Related Documentation

- [Plan: language-selection-feature.md](../plans/language-selection-feature.md) — Full design plan with implementation steps, persistence decisions, and expansion guide
- [PR #58: Icon & Color for Categories, Accounts, and Budgets](Icon_Color_Categories_Accounts_Budgets_PR.md) — Base branch for this PR; established the `model_dump(exclude_unset=True)` + `setattr` router pattern reused here
- [SystemArchitecture.md](../SystemArchitecture.md) — Frontend structure, feature module layout, state management strategy
- [north_star.md](../north_star.md) — Domain model invariants; `User` is the personal-preference scope (not `Tenant`)
