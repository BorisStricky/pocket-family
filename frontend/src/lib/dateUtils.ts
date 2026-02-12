// src/lib/dateUtils.ts
// Centralized date formatting utilities for consistent display across the app.
// All user-facing dates use dd-MMM-yyyy format (e.g., "11-Feb-2026").

import { format } from 'date-fns';

/**
 * Format a date for display across the app.
 * Uses dd-MMM-yyyy format (e.g., "11-Feb-2026").
 * Parses using UTC to prevent timezone shifts from ISO date strings.
 */
export function formatDisplayDate(dateValue: string | Date): string {
  if (!dateValue) return '';
  try {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    // Use UTC values to avoid timezone shifts for date-only strings (YYYY-MM-DD)
    const utcDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return format(utcDate, 'dd-MMM-yyyy');
  } catch {
    return String(dateValue);
  }
}

/**
 * Extract day number from an ISO date string (e.g., "2026-02-11" -> 11).
 * Used for compact chart axis labels.
 */
export function getDayFromDate(dateString: string): number {
  return parseInt(dateString.split('-')[2], 10);
}

/**
 * Extract short month name from an ISO date string (e.g., "2026-02-11" -> "Feb").
 * Used for chart axis month boundary labels.
 */
export function getMonthFromDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00Z');
  return format(new Date(date.getUTCFullYear(), date.getUTCMonth(), 1), 'MMM');
}
