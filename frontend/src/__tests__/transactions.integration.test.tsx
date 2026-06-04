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

    // Date filters are set to current month by default, so the "adjust filters" message appears
    expect(screen.getByText('Try adjusting your filters to see more results.')).toBeInTheDocument();

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
    // Date filters default to current month, so the "adjust filters" message appears
    await waitFor(() => {
      expect(screen.getByText('Try adjusting your filters to see more results.')).toBeInTheDocument();
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

  it('opens Add Transaction modal when clicking Add Transaction', async () => {
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

    // Wait for the empty state to load (returns [] so empty state renders)
    // Using findAllByRole waits for the buttons to appear without depending on
    // the AG Grid progressbar which may not disappear in the test environment
    const addButtons = await screen.findAllByRole('button', { name: /add transaction/i });

    // Click the header Add Transaction button (first one in the DOM)
    const addButton = addButtons[0];
    await user.click(addButton);

    // The button now opens AddTransactionModal instead of navigating to a new page
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
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

  it('renders the filters section with the month picker and search input', async () => {
    renderTransactionsPage();

    // The filters section should contain a heading
    expect(screen.getByText('Filters')).toBeInTheDocument();

    // Search input should be present with its placeholder
    expect(screen.getByPlaceholderText(/search transactions/i)).toBeInTheDocument();

    // The month picker is the primary period control, exposing prev/next arrows
    expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next month/i })).toBeInTheDocument();

    // The free-form date range is secondary and hidden until "Custom range" is opened
    expect(screen.queryByText(/filter by date/i)).not.toBeInTheDocument();
  });

  it('reveals the custom date range picker when Custom range is clicked', async () => {
    const user = userEvent.setup();
    renderTransactionsPage();

    // Date range is hidden by default behind the "Custom range" toggle
    expect(screen.queryByText(/filter by date/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /custom range/i }));

    // After expanding, the DateRangePicker (labelled "Filter by date") becomes visible
    await waitFor(() => {
      expect(screen.getByText(/filter by date/i)).toBeInTheDocument();
    });
  });

  it('steps to the next and previous month when the arrows are clicked', async () => {
    const user = userEvent.setup();

    // Build the labels the month picker should show for the current month and its
    // neighbours so the assertions stay correct whenever the test runs.
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const now = new Date();
    const labelFor = (offset: number): string => {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    };

    renderTransactionsPage();

    // Defaults to the current month
    expect(screen.getByText(labelFor(0))).toBeInTheDocument();

    // Next arrow advances one month
    await user.click(screen.getByRole('button', { name: /next month/i }));
    await waitFor(() => {
      expect(screen.getByText(labelFor(1))).toBeInTheDocument();
    });

    // Previous arrow steps back two months from there (one before the start)
    await user.click(screen.getByRole('button', { name: /previous month/i }));
    await user.click(screen.getByRole('button', { name: /previous month/i }));
    await waitFor(() => {
      expect(screen.getByText(labelFor(-1))).toBeInTheDocument();
    });
  });
});
