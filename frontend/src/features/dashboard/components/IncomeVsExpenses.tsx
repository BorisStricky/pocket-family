// src/features/dashboard/components/IncomeVsExpenses.tsx
// Bar chart comparing income vs expenses over time (daily aggregation).
// Uses Recharts BarChart with responsive container for automatic sizing.
// Data comes from useDashboardSummary's dailyTrends aggregation.

import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DailyTrend } from '../hooks/useDashboardSummary';

interface IncomeVsExpensesProps {
  dailyTrends: DailyTrend[];
}

/**
 * Format a date string (YYYY-MM-DD) into a shorter display format (MM/DD).
 * This keeps the X-axis labels compact on the bar chart.
 */
function formatDateLabel(dateString: string): string {
  const [, month, day] = dateString.split('-');
  return `${month}/${day}`;
}

/**
 * IncomeVsExpenses - bar chart comparing daily income and expense totals.
 *
 * Green bars represent income, red bars represent expenses.
 * When no data exists, shows an empty state message.
 */
export default function IncomeVsExpenses({ dailyTrends }: IncomeVsExpensesProps) {
  // Empty state when no transaction data exists for the period
  if (dailyTrends.length === 0) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Income vs Expenses
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
            <Typography>No transaction data for this period</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Transform dates into shorter labels for the X-axis
  const chartData = dailyTrends.map((trend) => ({
    ...trend,
    dateLabel: formatDateLabel(trend.date),
  }));

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Income vs Expenses
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dateLabel" />
            <YAxis />
            <Tooltip
              formatter={(value: unknown) => `$${Number(value).toFixed(2)}`}
              labelFormatter={(_label, payload) => {
                // Show full date in tooltip hover
                if (payload && payload.length > 0) {
                  return `Date: ${(payload[0].payload as Record<string, unknown>).date}`;
                }
                return '';
              }}
            />
            <Legend />
            {/* Income bars in green, expenses in red for intuitive visual distinction */}
            <Bar dataKey="income" name="Income" fill="#4CAF50" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#F44336" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
