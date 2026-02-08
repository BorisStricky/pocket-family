/**
 * Integration tests for the Dashboard feature (DashboardPage)
 *
 * Validates the main dashboard page behavior including:
 * - Rendering KPI overview cards (expenses, income, net balance) after data loads
 * - Date range toggle switching between 7 Days, 30 Days, and This Month
 * - Quick action buttons for common user tasks
 * - Chart sections (Spending by Category, Income vs Expenses)
 * - Recent Transactions widget with empty state messaging
 * - Loading and error states from API failures
 * - Dashboard title including the current family name
 *
 * Uses MSW handlers for transactions, accounts, categories, and family endpoints.
 * The dashboard aggregates data client-side via useDashboardSummary, so we control
 * the raw transaction data via MSW to verify computed KPI values.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import {
  resetTransactionStore,
  resetAccountStore,
  resetCategoryStore,
  resetFamilyStore,
} from '@/test/mocks/server';
import { FamilyProvider } from '@/features/family/context/FamilyContext';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';

const API_BASE = 'http://localhost:8000';

// Default tenant ID matching setupAuthenticatedUser() and the mock stores
const TEST_TENANT_ID = 'tenant-uuid-456';

// Route path matching the app's router configuration for family-scoped pages
const DASHBOARD_ROUTE = `/app/${TEST_TENANT_ID}/dashboard`;

/**
 * Helper to render DashboardPage inside a Route that defines :familyId.
 * DashboardPage uses useParams() to extract familyId for API calls,
 * and useFamily() from FamilyProvider to display the family name in the title.
 * We must wrap with FamilyProvider inside the Route so it has access to :familyId.
 */
function renderDashboardPage() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/app/:familyId/dashboard"
        element={
          <FamilyProvider>
            <DashboardPage />
          </FamilyProvider>
        }
      />
    </Routes>,
    { initialEntries: [DASHBOARD_ROUTE] }
  );
}

describe('DashboardPage Integration', () => {
  beforeEach(() => {
    // Reset all in-memory stores to known default state for test isolation
    resetTransactionStore();
    resetAccountStore();
    resetCategoryStore();
    resetFamilyStore();

    // Authenticate user so MSW handlers accept requests with Authorization header
    setupAuthenticatedUser(TEST_TENANT_ID);
  });

  it('displays the page title with family name and date range selector after loading', async () => {
    renderDashboardPage();

    // The page title includes the family name fetched from the family API.
    // The mock family factory returns "Test Family" for the default tenant ID.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dashboard - test family/i })).toBeInTheDocument();
    });

    // Date range toggle should render with all three preset options.
    // Default selection is "This Month" (the 'month' preset).
    expect(screen.getByRole('button', { name: /7 days/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /30 days/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /this month/i })).toBeInTheDocument();
  });

  it('renders overview cards with financial metrics after data loads', async () => {
    renderDashboardPage();

    // Overview cards display Total Expenses, Total Income, and Net Balance.
    // These are computed client-side from the transaction data returned by MSW.
    await waitFor(() => {
      expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Income')).toBeInTheDocument();
    expect(screen.getByText('Net Balance')).toBeInTheDocument();
  });

  it('renders quick action buttons for common tasks', async () => {
    renderDashboardPage();

    // Quick Actions card provides shortcuts to frequently used features.
    // These buttons should be available once the page finishes loading.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /view reports/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import csv/i })).toBeInTheDocument();
  });

  it('renders chart section headings after data loads', async () => {
    renderDashboardPage();

    // Both chart components render their headings regardless of whether data exists.
    // With data present, the charts populate; without data, they show empty states.
    await waitFor(() => {
      expect(screen.getByText('Spending by Category')).toBeInTheDocument();
    });

    expect(screen.getByText('Income vs Expenses')).toBeInTheDocument();
  });

  it('renders Recent Transactions section with View All button', async () => {
    renderDashboardPage();

    // The Recent Transactions widget shows up to 10 most recent transactions.
    // The "View All" button navigates to the full transactions list page.
    await waitFor(() => {
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument();
  });

  it('shows loading spinner while data is being fetched', () => {
    // Delay the API response so the loading state stays visible long enough to assert.
    // Without this delay, the MSW response resolves too quickly in the test environment.
    server.use(
      http.get(`${API_BASE}/transactions`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return HttpResponse.json([]);
      })
    );

    renderDashboardPage();

    // MUI CircularProgress renders with role="progressbar"
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty state messages when no transactions exist for the period', async () => {
    // Override transaction handler to return an empty array, simulating a new user
    // or a period with no recorded transactions
    server.use(
      http.get(`${API_BASE}/transactions`, () => {
        return HttpResponse.json([]);
      })
    );

    renderDashboardPage();

    // Each section renders its own empty state message when there is no data.
    // SpendingByCategory shows "No expense data for this period" when spendingByCategory is empty.
    await waitFor(() => {
      expect(screen.getByText('No expense data for this period')).toBeInTheDocument();
    });

    // IncomeVsExpenses shows "No transaction data for this period" when dailyTrends is empty.
    expect(screen.getByText('No transaction data for this period')).toBeInTheDocument();

    // RecentTransactionsWidget shows "No transactions in this month" because the default
    // date range is 'month', which maps to the label "this month".
    expect(screen.getByText('No transactions in this month')).toBeInTheDocument();
  });

  it('displays $0.00 values on all overview cards when there are no transactions', async () => {
    // Return empty transaction list to verify that KPI cards show zeroed values
    server.use(
      http.get(`${API_BASE}/transactions`, () => {
        return HttpResponse.json([]);
      })
    );

    renderDashboardPage();

    // All three overview cards (Expenses, Income, Net Balance) should display $0.00
    // when there are no transactions in the selected period
    await waitFor(() => {
      const zeroValues = screen.getAllByText('$0.00');
      expect(zeroValues.length).toBe(3);
    });
  });

  it('shows error alert when the transaction API fails', async () => {
    // Override the transactions endpoint to return a 500 error,
    // simulating a backend outage or database issue
    server.use(
      http.get(`${API_BASE}/transactions`, () => {
        return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
      })
    );

    renderDashboardPage();

    // The error state renders an MUI Alert with a user-friendly message
    await waitFor(() => {
      expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument();
    });
  });

  it('switches date range when user clicks a different toggle option', async () => {
    const user = userEvent.setup();

    // Start with empty transactions so we can observe the date range label change
    // in the RecentTransactionsWidget empty state message
    server.use(
      http.get(`${API_BASE}/transactions`, () => {
        return HttpResponse.json([]);
      })
    );

    renderDashboardPage();

    // Default range is "month" which shows "No transactions in this month"
    await waitFor(() => {
      expect(screen.getByText('No transactions in this month')).toBeInTheDocument();
    });

    // Click the "7 Days" toggle to switch to the 7-day date range.
    // This triggers a new query with updated start_date and changes the
    // empty state label from "this month" to "the past 7 days".
    await user.click(screen.getByRole('button', { name: /7 days/i }));

    await waitFor(() => {
      expect(screen.getByText('No transactions in the past 7 days')).toBeInTheDocument();
    });

    // Switch to "30 Days" to verify all three options work
    await user.click(screen.getByRole('button', { name: /30 days/i }));

    await waitFor(() => {
      expect(screen.getByText('No transactions in the past 30 days')).toBeInTheDocument();
    });
  });

  it('navigates to the transactions page when clicking View All', async () => {
    const user = userEvent.setup();

    renderDashboardPage();

    // Wait for the dashboard to finish loading before interacting
    await waitFor(() => {
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    });

    // Click the "View All" button in the Recent Transactions section.
    // This triggers navigation to /app/{familyId}/transactions via React Router.
    await user.click(screen.getByRole('button', { name: /view all/i }));

    // After navigation, the DashboardPage unmounts because the new URL
    // no longer matches the /app/:familyId/dashboard route definition.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /dashboard/i })).not.toBeInTheDocument();
    });
  });

  it('navigates to add transaction page when clicking the quick action button', async () => {
    const user = userEvent.setup();

    renderDashboardPage();

    // Wait for page to load fully before interacting with quick actions
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
    });

    // Click the "Add Transaction" quick action button.
    // This navigates to /app/{familyId}/transactions/new.
    await user.click(screen.getByRole('button', { name: /add transaction/i }));

    // The dashboard page unmounts after navigation away from the dashboard route
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /dashboard/i })).not.toBeInTheDocument();
    });
  });
});
