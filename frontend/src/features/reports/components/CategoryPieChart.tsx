// src/features/reports/components/CategoryPieChart.tsx
// Pie chart of expenses by category, with a toggle to roll subcategories up into
// their top-level parent. Clicking a slice sets (or clears) a 'category' cross-filter.

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  FormControlLabel,
  Switch,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { ReportSelection, ReportSlice } from '../types';
import { CHART_COLORS, formatReportAmount } from '../utils';

export interface CategoryPieChartProps {
  data: ReportSlice[];
  currency: string;
  rollUpSubcategories: boolean;
  onToggleRollUp: (rollUp: boolean) => void;
  selection: ReportSelection | null;
  onSelect: (selection: ReportSelection | null) => void;
}

export default function CategoryPieChart({
  data,
  currency,
  rollUpSubcategories,
  onToggleRollUp,
  selection,
  onSelect,
}: CategoryPieChartProps) {
  // t() resolves locale-aware strings; reuse dashboard keys for identical English labels.
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('md'));
  const activeCategoryId = selection?.dimension === 'category' ? selection.value : null;

  // Toggle a category selection on slice click.
  const handleSliceClick = (slice: ReportSlice) => {
    if (activeCategoryId === slice.id) {
      onSelect(null);
    } else {
      // Cross-filter chip label e.g. "Category: Food" — prefix is translated, name is user data.
      onSelect({ dimension: 'category', value: slice.id, label: `${t('reports.categoryPrefix')}${slice.label}` });
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">{t('reports.expensesByCategory')}</Typography>
          {/* Roll-up is controlled by the page so the aggregation hook re-runs with it. */}
          <FormControlLabel
            control={
              <Switch
                checked={rollUpSubcategories}
                onChange={(event) => onToggleRollUp(event.target.checked)}
                size="small"
              />
            }
            label={t('reports.rollUpSubcategories')}
          />
        </Box>

        {data.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'text.secondary' }}>
            <Typography>{t('dashboard.noExpenseData')}</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={100}
                onClick={(_payload, index) => handleSliceClick(data[index])}
                style={{ cursor: 'pointer' }}
                label={(props: Record<string, unknown>) => {
                  const name = props.label as string;
                  const percent = (props.percent as number) ?? 0;
                  return `${name} (${(percent * 100).toFixed(0)}%)`;
                }}
                labelLine
              >
                {data.map((slice, index) => (
                  <Cell
                    key={`cell-${slice.id}`}
                    // Use the category's assigned color when set; fall back to the positional palette
                    fill={slice.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                    // Dim non-selected slices once a category is selected.
                    opacity={!activeCategoryId || activeCategoryId === slice.id ? 1 : 0.3}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: unknown) => formatReportAmount(Number(value), currency)} />
              {!isMobileViewport && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
