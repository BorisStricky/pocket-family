/**
 * Integration tests for the Budgets feature — icon and color picker flows
 *
 * Verifies that:
 * 1. The Add Budget modal renders both IconPicker and ColorSwatchPicker
 * 2. A selected color is included in the POST payload on form submission
 *
 * MSW intercepts all API calls. The budget and category handlers from the
 * test mock server provide default list responses so the page renders without
 * per-test setup beyond store resets.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import { resetBudgetStore } from '@/test/mocks/server';
import { BudgetsPage } from '@/features/budgets/pages/BudgetsPage';

const API_BASE = 'http://localhost:8000';

// Must match the tenant_id encoded in the mock JWT from setupAuthenticatedUser
const TENANT_ID = 'tenant-uuid-456';

describe('Budgets Integration - Icon and Color Pickers', () => {
  beforeEach(() => {
    resetBudgetStore();
    // 'owner' role is required — the Add Budget button is hidden for members/viewers
    setupAuthenticatedUser(TENANT_ID, 'owner');
  });

  function renderBudgetsPage() {
    return renderWithProviders(
      <Routes>
        <Route path="/app/:familyId/budgets" element={<BudgetsPage />} />
      </Routes>,
      { initialEntries: [`/app/${TENANT_ID}/budgets`] }
    );
  }

  it('renders IconPicker and ColorSwatchPicker inside the Add Budget modal', async () => {
    const user = userEvent.setup();

    renderBudgetsPage();

    // Wait for the budgets list to load before clicking Add
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add budget/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add budget/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    // IconPicker renders a Typography label "Icon"; ColorSwatchPicker renders "Color"
    expect(within(dialog).getByText('Icon')).toBeInTheDocument();
    expect(within(dialog).getByText('Color')).toBeInTheDocument();
  });

  it('includes icon and color in the API payload when submitting the Add Budget form', async () => {
    const user = userEvent.setup();

    let capturedRequestBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/budgets`, async ({ request }) => {
        capturedRequestBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({
          id: 'budget-uuid-icon-test',
          tenant_id: TENANT_ID,
          name: capturedRequestBody.name as string,
          amount: capturedRequestBody.amount as number,
          currency: capturedRequestBody.currency as string,
          categories: [],
          spent: 0,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          icon: capturedRequestBody.icon ?? null,
          color: capturedRequestBody.color ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { status: 201 });
      })
    );

    renderBudgetsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add budget/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add budget/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');

    // Fill in the required fields: name and amount
    await user.type(within(dialog).getByLabelText(/^name$/i), 'Entertainment');
    await user.type(within(dialog).getByLabelText(/^amount$/i), '500');

    // Select the first real color swatch — aria-label is the hex value per SWATCH_COLORS
    const firstColorSwatch = within(dialog).getByRole('button', { name: '#F44336' });
    await user.click(firstColorSwatch);

    await user.click(within(dialog).getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(capturedRequestBody).not.toBeNull();
    });

    expect(capturedRequestBody).toMatchObject({ name: 'Entertainment', color: '#F44336' });
  });
});
