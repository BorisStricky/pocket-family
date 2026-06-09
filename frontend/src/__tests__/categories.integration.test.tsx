/**
 * Integration tests for Categories feature within the Settings page
 *
 * Validates the full categories management workflow including:
 * - Settings page rendering with Categories tab
 * - CategoryTree displaying expense and income sections
 * - Specific category names appearing in the tree
 * - Add category modal opening and form submission
 * - Delete category confirmation dialog
 * - Empty state when no categories exist
 *
 * Uses MSW handlers from test/mocks/handlers/categories.ts which provide
 * an in-memory category store that persists across requests within a test.
 * The store is reset via resetCategoryStore() in beforeEach.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import { resetCategoryStore } from '@/test/mocks/server';
import { SettingsPage } from '@/features/settings/pages';

const API_BASE = 'http://localhost:8000';

// Tenant ID must match the one used in setupAuthenticatedUser and the MSW category store
const TEST_TENANT_ID = 'tenant-uuid-456';

/**
 * Helper to render SettingsPage with the correct route structure.
 * SettingsPage uses useParams to extract familyId from the URL,
 * so we must wrap it in a Routes/Route to provide that param.
 */
function renderSettingsPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/app/:familyId/settings" element={<SettingsPage />} />
    </Routes>,
    { initialEntries: [`/app/${TEST_TENANT_ID}/settings`] }
  );
}

describe('Categories Integration - Settings Page', () => {
  beforeEach(() => {
    // Clear auth state and reset MSW category store for test isolation
    localStorage.clear();
    resetCategoryStore();

    // Set up authenticated user so API requests include Authorization header
    setupAuthenticatedUser(TEST_TENANT_ID);

    // Add a transaction-count handler since the default MSW handlers don't include one.
    // SettingsPage uses useCategoryTransactionCount which calls GET /categories/:id/transaction-count.
    // Without this handler, requests would fail with "unhandled request" errors.
    server.use(
      http.get(`${API_BASE}/categories/:categoryId/transaction-count`, () => {
        return HttpResponse.json(0);
      })
    );
  });

  it('renders Settings page with Categories tab visible', async () => {
    renderSettingsPage();

    // Wait for categories to load (loading spinner disappears and content renders)
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // The Categories tab should be present in the tabs navigation
    expect(screen.getByRole('tab', { name: /categories/i })).toBeInTheDocument();

    // Categories tab should be selected by default (activeTab starts as 'categories')
    expect(screen.getByRole('tab', { name: /categories/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('displays expense and income section headers in the category tree', async () => {
    renderSettingsPage();

    // Wait for both section headers to appear after categories load from MSW
    await waitFor(() => {
      expect(screen.getByText('Expenses')).toBeInTheDocument();
    });

    expect(screen.getByText('Income')).toBeInTheDocument();
  });

  it('shows category names from the mock data in the tree', async () => {
    renderSettingsPage();

    // The default mock store from createMockCategoryList(5) creates categories like:
    // "Expense Category 1", "Income Category 2", "Expense Category 3", etc.
    // Wait for at least one category name to confirm data loaded into the tree
    await waitFor(() => {
      expect(screen.getByText('Expense Category 1')).toBeInTheDocument();
    });

    // Verify income categories also render
    expect(screen.getByText('Income Category 2')).toBeInTheDocument();
  });

  it('opens the Add Category modal when clicking the Add Category button', async () => {
    const user = userEvent.setup();

    renderSettingsPage();

    // Wait for categories to load so the page is fully rendered
    await waitFor(() => {
      expect(screen.getByText('Expenses')).toBeInTheDocument();
    });

    // The header "Add Category" button is a MUI Button with startIcon.
    // We target it specifically to avoid matching the section-level add buttons
    // which have aria-labels like "Add expense category".
    const addCategoryButton = screen.getByRole('button', { name: 'Add Category' });
    await user.click(addCategoryButton);

    // The modal dialog should appear with form fields for creating a category
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Verify form elements are present inside the dialog
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/category name/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /create category/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('submits a new category via the modal form', async () => {
    // Use userEvent with a lower delay to speed up character-by-character typing
    // Default delay is 0 when not specified, but explicit for clarity
    const user = userEvent.setup();

    // Track whether the POST /categories endpoint was called with correct data
    let capturedRequestBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/categories`, async ({ request }) => {
        capturedRequestBody = await request.json() as Record<string, unknown>;

        // Return a successful response matching the CategoryRead shape
        return HttpResponse.json({
          id: 'category-uuid-new-test',
          tenant_id: TEST_TENANT_ID,
          name: capturedRequestBody.name,
          kind: capturedRequestBody.kind,
          parent_id: null,
          parent_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { status: 201 });
      })
    );

    renderSettingsPage();

    // Wait for initial category data to load
    await waitFor(() => {
      expect(screen.getByText('Expenses')).toBeInTheDocument();
    });

    // Open the Add Category modal via the header button
    await user.click(screen.getByRole('button', { name: 'Add Category' }));

    // Wait for the dialog to open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');

    // Type a short name to minimize typing delay in the test environment.
    // Each keystroke triggers onChange + re-render, so shorter names run faster.
    const nameInput = within(dialog).getByLabelText(/category name/i);
    await user.type(nameInput, 'Gas');

    // The "Create Category" button should be enabled now that name is filled
    const createButton = within(dialog).getByRole('button', { name: /create category/i });
    expect(createButton).not.toBeDisabled();

    // Submit the form by clicking "Create Category"
    await user.click(createButton);

    // Verify the API was called with correct category data
    // The POST body should contain the name and kind from the form
    await waitFor(() => {
      expect(capturedRequestBody).not.toBeNull();
    });

    expect(capturedRequestBody).toMatchObject({
      name: 'Gas',
      kind: 'expense',
    });
  });

  it('shows the delete confirmation dialog when clicking delete on a category', async () => {
    const user = userEvent.setup();

    renderSettingsPage();

    // Wait for categories to fully render in the tree
    await waitFor(() => {
      expect(screen.getByText('Expense Category 1')).toBeInTheDocument();
    });

    // Category action buttons (edit, delete, add child) are hidden by default
    // and shown on hover via CSS opacity. However, they are still in the DOM
    // and clickable, so we can target them directly by aria-label.
    const deleteButtons = screen.getAllByRole('button', { name: /delete category/i });

    // Click the first delete button (for the first category in the tree)
    await user.click(deleteButtons[0]);

    // The delete confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/delete category/i)).toBeInTheDocument();
    });

    // Dialog should show the category name being deleted and confirm/cancel buttons
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows empty state message when there are no categories', async () => {
    // Override the categories handler to return an empty array
    // This simulates a new tenant with no categories configured yet
    server.use(
      http.get(`${API_BASE}/categories`, () => {
        return HttpResponse.json([]);
      })
    );

    renderSettingsPage();

    // The CategoryTree component renders a specific empty state message
    await waitFor(() => {
      expect(screen.getByText('No categories yet')).toBeInTheDocument();
    });

    // The empty state also shows helper text encouraging the user to add categories
    expect(
      screen.getByText(/add your first category to start organizing transactions/i)
    ).toBeInTheDocument();
  });

  it('renders IconPicker and ColorSwatchPicker inside AddCategoryModal', async () => {
    const user = userEvent.setup();

    renderSettingsPage();

    // Wait for categories to load before opening the modal
    await waitFor(() => {
      expect(screen.getByText('Expenses')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Add Category' }));

    // The modal must contain both picker labels rendered by IconPicker and ColorSwatchPicker
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    // IconPicker renders a Typography label "Icon"; ColorSwatchPicker renders "Color"
    expect(within(dialog).getByText('Icon')).toBeInTheDocument();
    expect(within(dialog).getByText('Color')).toBeInTheDocument();
  });

  it('sends icon and color in the API payload when submitting AddCategoryModal', async () => {
    const user = userEvent.setup();

    let capturedRequestBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/categories`, async ({ request }) => {
        capturedRequestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({
          id: 'category-uuid-icon-test',
          tenant_id: TEST_TENANT_ID,
          name: capturedRequestBody.name as string,
          kind: capturedRequestBody.kind as string,
          parent_id: null,
          parent_name: null,
          icon: capturedRequestBody.icon ?? null,
          color: capturedRequestBody.color ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { status: 201 });
      })
    );

    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText('Expenses')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Add Category' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');

    // Fill in the category name (required field)
    await user.type(within(dialog).getByLabelText(/category name/i), 'Gas');

    // Click the first color swatch (tooltip "No color" is the "None" option;
    // the first real color swatch has tooltip "#F44336" per SWATCH_COLORS)
    const firstColorSwatch = within(dialog).getByTitle('#F44336');
    await user.click(firstColorSwatch);

    await user.click(within(dialog).getByRole('button', { name: /create category/i }));

    // The form submission should include color in the payload
    await waitFor(() => {
      expect(capturedRequestBody).not.toBeNull();
    });

    expect(capturedRequestBody).toMatchObject({ name: 'Gas', color: '#F44336' });
  });
});
