// src/features/reports/components/DailyAmountsBarChart.tsx
// Grouped bar chart of income vs expenses for each day of the selected month.
// Clicking a day's bars sets (or clears) a 'day' cross-filter selection.

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
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DailyAmount, ReportSelection } from '../types';
import { formatReportAmount } from '../utils';

export interface DailyAmountsBarChartProps {
  data: DailyAmount[];
  currency: string;
  selection: ReportSelection | null;
  onSelect: (selection: ReportSelection | null) => void;
}

// Income/expense bar colors; the de-emphasized variants gray out non-selected days
// once a specific day is selected, so the active day stands out.
const INCOME_COLOR = '#4CAF50';
const EXPENSE_COLOR = '#F44336';
const MUTED_COLOR = '#CFD8DC';

/** Show day-of-month on the axis to keep labels short within a single month. */
function dayOfMonth(isoDate: string): string {
  return isoDate.split('-')[2] ?? isoDate;
}

export default function DailyAmountsBarChart({
  data,
  currency,
  selection,
  onSelect,
}: DailyAmountsBarChartProps) {
  // t() resolves locale-aware strings; reuse dashboard keys for identical English labels.
  const { t } = useTranslation();
  const activeDay = selection?.dimension === 'day' ? selection.value : null;

  // Clicking a day toggles its selection. Recharts' chart-level onClick exposes the
  // clicked category via activeLabel (the formatted day-of-month), so we map back to
  // the full ISO date via the payload.
  const handleClick = (state: { activePayload?: Array<{ payload?: DailyAmount }> }) => {
    const clicked = state?.activePayload?.[0]?.payload;
    if (!clicked) return;
    if (activeDay === clicked.date) {
      onSelect(null);
    } else {
      onSelect({
        dimension: 'day',
        value: clicked.date,
        // Cross-filter chip label e.g. "Day 15" / "Dia 15"
        label: t('reports.dayLabel', { day: dayOfMonth(clicked.date) }),
      });
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('reports.dailyIncomeVsExpenses')}
        </Typography>
        {data.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'text.secondary' }}>
            <Typography>{t('reports.noTransactionsForPeriod')}</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} onClick={handleClick} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={dayOfMonth} />
              <YAxis />
              <Tooltip formatter={(value: unknown) => formatReportAmount(Number(value), currency)} />
              <Legend />
              {/* Bar names drive Recharts legend and tooltip labels — must be translated. */}
              <Bar dataKey="income" name={t('dashboard.income')} fill={INCOME_COLOR}>
                {data.map((entry) => (
                  <Cell
                    key={`income-${entry.date}`}
                    fill={!activeDay || activeDay === entry.date ? INCOME_COLOR : MUTED_COLOR}
                  />
                ))}
              </Bar>
              <Bar dataKey="expenses" name={t('dashboard.expenses')} fill={EXPENSE_COLOR}>
                {data.map((entry) => (
                  <Cell
                    key={`expense-${entry.date}`}
                    fill={!activeDay || activeDay === entry.date ? EXPENSE_COLOR : MUTED_COLOR}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
