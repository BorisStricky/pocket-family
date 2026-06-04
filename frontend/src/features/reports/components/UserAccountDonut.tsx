// src/features/reports/components/UserAccountDonut.tsx
// Nested donut of expenses: the inner ring breaks spending down by account, the outer
// ring by user (the transaction creator). Both rings sum to the same total, viewed two
// ways. Clicking a ring segment sets (or clears) an 'account' or 'user' cross-filter.

import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { ReportSelection, ReportSlice } from '../types';
import { CHART_COLORS, formatReportAmount } from '../utils';

export interface UserAccountDonutProps {
  byUser: ReportSlice[];
  byAccount: ReportSlice[];
  currency: string;
  selection: ReportSelection | null;
  onSelect: (selection: ReportSelection | null) => void;
}

export default function UserAccountDonut({
  byUser,
  byAccount,
  currency,
  selection,
  onSelect,
}: UserAccountDonutProps) {
  const activeUserId = selection?.dimension === 'user' ? selection.value : null;
  const activeAccountId = selection?.dimension === 'account' ? selection.value : null;

  const handleUserClick = (slice: ReportSlice) => {
    if (activeUserId === slice.id) onSelect(null);
    else onSelect({ dimension: 'user', value: slice.id, label: `User: ${slice.label}` });
  };

  const handleAccountClick = (slice: ReportSlice) => {
    if (activeAccountId === slice.id) onSelect(null);
    else onSelect({ dimension: 'account', value: slice.id, label: `Account: ${slice.label}` });
  };

  const hasData = byUser.length > 0 || byAccount.length > 0;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Expenses by User &amp; Account
        </Typography>
        {!hasData ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'text.secondary' }}>
            <Typography>No expense data for this period</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              {/* Inner ring: accounts */}
              <Pie
                data={byAccount}
                dataKey="total"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={70}
                onClick={(_payload, index) => handleAccountClick(byAccount[index])}
                style={{ cursor: 'pointer' }}
              >
                {byAccount.map((slice, index) => (
                  <Cell
                    key={`account-${slice.id}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    opacity={!activeAccountId || activeAccountId === slice.id ? 1 : 0.3}
                  />
                ))}
              </Pie>
              {/* Outer ring: users (transaction creators) */}
              <Pie
                data={byUser}
                dataKey="total"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={110}
                onClick={(_payload, index) => handleUserClick(byUser[index])}
                style={{ cursor: 'pointer' }}
                label={(props: Record<string, unknown>) => (props.label as string)}
              >
                {byUser.map((slice, index) => (
                  <Cell
                    key={`user-${slice.id}`}
                    // Offset the palette so the outer ring reads distinctly from the inner.
                    fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]}
                    opacity={!activeUserId || activeUserId === slice.id ? 1 : 0.3}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: unknown) => formatReportAmount(Number(value), currency)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
