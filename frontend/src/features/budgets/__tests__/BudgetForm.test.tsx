/**
 * Integration tests for the BudgetForm modal component
 *
 * Validates the budget create/edit form behavior including:
 * - Form validation (required name, amount must be > 0)
 * - Multi-select category field (select/deselect categories via Autocomplete)
 * - Submit button text changes between create and edit modes
 * - Pre-populating fields in edit mode from existing budget data
 * - Currency dropdown defaults to BRL
 *
 * These tests render BudgetForm inside a page-level context (BudgetsPage)
 * to ensure the form works correctly with React Query, routing, and MSW handlers.
 * This follows the integration-first approach: we interact with the form as a
 * user would, through the full BudgetsPage, not by rendering BudgetForm in isolation.
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

// Default tenant ID matching setupAuthenticatedUser() and the mock stores
const TENANT_ID = 'tenant-uuid-456';

// Route path matching the app's router configuration for family-scoped pages
const BUDGETS_ROUTE = `/app/${TENANT_ID}/budgets`;

/**
 * Helper to render BudgetsPage inside a Route that defines :familyId
 */
function renderBudgetsPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/app/:familyId/budgets" element={<BudgetsPage />} />
    </Routes>,
    { initialEntries: [BUDGETS_ROUTE] }
  );
}

/**
 * Helper to open the create budget form modal from the BudgetsPage
 * Waits for the page to load, clicks the Add Budget button, and waits for the dialog.
 * Returns a userEvent instance for chaining further interactions.
 */
async function openCreateBudgetForm() {
  const user = userEvent.setup({ delay: null });

  renderBudgetsPage();

  // Wait for budgets to load by checking for known budget name from the default store
  // We wait for actual content instead of absence of progressbar because
  // MUI Autocomplete inside the form also renders a progressbar while loading categories
  await waitFor(() => {
    expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
  });

  // Click the "Add Budget" button to open the create modal
  await user.click(screen.getByRole('button', { name: /add budget/i }));

  // Wait for the dialog to appear
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  return user;
}

/**
 * Helper to open the edit form for a specific budget by clicking its edit button
 * Waits for the page to load, clicks the edit button, and waits for the dialog.
 */
async function openEditBudgetForm(budgetName: string) {
  const user = userEvent.setup({ delay: null });

  renderBudgetsPage();

  // Wait for budget data to load in the grid
  await waitFor(() => {
    expect(screen.getByText(budgetName)).toBeInTheDocument();
  });

  // Click the edit button for the specified budget
  const editButton = screen.getByRole('button', {
    name: new RegExp(`edit budget ${budgetName}`, 'i'),
  });
  await user.click(editButton);

  // Wait for the edit dialog to appear
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  return user;
}

describe('BudgetForm Integration', () => {
  beforeEach(() => {
    // Set up authenticated user as owner so the role-gated "Add Budget" button renders
    setupAuthenticatedUser(TENANT_ID, 'owner');
    resetBudgetStore();
    resetCategoryStore();
  });

  describe('Create Mode', () => {
    it('shows "Create Budget" title and "Create" submit button', async () => {
      await openCreateBudgetForm();

      const dialog = screen.getByRole('dialog');

      // Title should indicate creation mode
      expect(within(dialog).getByText('Create Budget')).toBeInTheDocument();

      // Submit button text should be "Create" in create mode
      expect(within(dialog).getByRole('button', { name: /create/i })).toBeInTheDocument();
    });

    it('starts with empty name and amount fields', async () => {
      await openCreateBudgetForm();

      const dialog = screen.getByRole('dialog');

      // Name field should be empty
      const nameInput = within(dialog).getByLabelText(/name/i);
      expect(nameInput).toHaveValue('');

      // Amount field should be empty
      const amountInput = within(dialog).getByLabelText(/amount/i);
      expect(amountInput).toHaveValue(null);
    });

    it('defaults currency to BRL', async () => {
      await openCreateBudgetForm();

      const dialog = screen.getByRole('dialog');

      // Currency dropdown should default to "BRL"
      // MUI Select renders the selected value as text content within the select trigger
      expect(within(dialog).getByText('BRL')).toBeInTheDocument();
    });

    it('shows validation error when submitting without a name', async () => {
      const user = await openCreateBudgetForm();

      const dialog = screen.getByRole('dialog');

      // Fill in only the amount, leave name empty
      const amountInput = within(dialog).getByLabelText(/amount/i);
      await user.type(amountInput, '500');

      // Try to submit the form
      await user.click(within(dialog).getByRole('button', { name: /create/i }));

      // Validation error should appear for the name field
      await waitFor(() => {
        expect(within(dialog).getByText(/budget name is required/i)).toBeInTheDocument();
      });

      // Dialog should remain open because form submission was blocked
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows validation error when submitting without an amount', async () => {
      const user = await openCreateBudgetForm();

      const dialog = screen.getByRole('dialog');

      // Fill in only the name, leave amount empty
      const nameInput = within(dialog).getByLabelText(/name/i);
      await user.type(nameInput, 'Test Budget');

      // Try to submit the form
      await user.click(within(dialog).getByRole('button', { name: /create/i }));

      // Validation error should appear for the amount field
      await waitFor(() => {
        expect(within(dialog).getByText(/amount is required/i)).toBeInTheDocument();
      });

      // Dialog should remain open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows categories helper text about universal budget', async () => {
      await openCreateBudgetForm();

      const dialog = screen.getByRole('dialog');

      // The categories field should show helper text explaining universal budgets
      expect(within(dialog).getByText(/leave empty to track all tenant spending/i)).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('shows "Edit Budget" title and "Save" submit button', async () => {
      await openEditBudgetForm('Monthly Entertainment');

      const dialog = screen.getByRole('dialog');

      // Title should indicate edit mode
      expect(within(dialog).getByText('Edit Budget')).toBeInTheDocument();

      // Submit button text should be "Save" in edit mode
      expect(within(dialog).getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('pre-populates name and amount from existing budget', async () => {
      await openEditBudgetForm('Monthly Entertainment');

      const dialog = screen.getByRole('dialog');

      // Name should be pre-populated with the existing budget name
      const nameInput = within(dialog).getByLabelText(/name/i);
      expect(nameInput).toHaveValue('Monthly Entertainment');

      // Amount should be pre-populated with the existing budget amount (500)
      const amountInput = within(dialog).getByLabelText(/amount/i);
      expect(amountInput).toHaveValue(500);
    });

    it('pre-populates currency from existing budget', async () => {
      await openEditBudgetForm('Monthly Entertainment');

      const dialog = screen.getByRole('dialog');

      // Currency should show the existing budget's currency
      expect(within(dialog).getByText('BRL')).toBeInTheDocument();
    });
  });

  describe('Category Multi-Select', () => {
    it('displays Categories label on the autocomplete field', async () => {
      await openCreateBudgetForm();

      const dialog = screen.getByRole('dialog');

      // The categories autocomplete should have a "Categories" label
      expect(within(dialog).getByLabelText(/categories/i)).toBeInTheDocument();
    });

    it('shows category options when clicking the categories field', async () => {
      const user = await openCreateBudgetForm();

      const dialog = screen.getByRole('dialog');

      // Click on the categories autocomplete input to open the dropdown
      const categoriesInput = within(dialog).getByLabelText(/categories/i);
      await user.click(categoriesInput);

      // Category options from the mock store should appear in the dropdown
      // The category store has categories with names like "Expense Category 1", etc.
      await waitFor(() => {
        // MUI Autocomplete renders options in a listbox outside the dialog
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // At least one category option should be visible
      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('allows selecting a category from the autocomplete dropdown', async () => {
      const user = await openCreateBudgetForm();

      const dialog = screen.getByRole('dialog');

      // Open the categories dropdown by clicking the input
      const categoriesInput = within(dialog).getByLabelText(/categories/i);
      await user.click(categoriesInput);

      // Wait for the listbox to appear with options
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click the first option in the dropdown to select it
      const listbox = screen.getByRole('listbox');
      const firstOption = within(listbox).getAllByRole('option')[0];
      await user.click(firstOption);

      // After selection, a chip should appear in the autocomplete to show the selected category
      // MUI Autocomplete renders selected items as chips within the input container
      await waitFor(() => {
        // The selected category name should be visible as a chip in the dialog
        const chips = within(dialog).getAllByRole('button');
        // At least one chip button (the remove "x" on the chip) should exist
        // beyond the Cancel and Create buttons
        expect(chips.length).toBeGreaterThan(2);
      });
    });
  });
});
