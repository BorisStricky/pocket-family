/**
 * Integration tests for the BudgetsPage
 *
 * Validates the full budget management workflow including:
 * - Displaying budgets in the AG Grid with name, amount, spent, progress, and category chips
 * - Loading, error, and empty states
 * - Creating a new budget via the modal form
 * - Editing an existing budget via the modal form
 * - Deleting a budget via the confirmation dialog
 * - Universal budgets displaying "All Categories" chip
 *
 * Uses MSW handlers from test/mocks/handlers/budgets.ts which provide
 * an in-memory store that persists across requests within a test.
 * The store is reset via resetBudgetStore() in beforeEach.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import { resetBudgetStore } from '@/test/mocks/server';
import { resetCategoryStore } from '@/test/mocks/server';
import { BudgetsPage } from '@/features/budgets/pages/BudgetsPage';

const API_BASE = 'http://localhost:8000';

// Default tenant ID matching setupAuthenticatedUser() and the mock budget store
const TENANT_ID = 'tenant-uuid-456';

// Route path matching the app's router configuration for family-scoped pages
const BUDGETS_ROUTE = `/app/${TENANT_ID}/budgets`;

/**
 * Helper to render BudgetsPage inside a Route that defines :familyId
 * This is necessary because BudgetsPage uses useParams<{ familyId: string }>()
 * and MemoryRouter alone does not parse route params without a matching Route definition.
 */
function renderBudgetsPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/app/:familyId/budgets" element={<BudgetsPage />} />
    </Routes>,
    { initialEntries: [BUDGETS_ROUTE] }
  );
}

describe('BudgetsPage Integration', () => {
  beforeEach(() => {
    // Set up authenticated user as owner so the role-gated "Add Budget" button renders
    setupAuthenticatedUser(TENANT_ID, 'owner');

    // Reset in-memory stores to known state for test isolation
    resetBudgetStore();
    resetCategoryStore();
  });

  it('displays the page heading and Add Budget button', async () => {
    renderBudgetsPage();

    // Page heading should render immediately (not dependent on API response)
    expect(screen.getByRole('heading', { name: /budgets/i })).toBeInTheDocument();

    // Add Budget button should always be visible in the header
    expect(screen.getByRole('button', { name: /add budget/i })).toBeInTheDocument();
  });

  it('shows loading state while fetching budgets', () => {
    // Delay the API response so we can observe the loading spinner
    server.use(
      http.get(`${API_BASE}/budgets`, async ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        // Delay response to keep loading state visible during assertion
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return HttpResponse.json([]);
      })
    );

    renderBudgetsPage();

    // CircularProgress renders with role="progressbar" in MUI
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays budgets in the grid after successful API load', async () => {
    renderBudgetsPage();

    // Wait for the AG Grid to render with budget data
    // AG Grid renders asynchronously, so we must waitFor grid content
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });

    // Verify other budgets from the default store are also displayed
    expect(screen.getByText('Food & Groceries')).toBeInTheDocument();
    expect(screen.getByText('Total Spending')).toBeInTheDocument();
  });

  it('displays category chips on budget items', async () => {
    renderBudgetsPage();

    // Wait for budget data to load in the grid
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });

    // Budgets with categories should display category name chips
    // The default store has categories from createMockCategoryList(5)
    // which produces "Expense Category 1", "Income Category 2", etc.
    expect(screen.getByText('Expense Category 1')).toBeInTheDocument();
  });

  it('displays "All Categories" chip for universal budgets', async () => {
    renderBudgetsPage();

    // Wait for budget data to load in the grid
    await waitFor(() => {
      expect(screen.getByText('Total Spending')).toBeInTheDocument();
    });

    // The "Total Spending" budget has no categories (universal budget)
    // and should display an "All Categories" chip
    expect(screen.getByText('All Categories')).toBeInTheDocument();
  });

  it('shows error state when the API returns a server error', async () => {
    // Override the budgets handler to simulate a 500 Internal Server Error
    server.use(
      http.get(`${API_BASE}/budgets`, ({ request }) => {
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

    renderBudgetsPage();

    // Wait for the error alert to appear after the failed API call
    await waitFor(() => {
      expect(screen.getByText(/error loading budgets/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no budgets exist', async () => {
    // Override handler to return an empty array (no budgets for this tenant)
    server.use(
      http.get(`${API_BASE}/budgets`, ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        return HttpResponse.json([]);
      })
    );

    renderBudgetsPage();

    // Wait for the empty state message to appear
    await waitFor(() => {
      expect(screen.getByText('No budgets yet')).toBeInTheDocument();
    });

    // Empty state should include helpful guidance text
    expect(screen.getByText(/create your first budget/i)).toBeInTheDocument();

    // Empty state includes its own "Add Budget" button for convenience
    // There are two: one in the header and one in the empty state panel
    const addButtons = screen.getAllByRole('button', { name: /add budget/i });
    expect(addButtons.length).toBe(2);
  });

  it('opens create budget modal when clicking Add Budget', async () => {
    const user = userEvent.setup({ delay: null });

    renderBudgetsPage();

    // Wait for page to finish loading before interacting
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });

    // Click the "Add Budget" button in the page header
    await user.click(screen.getByRole('button', { name: /add budget/i }));

    // The create budget dialog should appear with the "Create Budget" title
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Create Budget')).toBeInTheDocument();

    // Form fields should be present and empty for creation
    expect(within(dialog).getByLabelText(/name/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/amount/i)).toBeInTheDocument();

    // Submit button should say "Create" in create mode
    expect(within(dialog).getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('creates a new budget via the form and shows it in the list', async () => {
    const user = userEvent.setup({ delay: null });

    renderBudgetsPage();

    // Wait for existing budgets to load
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });

    // Open the create budget modal
    await user.click(screen.getByRole('button', { name: /add budget/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');

    // Fill in the budget name
    const nameInput = within(dialog).getByLabelText(/name/i);
    await user.type(nameInput, 'New Test Budget');

    // Fill in the budget amount
    const amountInput = within(dialog).getByLabelText(/amount/i);
    await user.type(amountInput, '750');

    // Submit the form by clicking the Create button
    await user.click(within(dialog).getByRole('button', { name: /create/i }));

    // After successful creation, the dialog should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // The new budget should appear in the grid after the query refetch
    await waitFor(() => {
      expect(screen.getByText('New Test Budget')).toBeInTheDocument();
    });
  });

  it('opens edit budget modal with pre-populated data when clicking edit', async () => {
    const user = userEvent.setup({ delay: null });

    renderBudgetsPage();

    // Wait for budget data to load in the grid
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });

    // Click the edit button for "Monthly Entertainment" budget
    // The edit button has an aria-label "Edit budget Monthly Entertainment"
    const editButton = screen.getByRole('button', { name: /edit budget monthly entertainment/i });
    await user.click(editButton);

    // The edit dialog should appear with "Edit Budget" title
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Edit Budget')).toBeInTheDocument();

    // Name field should be pre-populated with the existing budget name
    const nameInput = within(dialog).getByLabelText(/name/i);
    expect(nameInput).toHaveValue('Monthly Entertainment');

    // Amount field should be pre-populated with the existing budget amount
    const amountInput = within(dialog).getByLabelText(/amount/i);
    expect(amountInput).toHaveValue(500);

    // Submit button should say "Save" in edit mode
    expect(within(dialog).getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('edits a budget and shows updated data in the list', async () => {
    const user = userEvent.setup({ delay: null });

    renderBudgetsPage();

    // Wait for budget data to load
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });

    // Click the edit button for "Monthly Entertainment"
    const editButton = screen.getByRole('button', { name: /edit budget monthly entertainment/i });
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');

    // Clear the name field and type a new name
    const nameInput = within(dialog).getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Entertainment');

    // Submit the edit form
    await user.click(within(dialog).getByRole('button', { name: /save/i }));

    // Dialog should close after successful update
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // The updated budget name should appear in the grid after refetch
    await waitFor(() => {
      expect(screen.getByText('Updated Entertainment')).toBeInTheDocument();
    });
  });

  it('opens delete confirmation when clicking delete button', async () => {
    const user = userEvent.setup({ delay: null });

    renderBudgetsPage();

    // Wait for budget data to load
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });

    // Click the delete button for "Monthly Entertainment" budget
    const deleteButton = screen.getByRole('button', { name: /delete budget monthly entertainment/i });
    await user.click(deleteButton);

    // The delete confirmation dialog should appear
    await waitFor(() => {
      // Find the dialog with "Delete Budget" title
      expect(screen.getByText('Delete Budget')).toBeInTheDocument();
    });

    // Dialog content should mention the budget name so user knows what they are deleting
    // Use getAllByText because the name also appears in the grid row behind the dialog
    const matchingElements = screen.getAllByText(/monthly entertainment/i);
    expect(matchingElements.length).toBeGreaterThanOrEqual(2);

    // Both Cancel and Delete buttons should be present
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete$/i })).toBeInTheDocument();
  });

  it('deletes a budget after confirming and removes it from the list', async () => {
    const user = userEvent.setup({ delay: null });

    renderBudgetsPage();

    // Wait for budget data to load
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });

    // Click the delete button for "Monthly Entertainment"
    const deleteButton = screen.getByRole('button', { name: /delete budget monthly entertainment/i });
    await user.click(deleteButton);

    // Wait for the confirmation dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Delete Budget')).toBeInTheDocument();
    });

    // Confirm the deletion by clicking the "Delete" button in the dialog
    const confirmDeleteButton = screen.getByRole('button', { name: /^delete$/i });
    await user.click(confirmDeleteButton);

    // After successful deletion, the dialog should close
    await waitFor(() => {
      // The "Delete Budget" title from the dialog should disappear
      expect(screen.queryByText('Delete Budget')).not.toBeInTheDocument();
    });

    // The deleted budget should no longer appear in the grid after refetch
    await waitFor(() => {
      expect(screen.queryByText('Monthly Entertainment')).not.toBeInTheDocument();
    });

    // Other budgets should still be present
    expect(screen.getByText('Food & Groceries')).toBeInTheDocument();
    expect(screen.getByText('Total Spending')).toBeInTheDocument();
  });

  it('cancels delete confirmation without removing the budget', async () => {
    const user = userEvent.setup({ delay: null });

    renderBudgetsPage();

    // Wait for budget data to load
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });

    // Click the delete button for "Monthly Entertainment"
    const deleteButton = screen.getByRole('button', { name: /delete budget monthly entertainment/i });
    await user.click(deleteButton);

    // Wait for the confirmation dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Delete Budget')).toBeInTheDocument();
    });

    // Click Cancel instead of Delete
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('Delete Budget')).not.toBeInTheDocument();
    });

    // The budget should still be in the list (not deleted)
    expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
  });

  it('closes create modal when clicking Cancel', async () => {
    const user = userEvent.setup({ delay: null });

    renderBudgetsPage();

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });

    // Open the create budget modal
    await user.click(screen.getByRole('button', { name: /add budget/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click the Cancel button to close the modal without creating
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
