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
import { getDayFromDate, getMonthFromDate, formatDisplayDate } from '@/lib/dateUtils';

interface IncomeVsExpensesProps {
  dailyTrends: DailyTrend[];
}

/**
 * Custom X-axis tick that shows day numbers on the first row and
 * month abbreviations on the second row only when the month changes.
 * This keeps the axis compact while providing month context at boundaries.
 */
interface CustomDateTickProps {
  x?: number;
  y?: number;
  payload?: { value: string; index: number };
  chartData?: Array<{ date: string }>;
}

function CustomDateTick({ x = 0, y = 0, payload, chartData = [] }: CustomDateTickProps) {
  if (!payload) return null;

  const dateString = payload.value;
  const dayNumber = getDayFromDate(dateString);
  const currentMonth = getMonthFromDate(dateString);

  // Show month label when this is the first data point or when the month changes
  const previousIndex = payload.index - 1;
  const previousDate = previousIndex >= 0 ? chartData[previousIndex]?.date : null;
  const previousMonth = previousDate ? getMonthFromDate(previousDate) : null;
  const showMonthLabel = !previousMonth || currentMonth !== previousMonth;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#666" fontSize={12}>
        {dayNumber}
      </text>
      {showMonthLabel && (
        <text x={0} y={0} dy={30} textAnchor="middle" fill="#333" fontSize={11} fontWeight="bold">
          {currentMonth}
        </text>
      )}
    </g>
  );
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

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Income vs Expenses
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            {/* Custom tick renders day numbers with month labels at month boundaries */}
            <XAxis
              dataKey="date"
              height={50}
              tick={<CustomDateTick chartData={dailyTrends} />}
            />
            <YAxis />
            <Tooltip
              formatter={(value: unknown) => `$${Number(value).toFixed(2)}`}
              labelFormatter={(label: string) => {
                // Show full formatted date in tooltip hover
                return `Date: ${formatDisplayDate(label)}`;
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
