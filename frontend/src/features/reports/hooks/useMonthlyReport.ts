// src/features/reports/hooks/useMonthlyReport.ts
// Aggregates a single month of transactions into the shapes the Reports charts need.
//
// There is no backend reports endpoint: GET /transactions already returns every row
// enriched with account_name, category_name and created_by_name, so we reuse it (plus
// categories for parent roll-up) and aggregate in memory — the same approach as the
// dashboard's useDashboardSummary. Keeping the data on the client is also what makes the
// click-to-cross-filter interaction instant (no re-fetch per click).

import { useMemo } from 'react';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useCategories } from '@/features/category/hooks/useCategories';
import { getMonthRange } from '@/components/molecules/MonthPicker';
import type { TransactionRead } from '@/features/transactions/types';
import type {
  DailyAmount,
  MonthlyReportData,
  ReportDimension,
  ReportSelection,
  ReportSlice,
} from '../types';

/** Sentinel id/label used for expense transactions that have no category assigned. */
const UNCATEGORIZED_ID = '__uncategorized__';
const UNCATEGORIZED_LABEL = 'Uncategorized';

export interface UseMonthlyReportParams {
  familyId: string;
  year: number;
  month: number; // 1-indexed
  /** Currency to aggregate; when undefined the dominant currency of the month is used. */
  reportCurrency?: string;
  /** When true, expenses roll up from subcategories into their top-level parent. */
  rollUpSubcategories: boolean;
  /** Active cross-filter selection, or null. */
  selection: ReportSelection | null;
}

/** Round to cents to avoid floating-point noise accumulating across many additions. */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Resolve a transaction's effective expense category (id + label) honoring the
 * roll-up toggle. With roll-up on, a subcategory is attributed to its top-level
 * parent; with it off, to the leaf category itself.
 */
function resolveCategory(
  transaction: TransactionRead,
  parentIdByCategory: Map<string, string | null>,
  nameByCategory: Map<string, string>,
  rollUpSubcategories: boolean,
): { id: string; label: string } {
  const categoryId = transaction.category_id;
  if (!categoryId) {
    return { id: UNCATEGORIZED_ID, label: UNCATEGORIZED_LABEL };
  }

  if (rollUpSubcategories) {
    // Climb the parent chain to the TOP-LEVEL ancestor, not just the direct parent:
    // a hierarchy can be deeper than two levels (grandchild -> child -> root), and the
    // UI promises grouping by the top-level parent. Walk upward until we reach a category
    // whose parent is null/undefined. A visited Set defensively guards against cycles in
    // malformed data so we never loop forever.
    const visitedCategoryIds = new Set<string>();
    let rootId = categoryId;
    let currentParentId = parentIdByCategory.get(rootId) ?? null;
    while (currentParentId && !visitedCategoryIds.has(currentParentId)) {
      visitedCategoryIds.add(rootId);
      rootId = currentParentId;
      currentParentId = parentIdByCategory.get(rootId) ?? null;
    }
    // Only re-attribute when the category actually had a parent (rootId moved); a
    // category that is already top-level keeps its own id/label (unchanged behavior).
    if (rootId !== categoryId) {
      return { id: rootId, label: nameByCategory.get(rootId) ?? 'Unknown' };
    }
  }

  // Prefer the joined category_name from the row, falling back to the lookup map.
  const label = transaction.category_name ?? nameByCategory.get(categoryId) ?? 'Unknown';
  return { id: categoryId, label };
}

/**
 * Whether a transaction matches the active selection on the selection's own dimension.
 * Used to decide which transactions survive the cross-filter.
 */
function transactionMatchesSelection(
  transaction: TransactionRead,
  selection: ReportSelection,
  effectiveCategoryId: string,
): boolean {
  switch (selection.dimension) {
    case 'category':
      return effectiveCategoryId === selection.value;
    case 'account':
      return transaction.account_id === selection.value;
    case 'user':
      return transaction.created_by === selection.value;
    case 'day':
      return transaction.transaction_date === selection.value;
  }
}

/**
 * Cross-filter rule: a chart aggregating dimension `chartDimension` ignores the
 * selection when the selection is on that same dimension (so its other slices stay
 * visible and selectable), and otherwise only counts transactions matching the
 * selection. Pass chartDimension = null for the totals, which always respect the filter.
 */
function includeForChart(
  transaction: TransactionRead,
  selection: ReportSelection | null,
  chartDimension: ReportDimension | null,
  effectiveCategoryId: string,
): boolean {
  if (!selection) return true;
  if (selection.dimension === chartDimension) return true;
  return transactionMatchesSelection(transaction, selection, effectiveCategoryId);
}

/** Convert a Map of id -> { label, total, color } into a sorted (desc) ReportSlice array. */
function toSortedSlices(
  grouped: Map<string, { label: string; total: number; color: string | null }>,
): ReportSlice[] {
  return Array.from(grouped.entries())
    .map(([id, { label, total, color }]) => ({ id, label, total: roundCents(total), color }))
    .sort((first, second) => second.total - first.total);
}

/**
 * useMonthlyReport — fetch one month of transactions and aggregate them into totals
 * and per-category / per-day / per-user / per-account breakdowns, applying the active
 * cross-filter selection and currency/roll-up options.
 */
export function useMonthlyReport({
  familyId,
  year,
  month,
  reportCurrency,
  rollUpSubcategories,
  selection,
}: UseMonthlyReportParams) {
  const { startDate, endDate } = getMonthRange(year, month);

  const {
    data: transactions,
    isLoading: isLoadingTransactions,
    error: transactionsError,
  } = useTransactions(familyId, { start_date: startDate, end_date: endDate });

  const {
    data: categories,
    isLoading: isLoadingCategories,
  } = useCategories(familyId);

  const report = useMemo<MonthlyReportData | null>(() => {
    if (!transactions) return null;

    // Build category lookup maps once so resolveCategory stays O(1) per transaction.
    const parentIdByCategory = new Map<string, string | null>();
    const nameByCategory = new Map<string, string>();
    const colorById = new Map<string, string | null>();
    if (categories) {
      for (const category of categories) {
        parentIdByCategory.set(category.id, category.parent_id);
        nameByCategory.set(category.id, category.name);
        colorById.set(category.id, category.color);
      }
    }

    // Resolve the currency to aggregate: caller's choice, else the most frequent one
    // this month. We only ever sum a single currency (no conversion).
    const currencyCounts = new Map<string, number>();
    for (const transaction of transactions) {
      currencyCounts.set(transaction.currency, (currencyCounts.get(transaction.currency) ?? 0) + 1);
    }
    const availableCurrencies = Array.from(currencyCounts.keys()).sort();
    const dominantCurrency = Array.from(currencyCounts.entries())
      .sort((first, second) => second[1] - first[1])[0]?.[0];
    const currency = reportCurrency ?? dominantCurrency ?? '';

    // Precompute each transaction's effective category id so both the filter and the
    // category aggregation agree under the roll-up toggle.
    const currencyTransactions = transactions.filter(
      (transaction) => transaction.currency === currency,
    );
    const effectiveCategoryId = new Map<string, string>();
    for (const transaction of currencyTransactions) {
      effectiveCategoryId.set(
        transaction.id,
        resolveCategory(transaction, parentIdByCategory, nameByCategory, rollUpSubcategories).id,
      );
    }

    // Totals respect the full selection (chartDimension = null).
    let totalIncome = 0;
    let totalExpenses = 0;
    let transactionCount = 0;

    const byCategoryMap = new Map<string, { label: string; total: number; color: string | null }>();
    // User and account slices don't have user-assigned colors — always null
    const byUserMap = new Map<string, { label: string; total: number; color: string | null }>();
    const byAccountMap = new Map<string, { label: string; total: number; color: string | null }>();
    const byDayMap = new Map<string, { income: number; expenses: number }>();

    for (const transaction of currencyTransactions) {
      const amount = parseFloat(transaction.amount);
      const isExpense = transaction.transaction_type === 'expense';
      const effectiveCategory = effectiveCategoryId.get(transaction.id) ?? UNCATEGORIZED_ID;

      // Totals (respect the active filter on every dimension).
      //
      // Income is never tied to an EXPENSE category, so a 'category' cross-filter must
      // not constrain income — otherwise selecting an expense slice would zero out
      // Total Income (no income row matches an expense category) and make netBalance
      // misleadingly equal to -totalExpenses. For income we therefore drop a 'category'
      // selection; for 'account'/'user'/'day' the selection still applies because income
      // legitimately carries an account_id, created_by, and date.
      const incomeSelection = selection?.dimension === 'category' ? null : selection;
      if (isExpense) {
        if (includeForChart(transaction, selection, null, effectiveCategory)) {
          transactionCount += 1;
          totalExpenses += amount;
        }
      } else {
        if (includeForChart(transaction, incomeSelection, null, effectiveCategory)) {
          transactionCount += 1;
          totalIncome += amount;
        }
      }

      // Expense-only breakdowns; each ignores the filter on its own dimension.
      if (isExpense) {
        if (includeForChart(transaction, selection, 'category', effectiveCategory)) {
          const resolved = resolveCategory(transaction, parentIdByCategory, nameByCategory, rollUpSubcategories);
          const existing = byCategoryMap.get(resolved.id);
          // Color comes from the resolved category (the root when rolling up)
          const color = colorById.get(resolved.id) ?? null;
          byCategoryMap.set(resolved.id, {
            label: resolved.label,
            total: (existing?.total ?? 0) + amount,
            color,
          });
        }

        if (includeForChart(transaction, selection, 'user', effectiveCategory)) {
          const userId = transaction.created_by;
          const existing = byUserMap.get(userId);
          byUserMap.set(userId, {
            label: transaction.created_by_name ?? 'Unknown user',
            total: (existing?.total ?? 0) + amount,
            color: null,
          });
        }

        if (includeForChart(transaction, selection, 'account', effectiveCategory)) {
          const accountId = transaction.account_id;
          const existing = byAccountMap.get(accountId);
          byAccountMap.set(accountId, {
            label: transaction.account_name ?? 'Unknown account',
            total: (existing?.total ?? 0) + amount,
            // Preserve the color from the first transaction seen for this account
            // (all rows for the same account share the same color); fall back to the
            // current row's color so we never overwrite an existing value with null.
            color: existing?.color ?? (transaction.account_color ?? null),
          });
        }
      }

      // Daily chart shows income and expenses; it ignores the filter on the 'day' dimension.
      if (includeForChart(transaction, selection, 'day', effectiveCategory)) {
        const existing = byDayMap.get(transaction.transaction_date) ?? { income: 0, expenses: 0 };
        if (isExpense) existing.expenses += amount;
        else existing.income += amount;
        byDayMap.set(transaction.transaction_date, existing);
      }
    }

    const byDay: DailyAmount[] = Array.from(byDayMap.entries())
      .map(([date, values]) => ({
        date,
        income: roundCents(values.income),
        expenses: roundCents(values.expenses),
      }))
      .sort((first, second) => first.date.localeCompare(second.date));

    return {
      totalIncome: roundCents(totalIncome),
      totalExpenses: roundCents(totalExpenses),
      netBalance: roundCents(totalIncome - totalExpenses),
      transactionCount,
      byCategory: toSortedSlices(byCategoryMap),
      byDay,
      byUser: toSortedSlices(byUserMap),
      byAccount: toSortedSlices(byAccountMap),
      availableCurrencies,
      currency,
    };
  }, [transactions, categories, reportCurrency, rollUpSubcategories, selection]);

  return {
    report,
    isLoading: isLoadingTransactions || isLoadingCategories,
    error: transactionsError,
  };
}
