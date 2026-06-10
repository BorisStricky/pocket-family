/**
 * Integration tests for the Reports feature (ReportsPage)
 *
 * The Reports page has no dedicated backend endpoint: it reuses GET /transactions and
 * GET /categories and aggregates client-side (useMonthlyReport), then lets the user
 * cross-filter the charts. Recharts does not render its SVG slices in jsdom (the same
 * limitation the dashboard tests work around), so these tests assert on the rendered
 * chart headings, the KPI totals (plain MUI text computed from the seeded data), the
 * currency selector behavior, and month navigation (verified via the issued query) —
 * not on clicking individual chart segments.
 *
 * Slice-level cross-filter interaction is covered by the hook's logic and is better
 * exercised in an end-to-end browser test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import { resetTransactionStore, resetCategoryStore, resetBudgetStore } from '@/test/mocks/server';
import { ReportsPage } from '@/features/reports/pages';
import { formatReportAmount } from '@/features/reports/utils';

const API_BASE = 'http://localhost:8000';
const TENANT_ID = 'tenant-uuid-456';
const REPORTS_ROUTE = `/app/${TENANT_ID}/reports`;

// Build dates inside the current month so they fall within the page's month query.
const now = new Date();
const dayInCurrentMonth = (day: number): string => {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${String(day).padStart(2, '0')}`;
};

// A small, fully-controlled dataset (all USD) with a parent/child category so we can
// reason about totals exactly: expenses 100 + 50 + 30 = 180, income 1000, net 820.
const SEED_TRANSACTIONS = [
  {
    id: 'txn-1', tenant_id: TENANT_ID, account_id: 'acct-1', account_name: 'Checking',
    category_id: 'cat-groceries', category_name: 'Groceries', amount: '100.00', currency: 'USD',
    transaction_date: dayInCurrentMonth(5), transaction_type: 'expense', description: 'Market',
    created_by: 'user-a', created_by_name: 'Alice', created_at: '', updated_at: '',
    reconciled: false, source: 'manual',
  },
  {
    id: 'txn-2', tenant_id: TENANT_ID, account_id: 'acct-2', account_name: 'Credit',
    category_id: 'cat-transport', category_name: 'Transport', amount: '50.00', currency: 'USD',
    transaction_date: dayInCurrentMonth(10), transaction_type: 'expense', description: 'Bus',
    created_by: 'user-b', created_by_name: 'Bob', created_at: '', updated_at: '',
    reconciled: false, source: 'manual',
  },
  {
    id: 'txn-3', tenant_id: TENANT_ID, account_id: 'acct-1', account_name: 'Checking',
    category_id: 'cat-groceries', category_name: 'Groceries', amount: '30.00', currency: 'USD',
    transaction_date: dayInCurrentMonth(12), transaction_type: 'expense', description: 'Snacks',
    created_by: 'user-b', created_by_name: 'Bob', created_at: '', updated_at: '',
    reconciled: false, source: 'manual',
  },
  {
    id: 'txn-4', tenant_id: TENANT_ID, account_id: 'acct-1', account_name: 'Checking',
    category_id: 'cat-salary', category_name: 'Salary', amount: '1000.00', currency: 'USD',
    transaction_date: dayInCurrentMonth(1), transaction_type: 'income', description: 'Pay',
    created_by: 'user-a', created_by_name: 'Alice', created_at: '', updated_at: '',
    reconciled: false, source: 'manual',
  },
];

// "Groceries" is a child of "Food" so the roll-up toggle has something to collapse.
const SEED_CATEGORIES = [
  { id: 'cat-food', tenant_id: TENANT_ID, name: 'Food', kind: 'expense', parent_id: null, parent_name: null, created_at: '', updated_at: '' },
  { id: 'cat-groceries', tenant_id: TENANT_ID, name: 'Groceries', kind: 'expense', parent_id: 'cat-food', parent_name: 'Food', created_at: '', updated_at: '' },
  { id: 'cat-transport', tenant_id: TENANT_ID, name: 'Transport', kind: 'expense', parent_id: null, parent_name: null, created_at: '', updated_at: '' },
  { id: 'cat-salary', tenant_id: TENANT_ID, name: 'Salary', kind: 'income', parent_id: null, parent_name: null, created_at: '', updated_at: '' },
];

/** Override the transactions/categories endpoints with the controlled seed data. */
function useSeededData(transactions = SEED_TRANSACTIONS, categories = SEED_CATEGORIES) {
  server.use(
    http.get(`${API_BASE}/transactions`, () => HttpResponse.json(transactions)),
    http.get(`${API_BASE}/categories`, () => HttpResponse.json(categories)),
  );
}

function renderReportsPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/app/:familyId/reports" element={<ReportsPage />} />
    </Routes>,
    { initialEntries: [REPORTS_ROUTE] },
  );
}

describe('ReportsPage Integration', () => {
  beforeEach(() => {
    setupAuthenticatedUser(TENANT_ID);
    resetTransactionStore();
    resetCategoryStore();
    resetBudgetStore();
  });

  it('renders the report heading and all four chart sections after data loads', async () => {
    useSeededData();
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^reports$/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Expenses by Category')).toBeInTheDocument();
    expect(screen.getByText('Daily Income vs Expenses')).toBeInTheDocument();
    expect(screen.getByText('Expenses by User & Account')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^budgets$/i })).toBeInTheDocument();
    expect(screen.getByText('Total Income')).toBeInTheDocument();
    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
  });

  it('renders each budget with its name and computed spent percentage', async () => {
    useSeededData();
    renderReportsPage();

    // The default budget store seeds three budgets with known spent/amount ratios:
    // 250/500 = 50%, 850/1000 = 85%, 2100/2000 = 105% (capped visually, shown as text).
    await waitFor(() => {
      expect(screen.getByText('Monthly Entertainment')).toBeInTheDocument();
    });
    expect(screen.getByText('Food & Groceries')).toBeInTheDocument();
    expect(screen.getByText('Total Spending')).toBeInTheDocument();

    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('105%')).toBeInTheDocument();
  });

  it('shows an empty budgets state when no budgets exist for the period', async () => {
    useSeededData();
    // Override the budgets endpoint to return no budgets for this month.
    server.use(http.get(`${API_BASE}/budgets`, () => HttpResponse.json([])));
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('No budgets for this period')).toBeInTheDocument();
    });
  });

  it('computes KPI totals from the month\'s transactions', async () => {
    useSeededData();
    renderReportsPage();

    // Expenses = 180, Income = 1000, Net = 820, all in USD. We format with the same
    // helper the component uses so the assertion is locale-independent.
    await waitFor(() => {
      expect(screen.getByText(formatReportAmount(1000, 'USD'))).toBeInTheDocument();
    });
    expect(screen.getByText(formatReportAmount(180, 'USD'))).toBeInTheDocument();
    expect(screen.getByText(formatReportAmount(820, 'USD'))).toBeInTheDocument();
  });

  it('shows zero totals and empty chart states when there are no transactions', async () => {
    useSeededData([]);
    renderReportsPage();

    // Every expense chart shows its own empty-state copy.
    await waitFor(() => {
      const emptyMessages = screen.getAllByText('No expense data for this period');
      expect(emptyMessages.length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByText('No transactions for this period')).toBeInTheDocument();
  });

  it('hides the currency selector when only one currency is present', async () => {
    useSeededData();
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/currency/i)).not.toBeInTheDocument();
  });

  it('shows the currency selector when the month has multiple currencies', async () => {
    const multiCurrency = [
      ...SEED_TRANSACTIONS,
      {
        ...SEED_TRANSACTIONS[0], id: 'txn-eur', amount: '20.00', currency: 'EUR',
        transaction_date: dayInCurrentMonth(8),
      },
    ];
    useSeededData(multiCurrency);
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    });
    // The selector (MUI Select labelled "Currency") appears only with >1 currency.
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
  });

  it('exposes the subcategory roll-up toggle', async () => {
    useSeededData();
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Expenses by Category')).toBeInTheDocument();
    });
    // The toggle (a MUI Switch, role="switch") controls whether subcategories
    // collapse into their parent category.
    expect(screen.getByRole('switch', { name: /roll up subcategories/i })).toBeInTheDocument();
  });

  it('queries the next month\'s date range when the next-month arrow is clicked', async () => {
    const user = userEvent.setup();

    // Capture the start/end the page requests so we can assert month navigation
    // re-queries with the new month's bounds.
    const requestedRanges: Array<{ start: string | null; end: string | null }> = [];
    server.use(
      http.get(`${API_BASE}/transactions`, ({ request }) => {
        const url = new URL(request.url);
        requestedRanges.push({ start: url.searchParams.get('start'), end: url.searchParams.get('end') });
        return HttpResponse.json(SEED_TRANSACTIONS);
      }),
      http.get(`${API_BASE}/categories`, () => HttpResponse.json(SEED_CATEGORIES)),
    );

    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /next month/i }));

    // The next month's first day is the start of the new range.
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const expectedStart = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
    await waitFor(() => {
      expect(requestedRanges.some((range) => range.start === expectedStart)).toBe(true);
    });
  });
});
