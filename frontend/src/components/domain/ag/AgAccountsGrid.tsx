// src/components/domain/ag/AgAccountsGrid.tsx
// AG Grid wrapper component specifically configured for displaying account data
// Integrates with useAccounts hook and provides formatted columns for financial accounts

import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Box, Chip, Typography } from '@mui/material';
import type { AccountRead, AccountType } from '@/types/account';

/**
 * Props for AgAccountsGrid component
 */
interface AgAccountsGridProps {
  accounts: AccountRead[];
  isLoading?: boolean;
  onRowClick?: (account: AccountRead) => void;
  height?: string | number;
}

/**
 * AG Grid wrapper for displaying account data in a table
 *
 * Features:
 * - Sortable columns for name, type, currency, and balance
 * - Formatted currency display using Intl.NumberFormat
 * - Account type badge with color coding (cash/debit/credit)
 * - Click handlers for navigating to account details
 * - Loading and empty state overlays
 * - Owner name display for multi-user visibility
 *
 * The grid uses AG Grid Community edition with Material theme
 * and provides a consistent user experience for account data
 *
 * @example
 * <AgAccountsGrid
 *   accounts={accounts}
 *   isLoading={isLoading}
 *   onRowClick={(account) => navigate(`/accounts/${account.id}`)}
 * />
 */
export function AgAccountsGrid({
  accounts,
  isLoading = false,
  onRowClick,
  height = 600,
}: AgAccountsGridProps) {
  // Map account type to color for visual differentiation
  // Helps users quickly identify account types at a glance
  const getAccountTypeColor = (type: AccountType): 'default' | 'primary' | 'secondary' | 'success' => {
    switch (type) {
      case 'cash':
        return 'success'; // Green for cash accounts
      case 'debit':
        return 'primary'; // Blue for debit accounts
      case 'credit':
        return 'secondary'; // Purple for credit cards
      default:
        return 'default';
    }
  };

  // Define column configurations with formatters and custom renderers
  // These columns match the AccountRead interface and provide proper display
  const columnDefinitions: ColDef<AccountRead>[] = useMemo(() => [
    {
      field: 'name',
      headerName: 'Account Name',
      sortable: true,
      sort: 'asc', // Default sort alphabetically by name
      flex: 1, // Allow this column to grow and fill available space
      minWidth: 200,
    },
    {
      field: 'type',
      headerName: 'Type',
      sortable: true,
      width: 120,
      // Render account type as a colored chip for better visual recognition
      cellRenderer: (params: any) => {
        if (!params.value) return '—';
        const type = params.value as AccountType;
        const color = getAccountTypeColor(type);
        // Capitalize first letter for display (cash -> Cash)
        const label = type.charAt(0).toUpperCase() + type.slice(1);

        // Create chip element as HTML string (AG Grid doesn't support React components directly in cellRenderer)
        return `<span style="
          display: inline-block;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 0.8125rem;
          font-weight: 500;
          background-color: ${color === 'success' ? '#4caf50' : color === 'primary' ? '#1976d2' : '#9c27b0'};
          color: white;
        ">${label}</span>`;
      },
    },
    {
      field: 'user_name',
      headerName: 'Owner',
      sortable: true,
      width: 150,
      valueFormatter: (params) => {
        // Show owner name or placeholder if not available
        return params.value || '—';
      },
    },
    {
      field: 'currency',
      headerName: 'Currency',
      sortable: true,
      width: 100,
    },
    {
      field: 'balance',
      headerName: 'Balance',
      sortable: true,
      width: 150,
      type: 'rightAligned', // Align numbers to the right for better readability
      valueFormatter: (params) => {
        // Format balance as currency using the account's currency code
        // Balance may be null if account is shared with "hidden" visibility
        if (params.value === null) return 'Hidden';
        if (!params.value || !params.data) return 'R$ 0.00';

        try {
          const balance = Number(params.value);
          const currency = params.data.currency || 'BRL';

          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(balance);
        } catch {
          return params.value;
        }
      },
      // Apply dynamic styling for negative balances (red) and positive (green)
      cellStyle: (params) => {
        if (params.value === null) {
          return { color: '#757575', fontStyle: 'italic' }; // Gray italic for hidden
        }

        const balance = Number(params.value);
        if (isNaN(balance)) return {};

        return {
          color: balance < 0 ? '#d32f2f' : '#2e7d32', // MUI error (red) and success (green) colors
          fontWeight: 500,
        };
      },
    },
  ], []);

  // Handle row click events to allow navigation to account details
  const handleRowClicked = (event: any) => {
    if (!onRowClick) return;
    onRowClick(event.data);
  };

  // Loading state overlay configuration
  // Shows message while data is being fetched
  const loadingOverlayComponent = useMemo(() => {
    return () => (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        height="100%"
      >
        <Typography variant="body1">Loading accounts...</Typography>
      </Box>
    );
  }, []);

  // Empty state overlay when no accounts exist
  // Provides user feedback that they need to create their first account
  const noRowsOverlayComponent = useMemo(() => {
    return () => (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height="100%"
        gap={2}
      >
        <Typography variant="body1" color="text.secondary">
          No accounts found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first account to start tracking finances
        </Typography>
      </Box>
    );
  }, []);

  return (
    <Box
      className="ag-theme-alpine"
      style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }}
    >
      <AgGridReact<AccountRead>
        rowData={accounts}
        columnDefs={columnDefinitions}
        theme="legacy" // Use legacy CSS themes (ag-theme-alpine) instead of v34+ Theming API
        defaultColDef={{
          resizable: true,
          filter: false,
        }}
        rowSelection="single" // Allow single row selection for account actions
        suppressRowClickSelection={false} // Allow row click to select (simpler UX for accounts)
        onRowClicked={handleRowClicked}
        loading={isLoading}
        loadingOverlayComponent={loadingOverlayComponent}
        noRowsOverlayComponent={noRowsOverlayComponent}
        animateRows={true}
        pagination={false} // Keep it simple for now, pagination can be added later if needed
        domLayout="normal" // Use normal layout with fixed height
      />
    </Box>
  );
}
