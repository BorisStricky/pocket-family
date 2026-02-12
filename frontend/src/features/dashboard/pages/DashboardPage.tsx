// src/features/dashboard/pages/DashboardPage.tsx
// Main dashboard page that displays financial KPIs, charts, and recent activity.
// Aggregates data client-side from existing transactions, accounts, and categories
// since no dedicated backend dashboard endpoint exists.

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  TrendingDown,
  TrendingUp,
  AccountBalanceWallet,
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import { useFamily } from '@/features/family/hooks/useFamily';
import OverviewCard from '@/components/ui/organisms/OverviewCard';
import SpendingByCategory from '../components/SpendingByCategory';
import IncomeVsExpenses from '../components/IncomeVsExpenses';
import RecentTransactionsWidget from '../components/RecentTransactionsWidget';
import QuickActions from '../components/QuickActions';
import { useDashboardSummary, type DateRangePreset } from '../hooks/useDashboardSummary';

/**
 * Format a number as BRL currency (e.g., "R$ 1.234,56").
 * Uses Intl.NumberFormat for proper locale-aware formatting.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
}

/**
 * DashboardPage - the main landing page after login showing financial overview.
 *
 * Layout (top to bottom):
 * 1. Page title + date range selector
 * 2. Quick Actions bar
 * 3. Overview KPI cards (3 columns: Expenses, Income, Net Balance)
 * 4. Charts row (Spending by Category + Income vs Expenses)
 * 5. Recent Transactions table
 *
 * Data is fetched via useDashboardSummary which aggregates from existing API hooks.
 * The date range toggle controls which period's transactions are included.
 */
export default function DashboardPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const { currentFamily } = useFamily();
  const [dateRange, setDateRange] = useState<DateRangePreset>('month');

  const { summary, isLoading, error } = useDashboardSummary(familyId!, dateRange);

  // Human-readable label for the selected date range (used in empty state messages)
  const dateRangeLabelMap: Record<DateRangePreset, string> = {
    '7d': 'the past 7 days',
    '30d': 'the past 30 days',
    'month': 'this month',
  };
  const dateRangeLabel = dateRangeLabelMap[dateRange];

  // Handle date range toggle changes
  const handleDateRangeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newRange: DateRangePreset | null,
  ) => {
    // Prevent deselecting all options - keep current selection if null
    if (newRange !== null) {
      setDateRange(newRange);
    }
  };

  // Loading state while data is being fetched
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state if any API call failed
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load dashboard data. Please try refreshing the page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      {/* Page header with title and date range selector */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Dashboard{currentFamily ? ` - ${currentFamily.name}` : ''}
        </Typography>

        {/* Date range toggle - controls which period's data is shown */}
        <ToggleButtonGroup
          value={dateRange}
          exclusive
          onChange={handleDateRangeChange}
          size="small"
        >
          <ToggleButton value="7d">7 Days</ToggleButton>
          <ToggleButton value="30d">30 Days</ToggleButton>
          <ToggleButton value="month">This Month</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Quick Actions bar - shortcuts to common tasks */}
      <Box sx={{ mb: 3 }}>
        <QuickActions />
      </Box>

      {/* Overview KPI cards - three columns showing key financial metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <OverviewCard
            title="Total Expenses"
            value={summary ? formatCurrency(summary.totalExpenses) : 'R$ 0,00'}
            icon={TrendingDown}
            color="error"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <OverviewCard
            title="Total Income"
            value={summary ? formatCurrency(summary.totalIncome) : 'R$ 0,00'}
            icon={TrendingUp}
            color="success"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <OverviewCard
            title="Net Balance"
            value={summary ? formatCurrency(summary.netBalance) : 'R$ 0,00'}
            icon={AccountBalanceWallet}
            color={summary && summary.netBalance >= 0 ? 'success' : 'error'}
          />
        </Grid>
      </Grid>

      {/* Charts row - spending breakdown and trends side by side */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SpendingByCategory
            spendingByCategory={summary?.spendingByCategory || []}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <IncomeVsExpenses
            dailyTrends={summary?.dailyTrends || []}
          />
        </Grid>
      </Grid>

      {/* Recent Transactions widget - reflects the selected date range */}
      <Box>
        <RecentTransactionsWidget
          recentTransactions={summary?.recentTransactions || []}
          dateRangeLabel={dateRangeLabel}
        />
      </Box>
    </Box>
  );
}
