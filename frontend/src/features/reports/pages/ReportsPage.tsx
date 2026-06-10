// src/features/reports/pages/ReportsPage.tsx
// Interactive monthly report page. Reuses the existing transactions/categories endpoints
// (no backend reports endpoint) and aggregates client-side via useMonthlyReport. Users
// pick a month, optionally a currency, and cross-filter every chart by clicking a slice.

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { MonthPicker, getCurrentYearMonth } from '@/components/molecules';
import { useMonthlyReport } from '../hooks/useMonthlyReport';
import type { ReportSelection } from '../types';
import ReportTotals from '../components/ReportTotals';
import DailyAmountsBarChart from '../components/DailyAmountsBarChart';
import CategoryPieChart from '../components/CategoryPieChart';
import UserAccountDonut from '../components/UserAccountDonut';
import BudgetProgressChart from '../components/BudgetProgressChart';

export function ReportsPage() {
  const { familyId } = useParams<{ familyId: string }>();

  // Period defaults to the current calendar month.
  const [period, setPeriod] = useState(getCurrentYearMonth());
  // Roll-up and currency are page-level so the aggregation hook re-runs when they change.
  const [rollUpSubcategories, setRollUpSubcategories] = useState(false);
  const [reportCurrency, setReportCurrency] = useState<string | undefined>(undefined);
  // The active cross-filter selection shared across all charts.
  const [selection, setSelection] = useState<ReportSelection | null>(null);

  const { report, isLoading, error } = useMonthlyReport({
    familyId: familyId!,
    year: period.year,
    month: period.month,
    reportCurrency,
    rollUpSubcategories,
    selection,
  });

  // Changing the month clears any active cross-filter and currency override so the new
  // month starts from its own default currency and an unfiltered view.
  const handleMonthChange = (year: number, month: number) => {
    setPeriod({ year, month });
    setSelection(null);
    setReportCurrency(undefined);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load report data. Please try refreshing the page.</Alert>
      </Box>
    );
  }

  const availableCurrencies = report?.availableCurrencies ?? [];
  const activeCurrency = report?.currency ?? '';

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      {/* Header: month navigation, currency selector (only with multiple currencies),
          and the active cross-filter chip. */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 3, alignItems: { md: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="h4" component="h1">
          Reports
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center">
          {availableCurrencies.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel id="report-currency-label">Currency</InputLabel>
              <Select
                labelId="report-currency-label"
                label="Currency"
                value={activeCurrency}
                onChange={(event) => setReportCurrency(event.target.value)}
              >
                {availableCurrencies.map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {currency}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <MonthPicker year={period.year} month={period.month} onChange={handleMonthChange} />
        </Stack>
      </Stack>

      {/* Active cross-filter indicator; clicking the chip's delete clears the filter. */}
      {selection && (
        <Box sx={{ mb: 2 }}>
          <Chip
            label={selection.label}
            color="primary"
            onDelete={() => setSelection(null)}
          />
        </Box>
      )}

      {/* KPI totals (reflect the active filter). */}
      <Box sx={{ mb: 3 }}>
        <ReportTotals
          totalIncome={report?.totalIncome ?? 0}
          totalExpenses={report?.totalExpenses ?? 0}
          netBalance={report?.netBalance ?? 0}
          currency={activeCurrency}
        />
      </Box>

      {/* Charts grid. The cross-filtered charts share the selection + onSelect handler.
          Layout: first row = category pie + user/account donut side by side;
          second row = per-budget progress bars; third row = the daily bar chart,
          each spanning the full width. */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <CategoryPieChart
            data={report?.byCategory ?? []}
            currency={activeCurrency}
            rollUpSubcategories={rollUpSubcategories}
            onToggleRollUp={setRollUpSubcategories}
            selection={selection}
            onSelect={setSelection}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <UserAccountDonut
            byUser={report?.byUser ?? []}
            byAccount={report?.byAccount ?? []}
            currency={activeCurrency}
            selection={selection}
            onSelect={setSelection}
          />
        </Grid>
        {/* Budget progress for the selected month, sitting between the pie charts and
            the daily expenses graph. It fetches its own budget data (with per-budget
            currency) so it stands apart from the cross-filter selection. */}
        <Grid size={{ xs: 12 }}>
          <BudgetProgressChart familyId={familyId!} year={period.year} month={period.month} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <DailyAmountsBarChart
            data={report?.byDay ?? []}
            currency={activeCurrency}
            selection={selection}
            onSelect={setSelection}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
