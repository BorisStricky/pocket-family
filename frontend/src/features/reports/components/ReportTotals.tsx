// src/features/reports/components/ReportTotals.tsx
// KPI summary cards (total income, total expense, net) for the selected month.
// Values already reflect the active cross-filter, so these update as the user
// clicks chart slices.

import React from 'react';
import { Card, CardContent, Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
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
  // t() resolves locale-aware labels; reuse dashboard keys for identical English strings.
  const { t } = useTranslation();

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <TotalCard label={t('dashboard.totalIncome')} value={totalIncome} currency={currency} color="success.main" />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <TotalCard label={t('dashboard.totalExpenses')} value={totalExpenses} currency={currency} color="error.main" />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        {/* Net is green when positive (saved) and red when negative (overspent). */}
        <TotalCard
          label={t('reports.net')}
          value={netBalance}
          currency={currency}
          color={netBalance >= 0 ? 'success.main' : 'error.main'}
        />
      </Grid>
    </Grid>
  );
}
