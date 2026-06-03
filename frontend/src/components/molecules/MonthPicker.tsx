import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';

/**
 * MonthPicker component for navigating one calendar month at a time.
 *
 * Renders a compact `< June 2026 >` control: previous/next arrow buttons around
 * a centered month label. Used as the primary period selector on the Reports and
 * Transactions pages, where most browsing happens month-by-month rather than via
 * arbitrary date ranges.
 *
 * Months are passed as a 1-indexed `month` (1 = January) plus a `year` so callers
 * never deal with the JavaScript Date 0-indexed month internally. The exported
 * `getMonthRange` / `getCurrentYearMonth` helpers turn a (year, month) pair into
 * the ISO date bounds the transactions API expects.
 *
 * @example
 * <MonthPicker year={2026} month={6} onChange={(year, month) => setPeriod({ year, month })} />
 */
export interface MonthPickerProps {
  /** Full year, e.g. 2026 */
  year: number;
  /** Month number, 1-indexed (1 = January, 12 = December) */
  month: number;
  /** Callback fired with the new (year, month) when the user steps months */
  onChange: (year: number, month: number) => void;
  /** Optional earliest selectable month as { year, month } — disables the prev arrow at the boundary */
  minMonth?: { year: number; month: number };
  /** Optional latest selectable month as { year, month } — disables the next arrow at the boundary */
  maxMonth?: { year: number; month: number };
  /** Optional label rendered above the control */
  label?: string;
}

/**
 * Return the inclusive ISO date bounds (YYYY-MM-DD) for a given month.
 *
 * Uses local-timezone Date construction so the bounds match the calendar month the
 * user sees, avoiding the UTC-shift pitfall documented in DateRangePicker. The last
 * day is obtained via `new Date(year, month, 0)` — day 0 of the *next* month rolls
 * back to the final day of the requested month, handling 28/29/30/31 automatically.
 */
export function getMonthRange(year: number, month: number): { startDate: string; endDate: string } {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  return {
    startDate: formatToISODate(firstDay),
    endDate: formatToISODate(lastDay),
  };
}

/** Return the current calendar month as a 1-indexed { year, month } pair (local time). */
export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * Format a Date as a YYYY-MM-DD string using local-timezone values.
 * Mirrors the helper in DateRangePicker so month bounds and range bounds agree.
 */
function formatToISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Date month is 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Month names for the label; index 0 = January to align with the 1-indexed `month` via `month - 1`. */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Compare two { year, month } pairs as a single ordinal so boundary checks are simple.
 * Returns a number that is negative/zero/positive when `a` is before/equal/after `b`.
 */
function compareYearMonth(
  a: { year: number; month: number },
  b: { year: number; month: number },
): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export const MonthPicker: React.FC<MonthPickerProps> = ({
  year,
  month,
  onChange,
  minMonth,
  maxMonth,
  label,
}) => {
  // Stepping months must roll the year over at the December/January boundary.
  // We build the candidate target first so we can also honor min/max limits.
  const goToPreviousMonth = () => {
    const targetMonth = month === 1 ? 12 : month - 1;
    const targetYear = month === 1 ? year - 1 : year;
    onChange(targetYear, targetMonth);
  };

  const goToNextMonth = () => {
    const targetMonth = month === 12 ? 1 : month + 1;
    const targetYear = month === 12 ? year + 1 : year;
    onChange(targetYear, targetMonth);
  };

  // Disable arrows at the configured boundaries so the user cannot step out of range.
  const previousTarget = { year: month === 1 ? year - 1 : year, month: month === 1 ? 12 : month - 1 };
  const nextTarget = { year: month === 12 ? year + 1 : year, month: month === 12 ? 1 : month + 1 };
  const isPreviousDisabled = minMonth ? compareYearMonth(previousTarget, minMonth) < 0 : false;
  const isNextDisabled = maxMonth ? compareYearMonth(nextTarget, maxMonth) > 0 : false;

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <Box>
      {label && (
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          size="small"
          onClick={goToPreviousMonth}
          disabled={isPreviousDisabled}
          aria-label="Previous month"
        >
          <ChevronLeftIcon />
        </IconButton>

        {/* Fixed min width keeps the arrows from shifting as the month name length changes */}
        <Typography
          variant="subtitle1"
          component="span"
          sx={{ minWidth: 140, textAlign: 'center', fontWeight: 600 }}
          aria-live="polite"
        >
          {monthLabel}
        </Typography>

        <IconButton
          size="small"
          onClick={goToNextMonth}
          disabled={isNextDisabled}
          aria-label="Next month"
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default MonthPicker;
