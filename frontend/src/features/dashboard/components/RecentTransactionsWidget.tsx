// src/features/dashboard/components/RecentTransactionsWidget.tsx
// Compact list of recent transactions for the selected date range with a "View All" link.
// Uses a simple MUI Table instead of AG Grid for lighter weight on the dashboard.
// Clicking "View All" navigates to the full transactions page.

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Box,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import type { TransactionRead } from '@/features/transactions/types';

interface RecentTransactionsWidgetProps {
  recentTransactions: TransactionRead[];
  dateRangeLabel?: string;
}

/**
 * RecentTransactionsWidget - displays the most recent transactions in a compact table.
 *
 * Shows up to 10 transactions from the selected date range with:
 * - Date, description, category, amount (color-coded by type)
 * - "View All" button that navigates to the full transactions page
 * - Empty state when no recent transactions exist
 */
export default function RecentTransactionsWidget({ recentTransactions, dateRangeLabel = 'this period' }: RecentTransactionsWidgetProps) {
  const navigate = useNavigate();
  const { familyId } = useParams<{ familyId: string }>();

  // Navigate to the full transactions page when "View All" is clicked
  const handleViewAll = () => {
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
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentTransactions.map((transaction) => (
                  <TableRow key={transaction.id} hover>
                    <TableCell>{transaction.transaction_date}</TableCell>
                    <TableCell>
                      {transaction.description || '-'}
                    </TableCell>
                    <TableCell>
                      {transaction.category_name ? (
                        <Chip
                          label={transaction.category_name}
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {/* Color-code amounts: red for expenses, green for income */}
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        color={transaction.transaction_type === 'expense' ? 'error.main' : 'success.main'}
                      >
                        {transaction.transaction_type === 'expense' ? '-' : '+'}$
                        {parseFloat(transaction.amount).toFixed(2)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
