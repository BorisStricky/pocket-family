// src/features/dashboard/hooks/useDashboardSummary.ts
// Custom hook that aggregates transaction and account data into dashboard summary metrics.
// Since there is no backend `/dashboard/summary` endpoint, we compute metrics client-side
// from existing useTransactions and useAccounts hooks.

import { useMemo } from 'react';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { useCategories } from '@/features/category/hooks/useCategories';
import type { TransactionRead } from '@/features/transactions/types';

/**
 * Date range preset for filtering dashboard data.
 * Controls which transactions are included in the summary calculations.
 */
export type DateRangePreset = '7d' | '30d' | 'month';

/**
 * Summary of spending grouped by category name.
 * Used by SpendingByCategory chart to render pie/bar charts.
 * `color` is the user-assigned hex color for the category, or null to use the
 * positional fallback from CHART_COLORS.
 */
export interface CategorySpending {
  categoryName: string;
  total: number;
  color: string | null;
}

/**
 * Daily aggregation of income and expenses for trend charts.
 * Used by IncomeVsExpenses chart to render time-series data.
 */
export interface DailyTrend {
  date: string;
  income: number;
  expenses: number;
}

/**
 * Complete dashboard summary computed from raw transaction and account data.
 */
export interface DashboardSummary {
  totalExpenses: number;
  totalIncome: number;
  netBalance: number;
  transactionCount: number;
  recentTransactions: TransactionRead[];
  spendingByCategory: CategorySpending[];
  dailyTrends: DailyTrend[];
}

/**
 * Compute the start date for a given date range preset relative to today.
 * Returns an ISO date string (YYYY-MM-DD) that can be used as a filter.
 */
function getStartDateForPreset(preset: DateRangePreset): string {
  const now = new Date();

  switch (preset) {
    case '7d': {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      return sevenDaysAgo.toISOString().split('T')[0];
    }
    case '30d': {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return thirtyDaysAgo.toISOString().split('T')[0];
    }
    case 'month': {
      // First day of current month
      return new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
    }
  }
}

/**
 * useDashboardSummary - aggregates transactions, accounts, and categories
 * into a single dashboard summary object.
 *
 * This hook fetches all transactions for the given date range, then computes:
 * - Total expenses and income
 * - Net balance (income - expenses)
 * - Spending grouped by category (for pie chart)
 * - Daily income vs expense trends (for line/bar chart)
 * - Recent transactions within the selected date range (sorted by date descending, max 10)
 *
 * @param familyId UUID of the current family/tenant
 * @param dateRange Preset date range for filtering ('7d', '30d', 'month')
 */
export function useDashboardSummary(familyId: string, dateRange: DateRangePreset = 'month') {
  const startDate = getStartDateForPreset(dateRange);
  const today = new Date().toISOString().split('T')[0];

  // Fetch all transactions for the selected date range
  const {
    data: transactions,
    isLoading: isLoadingTransactions,
    error: transactionsError,
  } = useTransactions(familyId, { start_date: startDate, end_date: today });

  // Fetch accounts for balance display
  const {
    data: accounts,
    isLoading: isLoadingAccounts,
    error: accountsError,
  } = useAccounts(familyId);

  // Fetch categories so we can map category IDs to names for ungrouped transactions
  const {
    data: categories,
    isLoading: isLoadingCategories,
  } = useCategories(familyId);

  // Compute the summary from raw data using useMemo to avoid recalculating on every render
  const summary = useMemo<DashboardSummary | null>(() => {
    if (!transactions) return null;

    // Build category name lookup: id → name (color comes directly from transaction.category_color,
    // which the backend JOINs in, so no separate color map is needed and there is no race
    // condition when transactions resolve before categories).
    const categoryLookup = new Map<string, string>();
    if (categories) {
      for (const category of categories) {
        categoryLookup.set(category.id, category.name);
      }
    }

    let totalExpenses = 0;
    let totalIncome = 0;

    // Maps for grouping: category name → { total, color }, date → { income, expenses }
    const categorySpendingMap = new Map<string, { total: number; color: string | null }>();
    const dailyTrendMap = new Map<string, { income: number; expenses: number }>();

    for (const transaction of transactions) {
      const amount = parseFloat(transaction.amount);

      if (transaction.transaction_type === 'expense') {
        totalExpenses += amount;

        // Group expenses by category name for the pie chart; also carry the assigned color
        const categoryName =
          transaction.category_name ||
          categoryLookup.get(transaction.category_id || '') ||
          'Uncategorized';
        // category_color is JOINed by the backend onto every TransactionRead row —
        // use it directly to avoid depending on the categories query loading first.
        const categoryColor = transaction.category_color ?? null;
        const existing = categorySpendingMap.get(categoryName);
        categorySpendingMap.set(categoryName, {
          total: (existing?.total ?? 0) + amount,
          // Always use the current transaction's resolved category color from colorById,
          // which reflects the Category table's current state. Picking "first wins" would
          // lock the bucket on null if the earliest transaction pre-dated the color being set.
          color: categoryColor,
        });
      } else {
        totalIncome += amount;
      }

      // Aggregate daily totals for the trend chart
      const dateKey = transaction.transaction_date;
      const existing = dailyTrendMap.get(dateKey) || { income: 0, expenses: 0 };
      if (transaction.transaction_type === 'expense') {
        existing.expenses += amount;
      } else {
        existing.income += amount;
      }
      dailyTrendMap.set(dateKey, existing);
    }

    // Convert category spending map to sorted array (highest spending first)
    const spendingByCategory: CategorySpending[] = Array.from(categorySpendingMap.entries())
      .map(([categoryName, { total, color }]) => ({
        categoryName,
        total: Math.round(total * 100) / 100,
        color,
      }))
      .sort((a, b) => b.total - a.total);

    // Convert daily trends map to sorted array (chronological order)
    const dailyTrends: DailyTrend[] = Array.from(dailyTrendMap.entries())
      .map(([date, values]) => ({
        date,
        income: Math.round(values.income * 100) / 100,
        expenses: Math.round(values.expenses * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Recent transactions are all transactions within the selected date range,
    // sorted by date descending and capped at 10 for the dashboard widget
    const recentTransactions = [...transactions]
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
      .slice(0, 10);

    return {
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      netBalance: Math.round((totalIncome - totalExpenses) * 100) / 100,
      transactionCount: transactions.length,
      recentTransactions,
      spendingByCategory,
      dailyTrends,
    };
  }, [transactions, categories]);

  return {
    summary,
    accounts,
    isLoading: isLoadingTransactions || isLoadingAccounts || isLoadingCategories,
    error: transactionsError || accountsError,
  };
}
