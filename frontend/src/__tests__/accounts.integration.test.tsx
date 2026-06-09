/**
 * Integration tests for the Accounts feature pages
 *
 * Tests both views of the accounts feature:
 * 1. AccountsPage - Family-scoped view at /app/:familyId/accounts
 *    Shows only accounts shared with a specific family (passes tenant_id)
 * 2. AllAccountsPage - Global view at /app/accounts
 *    Shows all user accounts across all families (no tenant_id filter)
 *
 * These tests verify page rendering, loading/error/empty states,
 * navigation behavior, and that account data displays correctly.
 *
 * MSW intercepts API calls so we can control responses per test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import { resetAccountStore } from '@/test/mocks/server';
import { AccountsPage } from '@/features/accounts/pages/AccountsPage';
import AllAccountsPage from '@/features/accounts/pages/AllAccountsPage';

const API_BASE = 'http://localhost:8000';

// Shared tenant ID used across family-scoped tests
// Must match the tenant_id encoded in the mock JWT from setupAuthenticatedUser
const TENANT_ID = 'tenant-uuid-456';

describe('Accounts Integration - Family Accounts Page', () => {
  beforeEach(() => {
    // Reset account store to default 5 accounts before each test
    // This ensures test isolation since handlers use an in-memory store
    resetAccountStore();
    // Set up authenticated user so API requests include Authorization header
    setupAuthenticatedUser(TENANT_ID);
  });

  /**
   * Helper to render AccountsPage within a Route that provides :familyId param.
   * AccountsPage uses useParams() to extract familyId, so it must be rendered
   * inside a matching Route definition.
   */
  function renderFamilyAccountsPage() {
    return renderWithProviders(
      <Routes>
        <Route path="/app/:familyId/accounts" element={<AccountsPage />} />
      </Routes>,
      { initialEntries: [`/app/${TENANT_ID}/accounts`] }
    );
  }

  it('loads and displays account data in the grid', async () => {
    renderFamilyAccountsPage();

    // The page title should render immediately
    expect(screen.getByRole('heading', { name: /accounts/i })).toBeInTheDocument();

    // Wait for the API call to resolve and account names to appear
    // Default mock store has 5 accounts named "Account 1" through "Account 5"
    await waitFor(() => {
      expect(screen.getByText('Account 1')).toBeInTheDocument();
    });

    // Verify multiple accounts rendered (spot-check a few)
    expect(screen.getByText('Account 2')).toBeInTheDocument();
    expect(screen.getByText('Account 3')).toBeInTheDocument();
  });

  it('shows empty state when no accounts exist', async () => {
    // Override the GET /accounts handler to return an empty array
    // This simulates a new user who has not created any accounts yet
    server.use(
      http.get(`${API_BASE}/accounts`, () => {
        return HttpResponse.json([]);
      })
    );

    renderFamilyAccountsPage();

    // Wait for the empty state message to appear after loading completes
    await waitFor(() => {
      expect(screen.getByText('No accounts yet')).toBeInTheDocument();
    });

    // The empty state should encourage the user to create their first account
    expect(
      screen.getByText('Add your first account to start tracking your finances.')
    ).toBeInTheDocument();

    // The empty state also includes an "Add your first account" button
    expect(
      screen.getByRole('button', { name: /add your first account/i })
    ).toBeInTheDocument();
  });

  it('shows error state when API returns 500', async () => {
    // Override handler to simulate server error
    // This tests that the error boundary in AccountsPage renders correctly
    server.use(
      http.get(`${API_BASE}/accounts`, () => {
        return HttpResponse.json(
          { detail: 'Internal server error' },
          { status: 500 }
        );
      })
    );

    renderFamilyAccountsPage();

    // Wait for the error alert to appear after the failed fetch
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Verify the error message contains a user-friendly prefix
    expect(screen.getByText(/failed to load accounts/i)).toBeInTheDocument();
  });

  it('renders the Add Account button in the page header', async () => {
    renderFamilyAccountsPage();

    // The Add Account button should be visible immediately (not dependent on data loading)
    const addButton = screen.getByRole('button', { name: /add account/i });
    expect(addButton).toBeInTheDocument();
  });

  it('opens Add Account modal when Add Account is clicked', async () => {
    const user = userEvent.setup();

    // The "Add Account" button now opens a modal dialog instead of navigating
    renderFamilyAccountsPage();

    // Click the header "Add Account" button
    const addButton = screen.getByRole('button', { name: /add account/i });
    await user.click(addButton);

    // Verify the modal dialog opened
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('displays the hint text below the grid when accounts exist', async () => {
    renderFamilyAccountsPage();

    // Wait for accounts to load so the grid renders
    await waitFor(() => {
      expect(screen.getByText('Account 1')).toBeInTheDocument();
    });

    // The hint text below the grid helps users discover click-to-detail
    expect(
      screen.getByText('Click on an account to view details and transactions')
    ).toBeInTheDocument();
  });
});

describe('Accounts Integration - All Accounts Page (Global View)', () => {
  beforeEach(() => {
    resetAccountStore();
    setupAuthenticatedUser(TENANT_ID);
  });

  /**
   * Helper to render AllAccountsPage within a matching route.
   * This page does not use :familyId param since it shows all user accounts.
   */
  function renderGlobalAccountsPage() {
    return renderWithProviders(
      <Routes>
        <Route path="/app/accounts" element={<AllAccountsPage />} />
      </Routes>,
      { initialEntries: ['/app/accounts'] }
    );
  }

  it('loads and displays all accounts across families', async () => {
    renderGlobalAccountsPage();

    // Page title should say "All My Accounts" to distinguish from family view
    expect(
      screen.getByRole('heading', { name: /all my accounts/i })
    ).toBeInTheDocument();

    // Wait for accounts to load from the API and render in AG Grid
    // AG Grid in the global view is always mounted (not conditionally rendered),
    // so we need a longer timeout for the grid to process rowData updates
    await waitFor(
      () => {
        expect(screen.getByText('Account 1')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Verify multiple accounts are displayed
    expect(screen.getByText('Account 2')).toBeInTheDocument();
  });

  it('shows error state when the API fails', async () => {
    // Override handler to return 500 for the global accounts fetch
    server.use(
      http.get(`${API_BASE}/accounts`, () => {
        return HttpResponse.json(
          { detail: 'Database connection failed' },
          { status: 500 }
        );
      })
    );

    renderGlobalAccountsPage();

    // AllAccountsPage renders error differently from AccountsPage
    // It shows "Error loading accounts:" prefix
    await waitFor(() => {
      expect(screen.getByText(/error loading accounts/i)).toBeInTheDocument();
    });
  });

  it('opens Add Account modal when Add Account is clicked', async () => {
    const user = userEvent.setup();

    // The "Add Account" button now opens a modal dialog instead of navigating
    renderGlobalAccountsPage();

    // Click the Add Account button in the global view header
    const addButton = screen.getByRole('button', { name: /add account/i });
    await user.click(addButton);

    // Verify the modal dialog opened
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});

describe('Accounts Integration - Icon and Color Pickers', () => {
  beforeEach(() => {
    resetAccountStore();
    setupAuthenticatedUser(TENANT_ID);
  });

  function renderFamilyAccountsPage() {
    return renderWithProviders(
      <Routes>
        <Route path="/app/:familyId/accounts" element={<AccountsPage />} />
      </Routes>,
      { initialEntries: [`/app/${TENANT_ID}/accounts`] }
    );
  }

  it('renders IconPicker and ColorSwatchPicker inside the Add Account modal', async () => {
    const user = userEvent.setup();

    renderFamilyAccountsPage();

    await user.click(screen.getByRole('button', { name: /add account/i }));

    // Wait for the modal to appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    // IconPicker renders Typography "Icon"; ColorSwatchPicker renders Typography "Color"
    expect(within(dialog).getByText('Icon')).toBeInTheDocument();
    expect(within(dialog).getByText('Color')).toBeInTheDocument();
  });

  it('includes icon and color in the API payload when submitting the Add Account form', async () => {
    const user = userEvent.setup();

    let capturedRequestBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/accounts`, async ({ request }) => {
        capturedRequestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({
          id: 'account-uuid-icon-test',
          name: capturedRequestBody.name as string,
          type: capturedRequestBody.type as string,
          currency: capturedRequestBody.currency as string,
          balance: capturedRequestBody.balance as string,
          icon: capturedRequestBody.icon ?? null,
          color: capturedRequestBody.color ?? null,
          tenant_id: TENANT_ID,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      })
    );

    renderFamilyAccountsPage();

    await user.click(screen.getByRole('button', { name: /add account/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');

    // Fill in required fields
    await user.type(within(dialog).getByLabelText(/account name/i), 'My Wallet');

    // Select a color swatch
    const firstColorSwatch = within(dialog).getByTitle('#F44336');
    await user.click(firstColorSwatch);

    await user.click(within(dialog).getByRole('button', { name: /add account/i }));

    await waitFor(() => {
      expect(capturedRequestBody).not.toBeNull();
    });

    expect(capturedRequestBody).toMatchObject({ name: 'My Wallet', color: '#F44336' });
  });
});
