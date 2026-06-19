// src/components/domain/ag/AgTransactionsGrid.tsx
// AG Grid wrapper component specifically configured for displaying transaction data
// Integrates with useTransactions hook and provides formatted columns for financial data

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Box, Typography } from '@mui/material';
import type { TransactionRead, TransactionFilters } from '@/features/transactions/types';
import { formatDisplayDate } from '@/lib/dateUtils';
import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/Icon';

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
  // Pagination is enabled by default. The grid paginates client-side over the
  // rows it receives; the backend already bounds each response to a maximum page
  // size (Performance P-1), so this keeps the DOM light without loading an
  // unbounded set. Callers can disable it (e.g. embedded summary views).
  pagination?: boolean;
  paginationPageSize?: number;
}

// Page-size choices offered in the grid footer. The active paginationPageSize
// must be one of these for AG Grid's selector to render correctly.
const PAGINATION_PAGE_SIZE_OPTIONS = [25, 50, 100];

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
// Cell renderer for account name that prepends the icon/color circle when set.
// Takes the translate function so the "[Deleted Account]" fallback is localized.
function AccountNameRenderer(params: ICellRendererParams<TransactionRead>, t: TFunction) {
  const transaction = params.data;
  const accountName = params.value || t('transactions.deletedAccount');

  if (!transaction || (!transaction.account_icon && !transaction.account_color)) {
    return <span>{accountName}</span>;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
      <Box
        sx={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: transaction.account_color ?? 'transparent',
          border: transaction.account_color ? 'none' : '1px dashed',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {transaction.account_icon && (
          <Icon
            name={transaction.account_icon as IconName}
            size={10}
            style={{ color: transaction.account_color ? '#fff' : 'inherit' }}
          />
        )}
      </Box>
      <span>{accountName}</span>
    </Box>
  );
}

// Cell renderer for category that prepends the icon/color circle when set.
// Takes the translate function so the "Uncategorized" fallback is localized.
function CategoryNameRenderer(params: ICellRendererParams<TransactionRead>, t: TFunction) {
  const transaction = params.data;
  const categoryName = params.value || t('transactions.uncategorized');

  if (!transaction || (!transaction.category_icon && !transaction.category_color)) {
    return <span>{categoryName}</span>;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
      <Box
        sx={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: transaction.category_color ?? 'transparent',
          border: transaction.category_color ? 'none' : '1px dashed',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {transaction.category_icon && (
          <Icon
            name={transaction.category_icon as IconName}
            size={10}
            style={{ color: transaction.category_color ? '#fff' : 'inherit' }}
          />
        )}
      </Box>
      <span>{categoryName}</span>
    </Box>
  );
}

export function AgTransactionsGrid({
  transactions,
  isLoading = false,
  filters,
  onRowClick,
  onSelectionChange,
  height = 600,
  pagination = true,
  paginationPageSize = 25,
}: AgTransactionsGridProps) {
  const { t, i18n } = useTranslation();

  // Define column configurations with formatters and custom renderers
  // These columns match the TransactionRead interface and provide proper display.
  // Recomputed when the language changes so headers/formatters re-localize.
  const columnDefinitions: ColDef<TransactionRead>[] = useMemo(() => [
    {
      field: 'transaction_date',
      headerName: t('transactions.colDate'),
      sortable: true,
      sort: 'desc', // Default sort by date descending (most recent first)
      width: 120,
      valueFormatter: (params) => {
        // Format ISO date string to dd-MMM-yyyy using shared utility
        if (!params.value) return '';
        return formatDisplayDate(params.value);
      },
    },
    {
      field: 'category_name',
      headerName: t('transactions.colCategory'),
      sortable: true,
      filter: true, // Enable AG Grid text filter - icon appears next to header
      width: 170,
      // Custom renderer to show category color circle and icon alongside the name
      cellRenderer: (params: ICellRendererParams<TransactionRead>) => CategoryNameRenderer(params, t),
    },
    {
      field: 'amount',
      headerName: t('transactions.colAmount'),
      sortable: true,
      width: 130,
      type: 'rightAligned', // Align numbers to the right for better readability
      valueFormatter: (params) => {
        // Format amount as currency using the transaction's currency code
        if (!params.value || !params.data) return '';
        try {
          const amount = Number(params.value);
          const currency = params.data.currency || 'BRL';
          return new Intl.NumberFormat('pt-BR', {
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
      field: 'description',
      headerName: t('transactions.colDescription'),
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
      headerName: t('transactions.colAccount'),
      sortable: true,
      filter: true, // Enable AG Grid text filter - icon appears next to header
      width: 170,
      // Custom renderer to show account color circle and icon alongside the name
      cellRenderer: (params: ICellRendererParams<TransactionRead>) => AccountNameRenderer(params, t),
    },
    {
      field: 'transaction_type',
      headerName: t('transactions.colType'),
      sortable: true,
      width: 100,
      // Localize the transaction type enum (expense -> Expense / Despesa)
      valueFormatter: (params) => {
        if (!params.value) return '';
        return t(`enums.transactionType.${params.value}`);
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
    {
      field: 'created_by_name',
      headerName: t('transactions.colCreatedBy'),
      sortable: true,
      width: 140,
      valueFormatter: (params) => {
        // Show the creator's display name, or "Unknown" if the user has no name set
        return params.value || t('transactions.unknownUser');
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, i18n.language]);

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
        <Typography variant="body1">{t('common.loading')}</Typography>
      </Box>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

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
          {t('transactions.noTransactionsFound')}
        </Typography>
      </Box>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

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
        pagination={pagination}
        paginationPageSize={paginationPageSize}
        paginationPageSizeSelector={PAGINATION_PAGE_SIZE_OPTIONS}
        domLayout="normal" // Use normal layout with fixed height
      />
    </Box>
  );
}
