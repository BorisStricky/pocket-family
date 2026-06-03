// src/features/reports/types.ts
// Shared types for the monthly Reports feature. The reports are computed entirely
// client-side from the existing transactions/categories/accounts endpoints, so these
// types describe the aggregated shapes the charts consume rather than API contracts.

/**
 * The dimensions a user can cross-filter by. Clicking a chart element of one
 * dimension filters every chart of the *other* dimensions (bidirectional).
 */
export type ReportDimension = 'category' | 'account' | 'user' | 'day';

/**
 * The currently active cross-filter selection, or null when nothing is selected.
 * `value` is the stable key (category/account/user id, or a YYYY-MM-DD date);
 * `label` is the human-readable text shown on the active-filter chip.
 */
export interface ReportSelection {
  dimension: ReportDimension;
  value: string;
  label: string;
}

/**
 * A single aggregated slice for a pie/donut chart (category, user, or account).
 * `id` is the stable key used to match a click against a ReportSelection.
 */
export interface ReportSlice {
  id: string;
  label: string;
  total: number;
}

/** Per-day income and expense totals for the daily bar chart. */
export interface DailyAmount {
  date: string; // YYYY-MM-DD
  income: number;
  expenses: number;
}

/**
 * Everything the Reports page renders for one month and currency, already
 * cross-filtered according to the active selection.
 */
export interface MonthlyReportData {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
  byCategory: ReportSlice[]; // expenses, grouped by (effective) category
  byDay: DailyAmount[]; // income + expenses per day
  byUser: ReportSlice[]; // expenses, grouped by transaction creator
  byAccount: ReportSlice[]; // expenses, grouped by account
  availableCurrencies: string[]; // distinct currencies present this month
  currency: string; // the currency actually aggregated
}
