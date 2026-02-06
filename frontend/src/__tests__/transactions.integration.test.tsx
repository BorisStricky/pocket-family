/**
 * Integration tests for the Transactions feature (TransactionsPage)
 *
 * Validates the main transactions list page behavior including:
 * - Loading transactions from the API and displaying them in AG Grid
 * - Loading, error, and empty states
 * - Search filtering with debounced API calls
 * - Navigation to add/detail pages
 * - Empty state messaging based on active filters vs. no data
 *
 * These tests use MSW to mock the GET /transactions endpoint and
 * render TransactionsPage inside a Route with :familyId param so
 * useParams can extract the tenant ID from the URL.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import { resetTransactionStore } from '@/test/mocks/server';
import { TransactionsPage } from '@/features/transactions/pages';

const API_BASE = 'http://localhost:8000';

// Default tenant ID matching setupAuthenticatedUser() and the mock transaction store
const TENANT_ID = 'tenant-uuid-456';

// Route path matching the app's router configuration for family-scoped pages
const TRANSACTIONS_ROUTE = `/app/${TENANT_ID}/transactions`;

/**
 * Helper to render TransactionsPage inside a Route that defines :familyId
 * This is necessary because TransactionsPage uses useParams<{ familyId: string }>()
 * and MemoryRouter alone does not parse route params without a matching Route definition
 */
function renderTransactionsPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/app/:familyId/transactions" element={<TransactionsPage />} />
    </Routes>,
    { initialEntries: [TRANSACTIONS_ROUTE] }
  );
}

describe('TransactionsPage Integration', () => {
  beforeEach(() => {
    // Set up authenticated user so API calls include Authorization header
    // Without this, the MSW handler returns 401
    setupAuthenticatedUser(TENANT_ID);

    // Reset the in-memory transaction store to 10 fresh transactions
    // This ensures each test starts with a known dataset
    resetTransactionStore();
  });

  it('displays the page heading and Add Transaction button', async () => {
    renderTransactionsPage();

    // Page heading should always render immediately (not dependent on API)
    expect(screen.getByRole('heading', { name: /transactions/i })).toBeInTheDocument();

    // Add Transaction button should be visible at all times
    expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
  });

  it('shows loading state while fetching transactions', () => {
    // Delay the API response so we can observe the loading spinner
    // Without this, the response resolves too quickly in the test environment
    server.use(
      http.get(`${API_BASE}/transactions`, async ({ request }) => {
        // Check auth header to match the real handler behavior
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }

        // Delay response to keep loading state visible
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return HttpResponse.json([]);
      })
    );

    renderTransactionsPage();

    // CircularProgress renders with role="progressbar" in MUI
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays transactions after successful API load', async () => {
    renderTransactionsPage();

    // Wait for loading to finish -- the grid should appear once data loads
    // AG Grid renders with role="grid" which confirms the table is mounted
    await waitFor(() => {
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    // The loading spinner should be gone after data loads
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows error state when the API returns a server error', async () => {
    // Override the transactions handler to simulate a 500 Internal Server Error
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        return HttpResponse.json(
          { detail: 'Internal server error' },
          { status: 500 }
        );
      })
    );

    renderTransactionsPage();

    // Wait for the error message to appear after the failed API call
    await waitFor(() => {
      expect(screen.getByText(/error loading transactions/i)).toBeInTheDocument();
    });

    // The grid should NOT render when there is an error
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('shows empty state when no transactions exist', async () => {
    // Override handler to return an empty array (no transactions for this tenant)
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        return HttpResponse.json([]);
      })
    );

    renderTransactionsPage();

    // Wait for the empty state message to appear
    await waitFor(() => {
      expect(screen.getByText('No transactions found')).toBeInTheDocument();
    });

    // When there are no active filters, show the "get started" message
    // This encourages the user to create their first transaction
    expect(screen.getByText('Get started by adding your first transaction.')).toBeInTheDocument();

    // The empty state also includes an Add Transaction button for convenience
    // There are two: one in the header and one in the empty state
    const addButtons = screen.getAllByRole('button', { name: /add transaction/i });
    expect(addButtons.length).toBe(2);
  });

  it('shows "try adjusting filters" message when empty with active search', async () => {
    const user = userEvent.setup();

    // Override handler to return empty results regardless of search term
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        return HttpResponse.json([]);
      })
    );

    renderTransactionsPage();

    // Wait for initial empty load to complete before typing
    // At this point the empty state shows "Get started by adding your first transaction."
    await waitFor(() => {
      expect(screen.getByText('Get started by adding your first transaction.')).toBeInTheDocument();
    });

    // Type a single character to activate the search filter
    // localSearchQuery updates immediately (before debounce fires), so the conditional
    // message text switches from "Get started" to "Try adjusting" right away.
    // Using a single character minimizes the time window and avoids debounce race conditions.
    const searchInput = screen.getByPlaceholderText(/search transactions/i);
    await user.type(searchInput, 'x');

    // The empty state checks localSearchQuery (not the debounced value),
    // so the message text changes immediately after typing
    await waitFor(() => {
      expect(screen.getByText('Try adjusting your filters to see more results.')).toBeInTheDocument();
    });
  });

  it('navigates to the add transaction page when clicking Add Transaction', async () => {
    const user = userEvent.setup();

    // Override handler to return empty array for simpler DOM
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        return HttpResponse.json([]);
      })
    );

    renderTransactionsPage();

    // Wait for page to finish loading before clicking
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Click the header Add Transaction button (first one in the DOM)
    const addButton = screen.getAllByRole('button', { name: /add transaction/i })[0];
    await user.click(addButton);

    // After clicking, the router should navigate to /app/{familyId}/transactions/new
    // Since we're in MemoryRouter, the TransactionsPage will unmount and the route
    // won't match our Route definition anymore, so the page content disappears
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /transactions/i })).not.toBeInTheDocument();
    });
  });

  it('sends search parameter to API after debounce delay', async () => {
    // Use fake timers to control the 500ms debounce precisely
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Track API calls to verify the search parameter is sent
    let capturedSearchParameter: string | null = null;
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        const url = new URL(request.url);
        capturedSearchParameter = url.searchParams.get('search');
        return HttpResponse.json([]);
      })
    );

    renderTransactionsPage();

    // Wait for initial load to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Reset the captured parameter after initial load
    capturedSearchParameter = null;

    // Type a search term -- this updates localSearchQuery immediately
    // but the debounced API call won't fire until 500ms after the last keystroke
    const searchInput = screen.getByPlaceholderText(/search transactions/i);
    await user.type(searchInput, 'grocery');

    // Advance timers past the 500ms debounce window
    vi.advanceTimersByTime(600);

    // Verify the API was called with the search parameter
    await waitFor(() => {
      expect(capturedSearchParameter).toBe('grocery');
    });

    // Restore real timers so subsequent tests aren't affected
    vi.useRealTimers();
  });

  // Skipped: AG Grid row click navigation
  // AG Grid in jsdom does not reliably render interactive row elements
  // that can be clicked via userEvent. Row click behavior is better tested
  // via the onRowClick prop in a unit test of AgTransactionsGrid, or
  // in an end-to-end test with a real browser (Playwright/Cypress).

  it('renders the filters section with date picker and search input', async () => {
    renderTransactionsPage();

    // The filters section should contain a heading
    expect(screen.getByText('Filters')).toBeInTheDocument();

    // Search input should be present with its placeholder
    expect(screen.getByPlaceholderText(/search transactions/i)).toBeInTheDocument();

    // DateRangePicker renders with "Filter by date" label
    expect(screen.getByText(/filter by date/i)).toBeInTheDocument();
  });
});
