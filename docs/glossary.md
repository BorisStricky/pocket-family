# Technical Glossary - Personal Finance App

This glossary contains high-level concepts you should learn more about as you work on this project. Each entry includes a brief explanation and context for where it's used.

---

## Frontend Build & Configuration

**Vite**: Modern frontend build tool that provides fast development server with hot module replacement (HMR) and optimized production builds. We use it as our bundler instead of Create React App or Webpack. Configuration: [vite.config.ts](../frontend/vite.config.ts)

**Tailwind CSS**: Utility-first CSS framework that generates CSS based on classes used in your components. Requires configuration to scan files for class names. Configuration: [tailwind.config.js](../frontend/tailwind.config.js)

**PostCSS**: CSS preprocessor that transforms CSS with plugins. We use it to process Tailwind directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`) into actual CSS. Configuration: [postcss.config.js](../frontend/postcss.config.js)

**Path Alias (@/)**: TypeScript/Vite feature that maps `@/` to `src/` directory, allowing imports like `import { Button } from '@/components/ui/Button'` instead of relative paths like `../../components/ui/Button`. Configured in vite.config.ts and tsconfig.json.

**Environment Variables (VITE_*)**: Configuration values that change between environments (development/production). In Vite, env vars must be prefixed with `VITE_` to be exposed to frontend code. Access via `import.meta.env.VITE_API_URL`. Files: `.env.development`, `.env.production`

---

## Routing & Navigation

**React Router**: Library for client-side routing in React apps. Allows navigation between pages without full page reload. We use v6 with nested routes. Main config: [router/index.jsx](../frontend/src/router/index.jsx)

**BrowserRouter**: Router component that uses HTML5 history API for clean URLs (no `#` hash). Wraps entire app to enable routing.

**Routes & Route**: Components that define which component to render for each URL path. Example: `<Route path="/login" element={<LoginPage />} />`

**Nested Routes**: Routes defined inside other routes. We use this for the app shell - `/app/*` wraps all authenticated pages with sidebar/navigation. Child routes like `/app/transactions` render inside the parent's `<Outlet />`.

**Navigate Component**: Programmatic redirect in React Router. Example: `<Navigate to="/login" replace />` redirects user to login page.

**useNavigate Hook**: Hook that returns a function to programmatically navigate. Example: `navigate('/app')` after successful login.

**Protected Routes**: Custom wrapper component that checks if user is authenticated before rendering. If not authenticated, redirects to login. Implementation: [ProtectedRoute.tsx](../frontend/src/components/ProtectedRoute.tsx)

---

## Authentication & Security

**JWT (JSON Web Token)**: Encoded string containing user information and expiration time. Backend creates JWT on login/signup, frontend stores it and sends with API requests. Structure: `header.payload.signature`

**JWT Payload**: The middle part of JWT containing claims (data) like user ID, tenant ID, roles, expiration. We decode this client-side to get user info. Example claims:
- `sub`: user ID
- `tenant_id`: family/tenant ID
- `roles`: array of user roles
- `exp`: expiration timestamp

**Access Token**: Short-lived JWT used to authenticate API requests. Sent in `Authorization: Bearer <token>` header. Stored in localStorage.

**Refresh Token**: Long-lived token used to get new access tokens when they expire. Stored as HttpOnly cookie for security. More secure pattern than storing long-lived access tokens in localStorage.

**HttpOnly Cookie**: Browser cookie with `httponly` flag that prevents JavaScript from accessing it via `document.cookie`. Protects against XSS attacks where malicious scripts try to steal tokens. Browser automatically sends HttpOnly cookies with requests to the same domain. We use this for refresh tokens. Set by backend with `response.set_cookie(httponly=True)`, requires `credentials: 'include'` in frontend fetch.

**localStorage**: Browser API for storing key-value pairs that persist across page reloads. We use it to store the access token (`pf_access_token`). Refresh token is NOT stored here (stored as HttpOnly cookie instead for security).

**Token Decoding (Client-Side)**: Extracting payload from JWT using base64 decoding. NOT verification (which requires secret key on backend). We decode to read user ID, tenant ID, roles. Implementation: [jwtUtils.ts](../frontend/src/lib/jwtUtils.ts)

**CORS (Cross-Origin Resource Sharing)**: Browser security feature that blocks requests from one origin (e.g., `localhost:5173`) to another (e.g., `localhost:8000`) unless the server explicitly allows it. Fixed by adding CORS middleware to FastAPI backend. Configuration: [backend/api/app/main.py](../backend/api/app/main.py)

**CORS Preflight Request**: Automatic OPTIONS request sent by browser before actual POST/PUT/DELETE requests to check if CORS is allowed. Backend must respond with appropriate headers (`Access-Control-Allow-Origin`, etc.).

---

## State Management

**React Context API**: Built-in React feature for sharing state across components without prop drilling. We use it for global auth state (user, tokens). Implementation: [AuthContext.tsx](../frontend/src/features/auth/context/AuthContext.tsx)

**Context Provider**: Component that wraps app and provides context value to all children. Example: `<AuthProvider>` makes auth state available everywhere.

**useContext Hook**: Hook to access context value in any component. We wrap it in custom hooks like `useAuth()` for better API.

**React Query (TanStack Query)**: Library for managing server state (API data). Handles loading states, caching, refetching, mutations. Alternative to Redux for async data. We use it for all API calls.

**Query**: Read operation (GET requests). Automatically caches data and refetches when stale. Example: `useQuery({ queryKey: ['transactions'], queryFn: fetchTransactions })`

**Mutation**: Write operation (POST/PUT/DELETE). Used with callbacks for success/error handling. Example: `useMutation({ mutationFn: login, onSuccess: () => navigate('/app') })`

**QueryClient**: React Query's cache manager. Configured once at app root with default options. Wrapped app in `<QueryClientProvider>`.

---

## React Patterns & Hooks

**Custom Hooks**: Functions starting with `use` that encapsulate reusable logic. We created:
- `useAuth()`: Access auth context (user, login status, tokens)
- `useLogin()`: Login mutation with token storage
- `useSignup()`: Signup mutation
- `useLogout()`: Logout mutation with cleanup

**useEffect Hook**: Runs side effects (API calls, subscriptions, etc.) when component mounts or dependencies change. Example: Check auth status on mount, redirect if authenticated.

**useState Hook**: Creates state variable and setter function. Example: `const [email, setEmail] = useState('')` for form inputs.

**Controlled Components**: Form inputs where React state is the single source of truth. Value comes from state, changes update state via `onChange`. Better than uncontrolled (DOM is source of truth).

---

## TypeScript

**Interface**: TypeScript structure defining the shape of an object. Used for props, API responses, domain models. Example: `interface User { id: string; email: string; }`

**Type Safety**: Catching errors at compile time instead of runtime. TypeScript checks that you're using correct types (string vs number, required vs optional fields).

**Generics**: Type parameters that make components/functions reusable with different types. Example: `ApiResponse<T>` can be `ApiResponse<User>` or `ApiResponse<Transaction>`.

**Union Types**: Type that can be one of several types. Example: `mode: 'login' | 'signup'` means mode can only be those two strings.

**Optional Properties**: Object properties that may or may not exist. Denoted with `?`. Example: `name?: string` means name can be string or undefined.

---

## API Communication

**REST API**: Architecture style where each URL represents a resource and HTTP methods (GET/POST/PUT/DELETE) represent actions. Example: `POST /auth/login`, `GET /transactions`

**API Client (apiFetch)**: Centralized function for all API calls. Handles auth headers, base URL, JSON parsing, error handling. Implementation: [apiClient.ts](../frontend/src/lib/apiClient.ts)

**Request Headers**: Metadata sent with HTTP requests. We send:
- `Content-Type: application/json`: Tells server we're sending JSON
- `Authorization: Bearer <token>`: Proves user is authenticated

**credentials: 'include'**: Fetch API option that tells browser to include cookies in cross-origin requests. Required when using HttpOnly cookies for authentication. Without this, the browser won't send cookies to different origins (e.g., from `localhost:5173` frontend to `localhost:8000` backend). Set in `apiFetch` function.

**HTTP Status Codes**:
- `200-299`: Success
- `400`: Bad request (validation error)
- `401`: Unauthorized (not logged in or token expired)
- `403`: Forbidden (logged in but don't have permission)
- `404`: Not found
- `500`: Server error

**API Error Handling**: Pattern for handling errors from API:
1. Catch errors in mutation/query
2. Show user-friendly message
3. Log actual error for debugging
4. Handle 401 by logging out user

---

## UI Components & Design

**Material-UI (MUI)**: React component library implementing Google's Material Design. We use v7. Provides pre-built components like Button, TextField, Modal, Drawer.

**Component Props**: Arguments passed to React components. TypeScript interfaces define what props are required/optional and their types.

**Form Validation**: Checking user input before submission. We validate:
- Email format (regex pattern)
- Password length (min 6 chars)
- Required fields (not empty)

**Loading States**: UI feedback while async operations run. Shows spinner/disabled button so user knows something is happening. Example: `isPending` from React Query mutation.

**Error States**: UI feedback when operations fail. Shows error message so user knows what went wrong. Example: `error?.message` from mutation.

---

## Development Workflow

**Dev Container**: Docker container configured for development with all tools installed. Your VS Code runs inside the container for consistent environment across machines.

**Docker Compose**: Tool for defining multi-container applications. Our setup has separate containers for:
- `db`: PostgreSQL database
- `backend`: FastAPI server
- `frontend`: Vite dev server (or your dev container)

**Hot Module Replacement (HMR)**: Vite feature that updates code in browser without full page reload. Preserves component state while you develop.

**npm Scripts**: Commands defined in package.json:
- `npm run dev`: Start Vite dev server
- `npm run build`: Create production build
- `npm run storybook`: Start component library

**Environment**: Development vs Production. Different configs (API URLs, debug settings) for each. Files: `.env.development`, `.env.production`

---

## Testing

**Vitest**: Vite-native test runner for unit and integration tests. Provides Jest-compatible API with faster execution and better TypeScript support. Used for testing React components, hooks, and utilities. Configuration: [vitest.config.ts](../frontend/vitest.config.ts)

**@testing-library/react**: Testing library for React components that encourages testing from user perspective (what users see/do) rather than implementation details. Provides utilities like `render()`, `screen`, `fireEvent`, `waitFor()`, and `renderHook()` for testing hooks.

**Jest-DOM Matchers**: Custom matchers for asserting on DOM nodes. Examples: `toBeInTheDocument()`, `toHaveTextContent()`, `toBeDisabled()`, `toHaveValue()`. Makes tests more readable and provides better error messages than vanilla assertions.

**jsdom**: Browser environment simulation for Node.js. Allows tests to render React components and interact with DOM APIs (document, window, localStorage) without a real browser.

**Test Coverage**: Metric showing percentage of code executed during tests. Generated with `npm run test:coverage`. Goal is high coverage for critical paths (auth, data mutations) but not necessarily 100% everywhere. Vitest uses V8 coverage provider for accurate JavaScript coverage.

**Test Scripts**: Commands for running tests:
- `npm run test`: Run tests in watch mode (reruns on file changes)
- `npm run test:run`: Run all tests once (CI mode)
- `npm run test:ui`: Open Vitest UI in browser for visual test exploration
- `npm run test:coverage`: Generate coverage report in HTML, JSON, and text formats

**Unit Testing**: Testing individual functions, components, or modules in isolation. Examples: testing JWT decoding logic, testing individual hooks, testing API client error handling.

**Integration Testing**: Testing how multiple units work together. Examples: testing AuthContext with hooks, testing ProtectedRoute with auth flow, testing form submission with API calls.

**Mocking**: Replacing real dependencies with fake implementations for testing. We mock:
- API calls (`vi.mock('../api/authApi')`)
- Browser APIs (localStorage, fetch)
- External modules
This isolates the code under test and makes tests faster and more predictable.

**Test Providers**: Wrapper components that provide necessary context for testing. Our `renderWithProviders()` utility wraps components with QueryClientProvider, AuthProvider, and BrowserRouter so tests have access to React Query, auth state, and routing.

**Test Organization**: Tests are colocated with source files using `.test.ts` or `.test.tsx` extensions. Example: `jwtUtils.ts` has tests in `jwtUtils.test.ts`. Test files in the same directory as the code they test for easy discovery.

---

## Project Structure Concepts

**Feature-Based Organization**: Grouping code by business feature (auth, transactions, accounts) rather than technical type (components, hooks). Each feature has its own components, hooks, API functions.

**Atomic Design**: Component hierarchy:
- **Atoms**: Basic building blocks (Button, Input)
- **Molecules**: Simple combinations (SearchInput with icon)
- **Organisms**: Complex components (TransactionsList, AppShell)

**Pages**: Top-level components that represent routes. Connect data (hooks) to presentation (components). Examples: LoginPage, SignupPage, DashboardPage.

**Public vs Protected Pages**: Public pages (landing, login, signup) are accessible without authentication. Protected pages (dashboard, transactions) require user to be logged in.

---

## Concepts to Learn More About

As you continue working, research these topics:
- React Query caching and invalidation strategies
- JWT best practices and security considerations
- React performance optimization (memo, useMemo, useCallback)
- Form libraries (React Hook Form for complex forms)
- Error boundaries for catching React errors
- E2E testing (Playwright, Cypress)
- Accessibility (ARIA labels, keyboard navigation)
- TypeScript advanced types (Pick, Omit, Partial)

---

## Resources

- **React**: https://react.dev/learn
- **TypeScript**: https://www.typescriptlang.org/docs/
- **React Router**: https://reactrouter.com/
- **React Query**: https://tanstack.com/query/latest/docs/framework/react/overview
- **Material-UI**: https://mui.com/material-ui/getting-started/
- **Vite**: https://vitejs.dev/guide/
- **Tailwind CSS**: https://tailwindcss.com/docs

---

**Last Updated**: 2025-12-09 (Sprint 0 - Step 7: Testing & Polish)
