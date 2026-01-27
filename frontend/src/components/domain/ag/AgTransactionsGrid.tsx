// src/components/domain/ag/AgTransactionsGrid.tsx
// AG Grid wrapper component specifically configured for displaying transaction data
// Integrates with useTransactions hook and provides formatted columns for financial data

import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Box, Typography } from '@mui/material';
import type { TransactionRead, TransactionFilters } from '@/features/transactions/types';

/**
 * Props for AgTransactionsGrid component
 */
interface AgTransactionsGridProps {
  transactions: TransactionRead[];
  isLoading?: boolean;
  filters?: TransactionFilters;
  onRowClick?: (transaction: TransactionRead) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  height?: string | number;
}

/**
 * AG Grid wrapper for displaying transaction data in a table
 *
 * Features:
 * - Sortable columns for date, amount, account, and category
 * - Formatted currency display using Intl.NumberFormat
 * - Date formatting for readable display
 * - Row selection with callback for bulk actions
 * - Click handlers for navigating to transaction details
 * - Loading and empty state overlays
 *
 * The grid uses AG Grid Community edition with Material theme
 * and provides a consistent user experience for transaction data
 *
 * @example
 * <AgTransactionsGrid
 *   transactions={transactions}
 *   isLoading={isLoading}
 *   onRowClick={(transaction) => navigate(`/transactions/${transaction.id}`)}
 *   onSelectionChange={(ids) => setSelectedIds(ids)}
 * />
 */
export function AgTransactionsGrid({
  transactions,
  isLoading = false,
  filters,
  onRowClick,
  onSelectionChange,
  height = 600,
}: AgTransactionsGridProps) {
  // Define column configurations with formatters and custom renderers
  // These columns match the TransactionRead interface and provide proper display
  const columnDefinitions: ColDef<TransactionRead>[] = useMemo(() => [
    {
      field: 'transaction_date',
      headerName: 'Date',
      sortable: true,
      sort: 'desc', // Default sort by date descending (most recent first)
      width: 120,
      valueFormatter: (params) => {
        // Format ISO date string to DD/MM/YYYY format using UTC methods
        // Manual formatting ensures DD/MM/YYYY instead of US format (MM/DD/YYYY)
        // UTC methods prevent timezone shifts since backend stores dates as ISO strings
        if (!params.value) return '';
        try {
          const date = new Date(params.value);
          const day = String(date.getUTCDate()).padStart(2, '0');
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const year = date.getUTCFullYear();
          return `${day}/${month}/${year}`;
        } catch {
          return params.value;
        }
      },
    },
    {
      field: 'description',
      headerName: 'Description',
      sortable: true,
      flex: 1, // Allow this column to grow and fill available space
      minWidth: 200,
      valueFormatter: (params) => {
        // Show description or empty placeholder if not provided
        return params.value || '—';
      },
    },
    {
      field: 'account_name',
      headerName: 'Account',
      sortable: true,
      filter: true, // Enable AG Grid text filter - icon appears next to header
      width: 150,
      valueFormatter: (params) => {
        // Show friendly message when account has been deleted
        return params.value || '[Deleted Account]';
      },
    },
    {
      field: 'category_name',
      headerName: 'Category',
      sortable: true,
      filter: true, // Enable AG Grid text filter - icon appears next to header
      width: 150,
      valueFormatter: (params) => {
        // Show category name or "Uncategorized" if not assigned
        return params.value || 'Uncategorized';
      },
    },
    {
      field: 'amount',
      headerName: 'Amount',
      sortable: true,
      width: 130,
      type: 'rightAligned', // Align numbers to the right for better readability
      valueFormatter: (params) => {
        // Format amount as currency using the transaction's currency code
        if (!params.value || !params.data) return '';
        try {
          const amount = Number(params.value);
          const currency = params.data.currency || 'USD';
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(amount);
        } catch {
          return params.value;
        }
      },
    },
    {
      field: 'transaction_type',
      headerName: 'Type',
      sortable: true,
      width: 100,
      // Format value to capitalize first letter (expense -> Expense)
      valueFormatter: (params) => {
        if (!params.value) return '';
        return params.value.charAt(0).toUpperCase() + params.value.slice(1);
      },
      // Apply dynamic styling based on transaction type (red for expense, green for income)
      cellStyle: (params) => {
        if (!params.value) return {};
        const isExpense = params.value === 'expense';
        return {
          color: isExpense ? '#d32f2f' : '#2e7d32', // MUI error and success colors
          fontWeight: 500,
        };
      },
    },
  ], []);

  // Handle row selection changes and notify parent component
  // Extracts transaction IDs from selected rows for bulk operations
  const handleSelectionChanged = (event: any) => {
    if (!onSelectionChange) return;
    const selectedNodes = event.api.getSelectedNodes();
    const selectedIds = selectedNodes.map((node: any) => node.data.id);
    onSelectionChange(selectedIds);
  };

  // Handle row click events to allow navigation to transaction details
  const handleRowClicked = (event: any) => {
    if (!onRowClick) return;
    onRowClick(event.data);
  };

  // Loading state overlay configuration
  // Shows spinner and message while data is being fetched
  const loadingOverlayComponent = useMemo(() => {
    return () => (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        height="100%"
      >
        <Typography variant="body1">Loading...</Typography>
      </Box>
    );
  }, []);

  // Empty state overlay when no transactions match the filters
  // Provides user feedback that the query succeeded but returned no results
  const noRowsOverlayComponent = useMemo(() => {
    return () => (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        height="100%"
      >
        <Typography variant="body1" color="text.secondary">
          No transactions found
        </Typography>
      </Box>
    );
  }, []);

  return (
    <Box
      className="ag-theme-alpine"
      style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }}
    >
      <AgGridReact<TransactionRead>
        rowData={transactions}
        columnDefs={columnDefinitions}
        theme="legacy" // Use legacy CSS themes (ag-theme-alpine) instead of v34+ Theming API
        defaultColDef={{
          resizable: true,
          filter: false, // Filtering handled externally via TransactionFilters
        }}
        rowSelection="multiple"
        suppressRowClickSelection={true} // Require checkbox click for selection
        onSelectionChanged={handleSelectionChanged}
        onRowClicked={handleRowClicked}
        loading={isLoading}
        loadingOverlayComponent={loadingOverlayComponent}
        noRowsOverlayComponent={noRowsOverlayComponent}
        animateRows={true}
        pagination={false} // Pagination can be added later if needed
        domLayout="normal" // Use normal layout with fixed height
      />
    </Box>
  );
}
