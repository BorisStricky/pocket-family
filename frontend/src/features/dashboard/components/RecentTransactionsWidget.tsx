// src/features/dashboard/components/RecentTransactionsWidget.tsx
// Compact list of recent transactions for the selected date range with a "View All" link.
// Uses AG Grid (same component as the full transactions page) for consistent UX.
// Clicking "View All" navigates to the full transactions page.

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import type { TransactionRead } from '@/features/transactions/types';
import { AgTransactionsGrid } from '@/components/domain/ag/AgTransactionsGrid';

interface RecentTransactionsWidgetProps {
  recentTransactions: TransactionRead[];
  dateRangeLabel?: string;
}

/**
 * RecentTransactionsWidget - displays the most recent transactions using AG Grid.
 *
 * Shows up to 10 transactions from the selected date range using the same
 * AG Grid component as the full transactions page for consistent look and feel.
 * Includes a "View All" button that navigates to the full transactions page.
 */
export default function RecentTransactionsWidget({ recentTransactions, dateRangeLabel = 'this period' }: RecentTransactionsWidgetProps) {
  const navigate = useNavigate();
  const { familyId } = useParams<{ familyId: string }>();

  // Navigate to the full transactions page when "View All" is clicked
  const handleViewAll = () => {
    navigate(`/app/${familyId}/transactions`);
  };

  // Navigate to transaction details when a row is clicked
  const handleRowClick = (transaction: TransactionRead) => {
    navigate(`/app/${familyId}/transactions`);
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Recent Transactions</Typography>
          <Button size="small" onClick={handleViewAll}>
            View All
          </Button>
        </Box>

        {recentTransactions.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 150,
              color: 'text.secondary',
            }}
          >
            <Typography>No transactions in {dateRangeLabel}</Typography>
          </Box>
        ) : (
          /* AG Grid with compact height for dashboard widget context */
          <AgTransactionsGrid
            transactions={recentTransactions}
            onRowClick={handleRowClick}
            height={400}
          />
        )}
      </CardContent>
    </Card>
  );
}
