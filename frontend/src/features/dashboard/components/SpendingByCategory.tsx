// src/features/dashboard/components/SpendingByCategory.tsx
// Pie chart showing expense breakdown by category.
// Uses Recharts PieChart with responsive container for automatic sizing.
// Data comes from useDashboardSummary's spendingByCategory aggregation.

import React from 'react';
import { Card, CardContent, Typography, Box, useMediaQuery, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { CategorySpending } from '../hooks/useDashboardSummary';
// Import the canonical palette from reports so both charts use the same fallback colors
import { CHART_COLORS } from '@/features/reports/utils';

interface SpendingByCategoryProps {
  spendingByCategory: CategorySpending[];
}

/**
 * SpendingByCategory - pie chart showing how expenses are distributed across categories.
 *
 * When no data is available (no expenses in the period), shows an empty state message.
 * Limits display to top 7 categories and groups the rest into "Other" for readability.
 */
export default function SpendingByCategory({ spendingByCategory }: SpendingByCategoryProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  // Hide legend on mobile to prevent overcrowding the small chart area
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('md'));

  // Group smaller categories into "Other" to keep the chart readable
  const maxCategories = 7;
  let chartData = spendingByCategory;

  if (spendingByCategory.length > maxCategories) {
    const topCategories = spendingByCategory.slice(0, maxCategories);
    const otherTotal = spendingByCategory
      .slice(maxCategories)
      .reduce((sum, category) => sum + category.total, 0);
    chartData = [
      ...topCategories,
      { categoryName: t('dashboard.otherCategory'), total: Math.round(otherTotal * 100) / 100, color: null },
    ];
  }

  // Empty state when no expense data exists
  if (chartData.length === 0) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('dashboard.spendingByCategory')}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 250,
              color: 'text.secondary',
            }}
          >
            <Typography>{t('dashboard.noExpenseData')}</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('dashboard.spendingByCategory')}
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="total"
              nameKey="categoryName"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(props: Record<string, unknown>) => {
                const name = props.categoryName as string;
                const pct = (props.percent as number) ?? 0;
                return `${name} (${(pct * 100).toFixed(0)}%)`;
              }}
              labelLine
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  // Use the category's assigned color when set; fall back to the positional palette
                  fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown) => `$${Number(value).toFixed(2)}`}
            />
            {!isMobileViewport && <Legend />}
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
