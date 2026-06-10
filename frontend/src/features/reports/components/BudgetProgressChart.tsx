// src/features/reports/components/BudgetProgressChart.tsx
// Per-budget progress for the selected month: each budget shows its name, spent / total
// amounts, and a color-coded % bar. Reuses GET /budgets, which returns a server-calculated
// `spent` for the requested calendar month, so the Reports page can surface budget health
// alongside the category/daily charts. It fetches its own data (rather than receiving it
// from useMonthlyReport) so a slow budgets call never blocks the rest of the report, and
// so each budget keeps its own currency instead of the report's single aggregated currency.

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useBudgets } from '@/features/budgets/hooks/useBudgets';
import { formatReportAmount } from '../utils';

export interface BudgetProgressChartProps {
  /** Tenant whose budgets are shown; passed to the budgets query for cache isolation. */
  familyId: string;
  /** Selected calendar year for the spent calculation. */
  year: number;
  /** Selected calendar month (1-indexed) for the spent calculation. */
  month: number;
}

/**
 * Color the bar by how much of the budget is consumed, mirroring BudgetsList so the
 * status reads the same on both pages: green under 80%, amber 80–99%, red at/over 100%.
 */
function getProgressColor(spentPercentage: number): 'success' | 'warning' | 'error' {
  if (spentPercentage >= 100) return 'error';
  if (spentPercentage >= 80) return 'warning';
  return 'success';
}

export default function BudgetProgressChart({ familyId, year, month }: BudgetProgressChartProps) {
  // The budgets endpoint recomputes `spent` per month/year, so passing the selected
  // period keeps the bars in sync with the month picker (and caches per month).
  const { data: budgets, isLoading, error } = useBudgets(familyId, month, year);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Budgets
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">Failed to load budgets for this period.</Alert>
        ) : !budgets || budgets.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 120,
              color: 'text.secondary',
            }}
          >
            <Typography>No budgets for this period</Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {budgets.map((budget) => {
              const spentAmount = Number(budget.spent);
              const budgetAmount = Number(budget.amount);
              // Guard against divide-by-zero even though the backend validates amount > 0.
              const spentPercentage = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
              const progressColor = getProgressColor(spentPercentage);

              return (
                <Box key={budget.id}>
                  {/* Header row: budget name on the left, spent / total on the right. */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      mb: 0.5,
                      gap: 1,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {budget.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatReportAmount(spentAmount, budget.currency)}
                      {' / '}
                      {formatReportAmount(budgetAmount, budget.currency)}
                    </Typography>
                  </Box>
                  {/* The % bar: the visual fill caps at 100% so it never overflows, while
                      the label always shows the true percentage (which can exceed 100%). */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(spentPercentage, 100)}
                      color={progressColor}
                      sx={{ flex: 1, height: 8, borderRadius: 4 }}
                      aria-label={`${budget.name} spending progress`}
                    />
                    <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
                      {Math.round(spentPercentage)}%
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
