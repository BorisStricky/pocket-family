// src/features/dashboard/components/IncomeVsExpenses.tsx
// Bar chart comparing income vs expenses over time (daily aggregation).
// Uses Recharts BarChart with responsive container for automatic sizing.
// Data comes from useDashboardSummary's dailyTrends aggregation.

import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
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
 * month abbreviations (Jan, Feb, ...) on the second row for every tick.
 * This provides clear context for each data point.
 */
interface CustomDateTickProps {
  x?: number;
  y?: number;
  payload?: { value: string; index: number };
}

function CustomDateTick({ x = 0, y = 0, payload }: CustomDateTickProps) {
  if (!payload) return null;

  const dateString = payload.value;
  const dayNumber = getDayFromDate(dateString);
  const monthName = getMonthFromDate(dateString);

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#666" fontSize={12}>
        {dayNumber}
      </text>
      <text x={0} y={0} dy={30} textAnchor="middle" fill="#333" fontSize={11} fontWeight="bold">
        {monthName}
      </text>
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
  const { t } = useTranslation();

  // Empty state when no transaction data exists for the period
  if (dailyTrends.length === 0) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('dashboard.incomeVsExpenses')}
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
            <Typography>{t('dashboard.noTransactionData')}</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('dashboard.incomeVsExpenses')}
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            {/* Custom tick renders day numbers with month labels at month boundaries */}
            <XAxis
              dataKey="date"
              height={50}
              tick={<CustomDateTick />}
            />
            <YAxis />
            <Tooltip
              formatter={(value: unknown) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))}
              labelFormatter={(label: string) => {
                // Show full formatted date in tooltip hover
                return t('dashboard.chartDateLabel', { date: formatDisplayDate(label) });
              }}
            />
            <Legend />
            {/* Income bars in green, expenses in red for intuitive visual distinction */}
            <Bar dataKey="income" name={t('dashboard.income')} fill="#4CAF50" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name={t('dashboard.expenses')} fill="#F44336" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
