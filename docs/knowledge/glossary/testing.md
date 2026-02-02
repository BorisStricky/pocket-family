---
documentation_status: New
overview: Covers testing tools and patterns including Vitest, React Testing Library, Jest-DOM matchers, and mocking strategies. Explains how to write effective unit and integration tests for React applications with proper test organization and coverage.
tags:
  - vitest
  - testing-library
  - jest
  - testing
  - typescript
  - react
---

# Testing

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
