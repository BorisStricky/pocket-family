// Unit tests for the pure month-range helpers exported by MonthPicker.
// These power the month-scoped queries on the Reports and Transactions pages, so the
// bounds must be exact (inclusive first/last day) and in local time to avoid UTC drift.

import { describe, it, expect } from 'vitest';
import { getMonthRange, getCurrentYearMonth } from '@/components/molecules/MonthPicker';

describe('getMonthRange', () => {
  it('returns the inclusive first and last day of a 31-day month', () => {
    expect(getMonthRange(2026, 1)).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
  });

  it('returns the correct last day for a 30-day month', () => {
    expect(getMonthRange(2026, 4)).toEqual({ startDate: '2026-04-01', endDate: '2026-04-30' });
  });

  it('handles February in a non-leap year', () => {
    expect(getMonthRange(2026, 2)).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
  });

  it('handles February in a leap year', () => {
    expect(getMonthRange(2024, 2)).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
  });

  it('handles December (year boundary month)', () => {
    expect(getMonthRange(2026, 12)).toEqual({ startDate: '2026-12-01', endDate: '2026-12-31' });
  });
});

describe('getCurrentYearMonth', () => {
  it('returns the current local year and 1-indexed month', () => {
    const now = new Date();
    expect(getCurrentYearMonth()).toEqual({ year: now.getFullYear(), month: now.getMonth() + 1 });
  });
});
