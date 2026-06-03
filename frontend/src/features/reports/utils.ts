// src/features/reports/utils.ts
// Small presentation helpers shared by the Reports charts: a consistent color palette
// and a currency formatter. Kept local to the feature since no app-wide formatter exists.

/** Distinct hues reused across the pie/donut/bar charts (mirrors the dashboard palette). */
export const CHART_COLORS = [
  '#2196F3', // Blue
  '#FF9800', // Orange
  '#4CAF50', // Green
  '#F44336', // Red
  '#9C27B0', // Purple
  '#00BCD4', // Cyan
  '#FF5722', // Deep Orange
  '#607D8B', // Blue Grey
  '#795548', // Brown
  '#3F51B5', // Indigo
];

/**
 * Format a numeric amount with its ISO currency code (e.g. "R$ 1,234.56").
 * Falls back to a plain fixed-2 string if the currency code is empty/unknown so the
 * UI never renders "NaN" or throws on an unexpected code.
 */
export function formatReportAmount(value: number, currency: string): string {
  if (!currency) return value.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    // Intl throws on an invalid currency code — degrade gracefully.
    return `${value.toFixed(2)} ${currency}`;
  }
}
