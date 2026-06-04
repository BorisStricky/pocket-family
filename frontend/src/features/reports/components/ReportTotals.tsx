// src/features/reports/components/ReportTotals.tsx
// KPI summary cards (total income, total expense, net) for the selected month.
// Values already reflect the active cross-filter, so these update as the user
// clicks chart slices.

import React from 'react';
import { Card, CardContent, Grid, Typography } from '@mui/material';
import { formatReportAmount } from '../utils';

export interface ReportTotalsProps {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  currency: string;
}

/** A single labelled KPI card; net is colored by sign to read at a glance. */
function TotalCard({ label, value, currency, color }: {
  label: string;
  value: number;
  currency: string;
  color?: string;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ color, fontWeight: 600 }}>
          {formatReportAmount(value, currency)}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function ReportTotals({
  totalIncome,
  totalExpenses,
  netBalance,
  currency,
}: ReportTotalsProps) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <TotalCard label="Total Income" value={totalIncome} currency={currency} color="success.main" />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <TotalCard label="Total Expenses" value={totalExpenses} currency={currency} color="error.main" />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        {/* Net is green when positive (saved) and red when negative (overspent). */}
        <TotalCard
          label="Net"
          value={netBalance}
          currency={currency}
          color={netBalance >= 0 ? 'success.main' : 'error.main'}
        />
      </Grid>
    </Grid>
  );
}
