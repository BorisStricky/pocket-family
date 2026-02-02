### Sprint 0: Foundation + Authentication (3-5 days)

## Goal
Working development environment with authentication flow. Users can sign up, log in, and tokens are stored. Full stack integration tested.

## Success Criteria
- [X] User can sign up with email/password
- [X] User can log in and receive access token
- [X] Token stored in localStorage and included in API calls
- [X] Public routes accessible without auth
- [X] Redirect to login when accessing protected routes unauthenticated
- [X] Environment variables working (`VITE_API_URL`)

---

## Components Checklist
Legend:
 - [ ] Todo
 - [X] Done
 - [-] In progress
 - [?] Needs Verification

### Infrastructure & Configuration

| Done | Item | File Path | Purpose | Notes |
|------|------|-----------|---------|-------|
| [X] | Project Init | `frontend/` | Vite + React + TypeScript | ✅ Initialized and working |
| [X] | package.json | `frontend/package.json` | Dependencies | ✅ All deps installed + @vitejs/plugin-react added |
| [X] | package-lock.json | `frontend/package-lock.json` | Lock file | ✅ Commit to repo for reproducible builds |
| [X] | tsconfig.json | `frontend/tsconfig.json` | TypeScript config | ✅ Strict mode, ES2020 target, jsx: react-jsx |
| [X] | vite.config.ts | `frontend/vite.config.ts` | Vite build config | ✅ React plugin, path aliases (@/), host: true |
| [X] | tailwind.config.js | `frontend/tailwind.config.js` | Tailwind config | ✅ Scans all TSX/JSX + Storybook files |
| [X] | postcss.config.js | `frontend/postcss.config.js` | PostCSS config | ✅ Tailwind + autoprefixer |
| [X] | index.css | `src/index.css` | Global styles | ✅ Tailwind directives present (fixed invalid imports) |
| [X] | .env.development | `frontend/.env.development` | Dev environment vars | ✅ `VITE_API_URL=http://localhost:8000` |
| [X] | .env.production | `frontend/.env.production` | Prod environment vars | ✅ `VITE_API_URL=https://api.yourdomain.com` |
| [X] | .gitignore | `frontend/.gitignore` | Git ignore | ✅ node_modules, dist, .env.local |

## Core Infrastructure

| Done | Item | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [X] | API Client | `src/lib/apiClient.ts` | Centralized fetch wrapper | ✅ Reads `VITE_API_URL` from env (fallback: localhost:8000)<br>✅ Adds `Authorization: Bearer ${token}` header<br>✅ Uses `STORAGE_KEYS.ACCESS_TOKEN` constant<br>✅ Handles JSON and non-JSON responses<br>✅ Throws `ApiError` with status codes |
| [X] | Constants | `src/lib/constants.ts` | App-wide constants | ✅ `STORAGE_KEYS`, `API_ENDPOINTS`, `ROUTES` |
| [X] | Types | `src/types/index.ts` | Shared TypeScript types | ✅ `User`, `TokenResponse`, `LoginRequest`, `SignupRequest`, `ApiResponse` |

## Auth Context & Hooks

| Done | Item | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [X] | Auth Context | `src/features/auth/context/AuthContext.tsx` | Global auth state | ✅ Provides `user`, `isAuthenticated`, `isLoading`<br>✅ Handles token storage/retrieval<br>✅ Exposes `setUser`, `setTokens`, `clearAuth` methods |
| [X] | useAuth | `src/features/auth/hooks/useAuth.ts` | Hook to access auth context | ✅ `const { user, isAuthenticated, setUser, setTokens, clearAuth } = useAuth()` |
| [X] | useLogin | `src/features/auth/hooks/useLogin.ts` | Login mutation | ✅ React Query mutation<br>✅ Calls `POST /auth/login`<br>✅ Stores tokens in localStorage<br>✅ Updates auth context |
| [X] | useSignup | `src/features/auth/hooks/useSignup.ts` | Signup mutation | ✅ Calls `POST /auth/signup`<br>✅ Stores tokens<br>✅ Updates context |
| [X] | useLogout | `src/features/auth/hooks/useLogout.ts` | Logout mutation | ✅ Calls `POST /auth/logout?refresh_token=...`<br>✅ Clears localStorage<br>✅ Resets auth context |

## API Functions

Notes: login API returns access and refresh tokens. Store the refresh token in the cookies. Auth token contains the family (tenant) information and is used alongside the passed tenant_id in API calls to verify access.
Notes for future sprints: When working on family context and switching families, make sure to get new tokens when switching families.

| Done | Function | File Path | Method | Endpoint | Request | Response | Notes |
|------|----------|-----------|--------|----------|---------|----------|-------|
| [X] | login | `src/features/auth/api/authApi.ts` | POST | `/auth/login` | `{email, password}` | `TokenOut` | ✅ operationId: `login_auth_login_post` |
| [X] | signup | `src/features/auth/api/authApi.ts` | POST | `/auth/signup` | `{email, password, name?}` | `TokenOut` | ✅ operationId: `signup_auth_signup_post` |
| [X] | logout | `src/features/auth/api/authApi.ts` | POST | `/auth/logout?refresh_token=...` | - | `{ok: true}` | ✅ operationId: `logout_auth_logout_post` |
| [X] | refreshToken | `src/features/auth/api/authApi.ts` | POST | `/auth/refresh?refresh_token=...` | - | `TokenOut` | ✅ operationId: `refresh_auth_refresh_post` |

**Type Reference (from OpenAPI):**
```typescript
// SignupIn schema
type SignupRequest = {
  email: string;
  password: string;
  name?: string;
}

// LoginIn schema
type LoginRequest = {
  email: string;
  password: string;
}

// TokenOut schema
type TokenResponse = {
  access_token: string;
  refresh_token?: string; // Only in test mode
  token_type: string; // "bearer"
}
```

## Routing

| Done | Item | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [X] | Router Config | `src/router/index.jsx` | React Router v6 setup | ✅ Public routes: `/`, `/login`, `/signup`, `/test-auth`<br>✅ Protected routes: `/app/*` with nested routes<br>✅ Uses `BrowserRouter` with `<Routes>` |
| [X] | ProtectedRoute | `src/components/ProtectedRoute.tsx` | Route guard wrapper | ✅ Checks `isAuthenticated` from AuthContext<br>✅ Redirects to `/login` if not authenticated<br>✅ Shows loading state while checking auth<br>✅ Renders children when authenticated |

## UI Components (Atoms - MUI-based)

| Done | Component | File Path | Props | Story | Notes |
|------|-----------|-----------|-------|-------|-------|
| [X] | Button | `src/components/ui/atoms/Button.tsx` | `variant?: 'primary'\|'secondary'\|'ghost', size?: 'sm'\|'md'\|'lg', onClick, disabled, children` | `Atoms/Button` | Wrapper around MUI Button with custom variants |
| [X] | Input | `src/components/ui/atoms/Input.tsx` | `name, value, onChange, type?, placeholder?, error?, label?` | `Atoms/Input` | Wrapper around MUI TextField |
| [X] | Icon | `src/components/ui/atoms/Icon.tsx` | `name: string, size?: number, className?` | `Atoms/Icon` | Wrapper for lucide-react icons |
| [X] | Typography | `src/components/ui/atoms/Typography.tsx` | `variant: 'h1'\|'h2'\|'body'\|'caption', children` | `Atoms/Typography` | Wrapper around MUI Typography |

**Note:** Start with plain MUI components in forms. Extract custom atoms after initial implementation

## UI Components (Molecules)

| Done | Component | File Path | Props | Story | Notes |
|------|-----------|-----------|-------|-------|-------|
| [ ] | FormField | `src/components/ui/molecules/FormField.tsx` | `label, name, value, onChange, error?, hint?, type?` | `Molecules/FormField` | MUI TextField with label, error message, and hint |

## Pages (Public)

| Done | Page | File Path | Route | Protected | Dependencies | Notes |
|------|------|-----------|-------|-----------|--------------|-------|
| [X] | Landing | `src/features/auth/pages/LandingPage.tsx` | `/` | No | Hero, FeaturesList, Footer | Marketing page with CTA to `/signup` |
| [X] | Login | `src/features/auth/pages/LoginPage.tsx` | `/login` | No | AuthForm, useLogin | Login form with email/password |
| [X] | Signup | `src/features/auth/pages/SignupPage.tsx` | `/signup` | No | AuthForm, useSignup | Signup form with email/password/name |
| [ ] | Password Reset | `src/features/auth/pages/PasswordResetPage.tsx` | `/password-reset` | No | FormField | Simple form (implementation deferred) |

## Feature Components (Auth-specific)

| Done | Component | File Path | Props | Used In | Notes |
|------|-----------|-----------|-------|---------|-------|
| [X] | AuthForm | `src/features/auth/components/AuthForm.tsx` | `mode: 'login'\|'signup', onSubmit, isLoading?` | Login, Signup | Reusable form with validation using MUI components |
| [ ] | Hero | `src/features/auth/components/Hero.tsx` | `title, subtitle, ctaText, ctaLink` | Landing | Hero section with CTA button |
| [ ] | FeaturesList | `src/features/auth/components/FeaturesList.tsx` | `features: Array<{icon, title, desc}>` | Landing | Grid of feature cards |
| [ ] | Footer | `src/components/ui/organisms/Footer.tsx` | - | All public pages | Footer with links (About, Privacy, Terms) |

## Assets

| Done | Asset | File Path | Purpose | Notes |
|------|-------|-----------|---------|-------|
| [X] | Logo SVG | `public/logo.svg` | Brand logo | ✅ Placeholder created |
| [X] | Logo Mark | `public/logo-mark.svg` | Icon/favicon | ✅ Placeholder created |
| [ ] | Hero Illustration | `src/assets/hero-illustration.svg` | Landing page graphic | Simple SVG placeholder acceptable |
| [X] | Favicon | `public/favicon.svg` | Browser tab icon | ✅ SVG favicon created (referenced in index.html) |

## Testing

| Done | Test | File Path | Purpose | Notes |
|------|------|-----------|---------|-------|
| [X] | Vitest config | `vitest.config.ts` | Test runner configuration | ✅ jsdom environment, coverage, path aliases |
| [X] | Test setup | `src/test/setup.ts` | Global test setup | ✅ jest-dom, matchMedia mock, cleanup |
| [X] | Test utils | `src/test/utils.tsx` | Test helpers | ✅ renderWithProviders, createTestQueryClient |
| [X] | jwtUtils tests | `src/lib/jwtUtils.test.ts` | JWT decoding utilities | ✅ 16 tests - decodeJWT, getUserFromToken, isTokenExpired |
| [X] | apiClient tests | `src/lib/apiClient.test.ts` | Fetch wrapper | ✅ 13 tests - headers, credentials, errors, ApiError |
| [X] | useLogin tests | `src/features/auth/hooks/useLogin.test.tsx` | Login hook | ✅ 8 tests - token storage, error handling, state |
| [X] | useSignup tests | `src/features/auth/hooks/useSignup.test.tsx` | Signup hook | ✅ 10 tests - token storage, validation, errors |
| [X] | useLogout tests | `src/features/auth/hooks/useLogout.test.tsx` | Logout hook | ✅ 9 tests - cleanup, error handling |
| [X] | AuthContext tests | `src/features/auth/context/AuthContext.test.tsx` | Auth state | ✅ 17 tests - token restoration, state transitions |
| [X] | ProtectedRoute test | `src/components/ProtectedRoute.test.tsx` | Route guard | ✅ 7 tests - loading, redirect, authenticated states |

**Test Scripts:**
- `npm run test` - Watch mode (reruns on changes)
- `npm run test:run` - Run once (CI mode)
- `npm run test:ui` - Visual UI
- `npm run test:coverage` - Coverage report

**Test Results:** ✅ 80 tests passing across 7 test files

---

## Implementation Steps (Sprint 0)

### Step 1: Project Setup ✅ COMPLETED
- [X] Initialize Vite + React + TypeScript
- [X] Install dependencies (see package.json below) + added @vitejs/plugin-react
- [X] Configure Tailwind CSS (created tailwind.config.js, postcss.config.js)
- [X] Set up folder structure (`src/components/`, `src/features/`, `src/lib/`)
- [X] Add `.env.development` and `.env.production`
- [X] Add basic assets (logo SVG placeholders, favicon)
- [X] Create vite.config.ts with React plugin and path aliases
- [X] Create .gitignore with standard Vite entries
- [X] Fixed index.css (commented invalid imports, Tailwind directives present)
- [X] Updated index.html with favicon reference and proper title
- [X] Created placeholder pages (landing, login, signup, app_shell) for build compatibility
- [X] Created placeholder hooks (useTransaction, useTransactionMutations) for build compatibility
- [X] Verified: `npm run dev` starts on http://localhost:5173
- [X] Verified: `npm run build` creates production build in /dist

### Step 2: API Client & Infrastructure ✅ COMPLETED
- [X] Implement `src/lib/apiClient.ts` with environment variable support
- [X] Create `src/lib/constants.ts` for storage keys (`STORAGE_KEYS`, `API_ENDPOINTS`, `ROUTES`)
- [X] Define shared types in `src/types/index.ts` (`User`, `TokenResponse`, `LoginRequest`, `SignupRequest`, `ApiResponse`)
- [X] Add `ApiError` class for better error handling
- [X] Update apiClient to use `STORAGE_KEYS.ACCESS_TOKEN` constant
- [X] Fix base URL from `localhost:3000` → `localhost:8000`
- [X] Add JSDoc comments for documentation
- [X] Verify backend `/ping` endpoint is accessible (confirmed by user)
- [X] Created test file `__test-apiclient__.ts` for manual testing

### Step 3: Auth Context & Hooks ✅ COMPLETED
- [X] Create `AuthContext` with token storage logic
- [X] Implement `useAuth` hook
- [X] Create API functions in `authApi.ts` (login, signup, logout, refreshToken)
- [X] Implement React Query hooks: `useLogin`, `useSignup`, `useLogout`
- [X] Set up `QueryClient` provider in main.jsx
- [X] Wrap app with `AuthProvider` in main.jsx
- [X] Created test component `__test-auth__.tsx` for manual testing
- [X] Verified build succeeds with all auth infrastructure

### Step 4: Routing & Guards ✅ COMPLETED
- [X] Review existing router configuration in `src/router/index.jsx`
- [X] Create `ProtectedRoute` component using AuthContext
- [X] Replace old `RequireAuth` with new `ProtectedRoute`
- [X] Public routes defined: `/`, `/login`, `/signup`, `/test-auth`
- [X] Protected routes: `/app/*` with nested Dashboard, Transactions, Accounts, Budgets, Reports, Settings
- [X] Add loading state to ProtectedRoute
- [X] Verified build succeeds with routing guards

### Step 5: Auth UI Components ✅ COMPLETED
- [X] Build `AuthForm` component (reusable for login/signup)
- [X] Use MUI `TextField`, `Button`, `Box`, `Paper` for layout
- [X] Add form validation (email format, password length, required name for signup)
- [X] Handle loading states with CircularProgress
- [X] Handle error states with Alert component
- [X] Add links between login/signup forms

### Step 6: Public Pages ✅ COMPLETED
- [X] Build Login page using `AuthForm` + `useLogin`
- [X] Build Signup page using `AuthForm` + `useSignup`
- [X] Build Landing page with Hero section, Features, and Footer
- [X] Add navigation links between pages
- [X] Add redirect to /app when already authenticated
- [X] Update AppShell with user info (ID, tenant_id, roles)
- [X] Add logout button to AppShell
- [X] Removed old placeholder .jsx files
- [X] Verified build succeeds (1m 18s)

### Step 7: Testing & Polish ✅ COMPLETED
- [X] Installed Vitest and testing dependencies (@testing-library/react, jest-dom, jsdom)
- [X] Created vitest.config.ts with jsdom environment and coverage settings
- [X] Created test setup file (src/test/setup.ts) with global mocks and cleanup
- [X] Created test utilities (src/test/utils.tsx) with renderWithProviders helper
- [X] Added test scripts to package.json (test, test:run, test:ui, test:coverage)
- [X] Wrote comprehensive test suites:
  - ✅ jwtUtils.test.ts (16 tests) - JWT decoding, expiration, user extraction
  - ✅ apiClient.test.ts (13 tests) - Headers, credentials, error handling, ApiError
  - ✅ useLogin.test.tsx (8 tests) - Login mutation, token storage, errors
  - ✅ useSignup.test.tsx (10 tests) - Signup mutation, validation, errors
  - ✅ useLogout.test.tsx (9 tests) - Logout mutation, cleanup, error handling
  - ✅ AuthContext.test.tsx (17 tests) - Token restoration, state transitions
  - ✅ ProtectedRoute.test.tsx (7 tests) - Loading, redirect, authenticated rendering
- [X] Fixed all 19 initial test failures (Router nesting, Headers format, timing issues)
- [X] All 80 tests passing successfully
- [X] Updated .gitignore to exclude coverage/ directory
- [X] Updated docs/glossary.md with comprehensive Testing section
- [X] Test full auth flow: signup → login → token storage
- [X] Test API error handling (401, 400, network errors)
- [X] Write unit tests for auth hooks and components

### Step 8: Documentation ✅ COMPLETED
- [X] Created comprehensive README.md with:
  - Local development setup (`npm install`, `npm run dev`)
  - Environment variables (VITE_API_URL) with table
  - Docker build instructions (Dockerfile + docker-compose.yml)
  - All available scripts (dev, build, test, storybook)
  - Project structure overview
  - Troubleshooting section
- [X] Documented CORS requirements for backend
  - FastAPI CORS middleware configuration
  - Explanation of allow_credentials=True for HttpOnly cookies
  - Common CORS errors and solutions
- [X] Updated .memory_bank/components_used.md with:
  - Sprint 0 component inventory (24 components documented)
  - Atoms (11), Molecules (2), Organisms (2), Auth (2), Pages (4), Forms (1), Modals (1)
  - Usage status, Storybook availability, test coverage
  - Component reusability matrix

### Step 9: Polish
- [X] Display meaningful error messages (i.e. email already reginstred, instead of API error 400)

---

# Dependencies (package.json)

```json
{
  "name": "personal-finance-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.0",
    "@mui/material": "^5.15.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "@tanstack/react-query": "^5.28.0",
    "lucide-react": "^0.344.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.56",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.4",
    "tailwindcss": "^3.4.1",
    "postcss": "^8.4.35",
    "autoprefixer": "^10.4.17",
    "@testing-library/react": "^14.2.1",
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/user-event": "^14.5.2",
    "vitest": "^1.3.1",
    "msw": "^2.1.0"
  }
}
```

**Note:** AG Grid and Recharts not needed until Sprint 2+. Add them later to keep bundle size small.

---

# API Endpoints Reference (Sprint 0)

Based on `openAPI_spec.json`:

| Endpoint | Method | operationId | Request Schema | Response Schema | Notes |
|----------|--------|-------------|----------------|-----------------|-------|
| `/auth/signup` | POST | `signup_auth_signup_post` | `SignupIn` | `TokenOut` | Returns `access_token` + `refresh_token` (test mode) |
| `/auth/login` | POST | `login_auth_login_post` | `LoginIn` | `TokenOut` | Returns `access_token` + `refresh_token` (test mode) |
| `/auth/refresh` | POST | `refresh_auth_refresh_post` | Query param: `refresh_token` | `TokenOut` | Rotate refresh token, get new access token |
| `/auth/logout` | POST | `logout_auth_logout_post` | Query param: `refresh_token` | `{ok: true}` | Revoke refresh token |
| `/ping` | GET | `ping_ping_get` | - | `{ok: true}` | Health check (optional for testing apiClient) |

---

# Notes & Assumptions

- **CORS:** Backend must allow `http://localhost:5173` (Vite dev) and production origin
- **Token Storage:** Store in `localStorage` with keys `pf_access_token`, `pf_refresh_token`
- **No family_id yet:** Sprint 1 adds family/tenant context
- **Password reset:** UI placeholder only, full flow deferred
- **OAuth:** Deferred to future sprint
- **Refresh token logic:** Implement token refresh interceptor in apiClient (optional for MVP, can defer)