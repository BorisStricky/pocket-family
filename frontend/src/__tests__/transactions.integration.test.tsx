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
import { screen, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server, createMockExpenseCategory } from '@/test/utils';
import { resetTransactionStore, resetAccountStore, resetCategoryStore } from '@/test/mocks/server';
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

describe('Inline create flows in Add Transaction modal', () => {
  beforeEach(() => {
    setupAuthenticatedUser(TENANT_ID);
    resetTransactionStore();
    resetAccountStore();
    resetCategoryStore();
    // Return empty list so the page renders quickly without grid data
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
        if (!request.headers.get('Authorization')) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        return HttpResponse.json([]);
      })
    );
  });

  it('shows the category creation sentinel in the Category dropdown and opens AddCategoryModal on top of the form', async () => {
    const user = userEvent.setup();

    // Single known expense category so the autocomplete loads with predictable options
    server.use(
      http.get(`${API_BASE}/categories`, ({ request }) => {
        if (!request.headers.get('Authorization')) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        return HttpResponse.json([
          createMockExpenseCategory({ id: 'cat-food', name: 'Food' }),
        ]);
      })
    );

    renderTransactionsPage();

    // Open the Add Transaction modal
    const addButtons = await screen.findAllByRole('button', { name: /add transaction/i });
    await user.click(addButtons[0]);
    await screen.findByRole('dialog');

    // Wait for the CategorySelect to appear — TransactionForm shows a spinner while
    // isLoadingCategories is true. Use getByRole('combobox') because MUI Autocomplete
    // associates the input with its label via aria-labelledby, not htmlFor.
    const categoryInput = await screen.findByRole('combobox', { name: /category/i });

    // Click to open the Autocomplete dropdown
    await user.click(categoryInput);

    // The sentinel option is always appended at the bottom when onCreateNew is provided
    const sentinel = await screen.findByRole('option', { name: /create new category/i });
    expect(sentinel).toBeInTheDocument();

    // Clicking the sentinel calls onCreateNew and sets addCategoryModalOpen = true
    await user.click(sentinel);

    // AddCategoryModal has aria-labelledby="add-category-dialog-title" so it is
    // findable by accessible name; it renders on top of the transaction dialog
    const categoryModal = await screen.findByRole('dialog', { name: /add category/i });
    expect(categoryModal).toBeInTheDocument();

    // Fill in the new category name
    const nameInput = within(categoryModal).getByRole('textbox', { name: /category name/i });
    await user.type(nameInput, 'Groceries');

    // Submit — MSW POST /categories returns the new category; onSuccess closes the modal
    await user.click(within(categoryModal).getByRole('button', { name: /create category/i }));

    // AddCategoryModal closes after successful creation
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /add category/i })).not.toBeInTheDocument();
    });

    // The Add Transaction dialog remains open — form context and other fields preserved
    expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeInTheDocument();
    // This flow drives nested MUI dialogs + an Autocomplete and takes ~14s even in
    // isolation, so give it a 60s budget (vs the 30s global) to stay safe under load.
  }, 60000);

  it('shows the account creation sentinel in the Account dropdown and opens AddAccountModal on top of the form', async () => {
    const user = userEvent.setup();
    renderTransactionsPage();

    // Open the Add Transaction modal
    const addButtons = await screen.findAllByRole('button', { name: /add transaction/i });
    await user.click(addButtons[0]);
    const transactionDialog = await screen.findByRole('dialog');

    // Locate the Account MUI Select by walking from its InputLabel text to the combobox.
    // MUI renders InputLabel twice (floating label + legend shrink), both inside the same
    // MuiFormControl-root, so we walk up from the first match.
    const accountLabels = within(transactionDialog).getAllByText('Account');
    const accountFormControl = accountLabels[0].closest('.MuiFormControl-root')!;
    const accountCombobox = accountFormControl.querySelector('[role="combobox"]') as HTMLElement;
    await user.click(accountCombobox);

    // The "Create new account" sentinel is the last option in the MUI Select listbox
    const listbox = await screen.findByRole('listbox');
    const sentinel = within(listbox).getByRole('option', { name: /create new account/i });
    await user.click(sentinel);

    // AddAccountModal opens — AddAccountModal does not set aria-labelledby so we
    // find it via its DialogTitle which MUI renders as an <h2>
    const accountModalHeading = await screen.findByRole('heading', { name: 'Add Account' });
    const accountModal = accountModalHeading.closest('[role="dialog"]') as HTMLElement;
    expect(accountModal).toBeInTheDocument();

    // Fill in the required account name field
    const accountNameInput = within(accountModal).getByRole('textbox', { name: /account name/i });
    await user.type(accountNameInput, 'My Savings Account');

    // Submit — MSW POST /accounts returns the new account; onCreated sets account_id in the form
    // AccountForm submit button says "Create Account" in create mode
    await user.click(within(accountModal).getByRole('button', { name: /create account/i }));

    // AddAccountModal closes after successful creation
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Add Account' })).not.toBeInTheDocument();
    });

    // The Add Transaction dialog remains open
    expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeInTheDocument();
  });
});
