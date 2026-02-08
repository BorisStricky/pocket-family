// src/test/utils.tsx
// Test utilities, render wrappers, and helper functions

import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { STORAGE_KEYS } from '@/lib/constants';
import { createMockJWT } from './mocks/factories';

/**
 * Create a QueryClient configured for testing
 * Disables retries and uses short cache times to make tests more predictable
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,           // Don't retry failed queries in tests
        staleTime: 30_000,      // Match production: data stays fresh during user interactions
        // gcTime defaults to 5 minutes — must be >= staleTime per React Query docs
        // Each test gets a fresh QueryClient so isolation is guaranteed
      },
      mutations: {
        retry: false,           // Don't retry failed mutations
      },
    },
  });
}

/**
 * Props for the AllProviders wrapper component
 */
interface AllProvidersProps {
  children: React.ReactNode;
  initialEntries?: string[];  // For MemoryRouter initial location
}

/**
 * Wrapper component that provides all necessary context providers
 * Used by renderWithProviders to wrap components under test
 */
export function AllProviders({ children, initialEntries }: AllProvidersProps) {
  const queryClient = createTestQueryClient();

  // Use MemoryRouter if initialEntries provided, otherwise BrowserRouter
  const Router = initialEntries ? MemoryRouter : BrowserRouter;
  const routerProps = initialEntries ? { initialEntries } : {};

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router {...routerProps}>
          {children}
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Props for the TestWrapper component
 */
interface TestWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

/**
 * Minimal test wrapper with just QueryClient and AuthProvider
 * Use this for hook tests that don't need routing
 * Optionally provide your own queryClient for more control
 */
export function TestWrapper({ children, queryClient }: TestWrapperProps) {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Extended render options for renderWithProviders
 */
interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];  // Set initial route for MemoryRouter
}

/**
 * Custom render function that wraps component with all providers
 * Use this instead of render() from @testing-library/react
 *
 * @example
 * const { getByText } = renderWithProviders(<MyComponent />);
 * const { getByRole } = renderWithProviders(<MyComponent />, { initialEntries: ['/app/123'] });
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const { initialEntries, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllProviders initialEntries={initialEntries}>{children}</AllProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Setup authenticated user state in localStorage
 * Call this in beforeEach or at the start of tests that need an authenticated user
 *
 * @example
 * setupAuthenticatedUser(); // Default tenant
 * setupAuthenticatedUser('custom-tenant-id'); // Specific tenant
 */
export function setupAuthenticatedUser(tenantId: string = 'tenant-uuid-456'): string {
  const token = createMockJWT({ tenantId });
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  return token;
}

/**
 * Clear all auth-related localStorage items
 * Useful for testing logout flows or unauthenticated states
 */
export function clearAuthStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}

// Re-export everything from @testing-library/react for convenience
// Tests can import { render, screen, waitFor } from '@/test/utils'
export * from '@testing-library/react';

// Re-export server for handler overrides in tests
export { server } from './mocks/server';

// Re-export factories for test data creation
export * from './mocks/factories';
