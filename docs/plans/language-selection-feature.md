# Language Selection Feature (EN / pt-BR)

## Context

Users want to switch the app's UI language between **English** and **Brazilian
Portuguese (pt-BR)** from the user dropdown in `TopNav` — placed alongside the
existing "See All Accounts" item. Today the app has **zero i18n infrastructure**:
every UI string is hardcoded English inline, and there is **no user-preferences
API** (the `User` model only stores `preferred_tenant_id`; localStorage only holds
tokens).

Per the user's decisions:
- **Persistence**: store the choice on the **backend `User` model** (follows the
  user across devices) **and** mirror it in localStorage for instant apply on load.
- **Scope (first pass)**: stand up i18next infrastructure + the switcher, and
  translate **high-visibility chrome only** (TopNav, SideNav menu, shared/common
  buttons). Remaining screens migrate incrementally later.
- **Dropdown UI**: a **nested "Language" submenu** listing English / Português (BR)
  with a checkmark on the active language.

### Branch

Base all work on PR 58's head branch **`claude/category-icons-colors-KoauH`**
(the frontend icons PR). Create and develop on **`claude/language-selection-feature-Q3hc0`**
branched from it. (PR 58 itself targets `development`.)

---

## Backend

Adds the first user-preference round-trip. Reuse the existing
`get_authenticated_user` dep (`backend/api/app/deps.py:108`) — it returns the user
without tenant scoping, which is exactly right for a per-user (not per-tenant)
setting.

1. **Model** — `backend/api/app/models.py` (`User`, ~line 109): add
   ```python
   language: str = Field(default="en", nullable=False)
   ```
   Two valid values: `"en"`, `"pt-BR"`.

2. **Migration** — new file in `backend/api/alembic/versions/`, chained off PR 58's
   final migration `f3a4b5c6d7e8_add_icon_color_to_budget.py` (i.e. `down_revision =
   "f3a4b5c6d7e8"`). `add_column("user", Column("language", String(8), nullable=False,
   server_default="en"))` on upgrade; `drop_column` on downgrade. `server_default`
   backfills existing rows safely.

3. **Schemas** — `backend/api/app/schemas.py` (auth section, near `TokenOut`):
   - `UserRead`: `id, email, name, language, created_at` (the safe, public subset —
     no `password_hash`).
   - `UserUpdate`: `language: Optional[str] = None`. Validate against the allowed set
     with a Pydantic field validator (reject anything other than `en` / `pt-BR` →
     422), mirroring the validation rigor used elsewhere.

4. **Router** — new `backend/api/app/routers/users.py`:
   - `GET /users/me` → `UserRead`, dep `Depends(get_authenticated_user)`.
   - `PATCH /users/me` → `UserUpdate` → updates `language`, `commit` + `refresh`,
     returns `UserRead`. Use the `model_dump(exclude_unset=True)` + `setattr` pattern
     PR 58 standardized.
   - Register in `backend/api/app/main.py` (~line 91): `app.include_router(users.router)`.

5. **Tests** — `backend/api/tests/test_users.py`: GET returns the default `en`;
   PATCH updates to `pt-BR` and persists; invalid value → 422; unauthenticated → 401.

---

## Frontend

### Dependencies (new)
Add `i18next` + `react-i18next` (the standard React i18n stack; lightweight, no
MUI conflict). This is the one structural addition — flagged here because
`frontend/CLAUDE.md` requires asking before adding deps; the user's choice of a
full i18n setup authorizes it.

### i18n setup
- `src/i18n/index.ts` — initialize i18next with `react-i18next`, `lng` read from
  localStorage (`pf_language`, fallback `en`), `fallbackLng: 'en'`, resources for
  `en` and `pt-BR`. Import this once in the app entry (`src/main.jsx`) before `<App/>`.
- `src/i18n/locales/en.json` and `src/i18n/locales/pt-BR.json` — translation
  resources for the first-pass surfaces. Namespaced keys, e.g.
  `nav.dashboard`, `nav.transactions`, `userMenu.seeAllAccounts`, `userMenu.logout`,
  `userMenu.language`, `common.cancel`, `common.save`.
- Add `LANGUAGE: 'pf_language'` to `STORAGE_KEYS` in `src/lib/constants.ts`.

### Preference sync
- `src/features/settings/api/userApi.ts` — `getCurrentUser()` (GET `/users/me`) and
  `updateLanguage(language)` (PATCH `/users/me`) via the central `apiFetch`.
- `src/features/settings/hooks/useLanguage.ts`:
  - exposes `currentLanguage` (from `i18n.language`) and `changeLanguage(lang)` which
    calls `i18n.changeLanguage`, writes localStorage, and fires the PATCH mutation
    (React Query, invalidate `['currentUser']`). Optimistic: UI updates instantly,
    backend syncs in the background.
  - `useSyncUserLanguage()` — a `useQuery(['currentUser'], getCurrentUser, { enabled:
    isAuthenticated })` that, on success, applies the server's `language` to i18n +
    localStorage when it differs (so a returning user on a new device picks up their
    saved choice). Call it once high in the tree (e.g. inside `AppShell` or the
    authenticated layout).

### Dropdown UI — `src/components/ui/organisms/TopNav.tsx`
Add a **"Language" `MenuItem`** between "See All Accounts" and "Logout". Clicking it
opens a **nested MUI `Menu`** (second `anchorEl` state) listing:
- `English` and `Português (BR)`, each a `MenuItem` with a `ListItemIcon` showing a
  `Check` when it matches `currentLanguage`.
Selecting one calls `changeLanguage(...)` and closes both menus. Wire the existing
hardcoded labels here through `useTranslation` (`t('userMenu.seeAllAccounts')`, etc.).

### First-pass translations
Replace hardcoded strings with `t(...)` in:
- `TopNav.tsx` (user menu items, "Pocket Family" can stay as brand).
- `src/components/ui/organisms/SideNav.tsx` — the `menuItems` labels
  (Dashboard/Transactions/Accounts/Budgets/Reports/Settings).
- Common buttons where trivially shared (e.g. Cancel/Save) — keep this pass small
  and focused; do not chase every screen.

### Frontend tests
- `src/__tests__/LanguageSwitcher.integration.test.tsx`: render the authenticated
  shell, open the user menu, open the Language submenu, click `Português (BR)`,
  assert a nav label switches to its pt-BR string and the active item shows the
  check. Use `renderWithProviders` + `setupAuthenticatedUser`; add an MSW handler
  for `GET`/`PATCH /users/me` in `src/test/mocks/handlers/`.
- Update any handler/factory that asserts full `User` shape to include `language`.

---

## Critical files

| Area | File |
|---|---|
| Model | `backend/api/app/models.py` (`User`) |
| Migration | `backend/api/alembic/versions/<new>_add_language_to_user.py` (down_revision `f3a4b5c6d7e8`) |
| Schemas | `backend/api/app/schemas.py` (`UserRead`, `UserUpdate`) |
| Router | `backend/api/app/routers/users.py` (new) + `main.py` registration |
| Backend test | `backend/api/tests/test_users.py` (new) |
| i18n init | `frontend/src/i18n/index.ts`, `locales/en.json`, `locales/pt-BR.json` |
| Constants | `frontend/src/lib/constants.ts` (`STORAGE_KEYS.LANGUAGE`) |
| Sync hook/api | `frontend/src/features/settings/{api/userApi.ts,hooks/useLanguage.ts}` |
| Dropdown | `frontend/src/components/ui/organisms/TopNav.tsx` |
| Nav labels | `frontend/src/components/ui/organisms/SideNav.tsx` |
| Frontend test | `frontend/src/__tests__/LanguageSwitcher.integration.test.tsx` + MSW `users` handler |

---

## Expansion guide (future passes — no rework required)

The pass-one infrastructure (i18next init, locale files, `useLanguage`, switcher,
`/users/me` sync) is **terminal**: built once, never revisited. Expanding to a new
section is strictly additive — you never edit the plumbing. The only thing that
prevents rework is locking the **key convention** below in pass one.

**Key convention** (set this in pass one and follow it everywhere):
- Feature-namespaced keys: `transactions.title`, `accounts.form.nameLabel`,
  `budgets.list.emptyState`.
- Shared bucket for truly reused strings: `common.save`, `common.cancel`,
  `common.delete`, `common.loading`.
- Validation messages under the feature: `accounts.form.errors.nameRequired`.

**Per-screen checklist** (mechanical, parallelizable across small PRs):
1. `const { t } = useTranslation()`.
2. Replace each literal with `t('feature.key')`.
3. Add the key to **both** `en.json` and `pt-BR.json`.

**Rough effort:** simple page (5–15 strings) ~15–30 min; form incl. validation
(15–30 strings) ~30–60 min; full feature (40–80 strings) ~half a day. Full-app
migration ≈ 2–4 focused sessions, one feature per PR.

**Three things that need care (all additive, none are rework):**
- **Interpolation/plurals** — `t('key', { name })`, i18next plural syntax for counts.
  New keys, not edits to existing ones.
- **AG Grid** — column headers / cell renderers (e.g. `AgAccountsGrid`,
  `BudgetsList`) read `t(...)` the same way; just defined in column defs, not JSX.
- **Translation quality** — each pt-BR string needs a fluent translation; a content
  cost identical whether done now or later, decoupled from code.

## Verification

**Backend**
```bash
cd backend/api
alembic upgrade head && alembic downgrade -1 && alembic upgrade head   # both directions
uv run pytest tests/test_users.py -v
uv run pytest                                                          # full suite green
```

**Frontend**
```bash
cd frontend
npm install            # picks up i18next + react-i18next
npm run build          # no TS errors
npm test               # incl. new LanguageSwitcher integration test
```

**Manual**
Run the app, open the user dropdown → **Language → Português (BR)**: SideNav menu +
user-menu labels switch immediately, the active language shows a checkmark. Reload —
choice persists (localStorage). Log in on a fresh browser — `GET /users/me` restores
the saved language. Confirm a `PATCH /users/me` fires in the network tab on change.
