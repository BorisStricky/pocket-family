// src/features/budgets/components/BudgetsList.tsx
// AG Grid table component for displaying budgets with progress bars and category chips
//
// Shows each budget's name, amount limit, currency, spent amount, spending progress,
// associated categories, and action buttons (edit/delete). The progress bar uses
// color coding to indicate spending status: green (under 80%), yellow (80-99%),
// and red (100%+, over budget).

import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Box, Chip, IconButton, LinearProgress, Stack, Typography } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { BudgetRead } from '../types';

/**
 * Props for the BudgetsList component
 *
 * onEdit and onDelete callbacks receive the full budget object so the parent
 * can open the appropriate modal with the budget data pre-populated.
 */
interface BudgetsListProps {
  budgets: BudgetRead[];
  isLoading?: boolean;
  onEdit: (budget: BudgetRead) => void;
  onDelete: (budget: BudgetRead) => void;
  height?: string | number;
}

/**
 * Formats a numeric value as currency using the browser's Intl API
 *
 * Uses 'en-US' locale for consistent formatting regardless of user's locale.
 * Falls back to plain number string if formatting fails (e.g., invalid currency code).
 */
function formatCurrency(value: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}

/**
 * Determines the progress bar color based on spending percentage thresholds
 *
 * Green: under 80% spent (healthy)
 * Yellow/Orange: 80-99% spent (approaching limit)
 * Red: 100%+ spent (over budget)
 */
function getProgressColor(spentPercentage: number): 'success' | 'warning' | 'error' {
  if (spentPercentage >= 100) return 'error';
  if (spentPercentage >= 80) return 'warning';
  return 'success';
}

/**
 * BudgetsList Component
 *
 * Displays budgets in an AG Grid table with custom cell renderers for:
 * - Currency-formatted amounts (amount and spent columns)
 * - Color-coded progress bars showing spent-vs-limit ratio
 * - Category chips (or "All Categories" label for universal budgets)
 * - Edit and delete action buttons per row
 *
 * Uses the same AG Grid Community setup as AgTransactionsGrid for consistency.
 */
export function BudgetsList({
  budgets,
  isLoading = false,
  onEdit,
  onDelete,
  height = 500,
}: BudgetsListProps) {
  // Column definitions for the AG Grid
  // Each column maps to a BudgetRead field with appropriate formatting
  const columnDefinitions: ColDef<BudgetRead>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        sortable: true,
        flex: 1,
        minWidth: 150,
      },
      {
        field: 'amount',
        headerName: 'Amount',
        sortable: true,
        width: 140,
        type: 'rightAligned',
        // Format budget limit amount as currency using the budget's currency code
        valueFormatter: (params) => {
          if (params.value == null || !params.data) return '';
          return formatCurrency(Number(params.value), params.data.currency);
        },
      },
      {
        field: 'currency',
        headerName: 'Currency',
        sortable: true,
        width: 100,
      },
      {
        field: 'spent',
        headerName: 'Spent',
        sortable: true,
        width: 140,
        type: 'rightAligned',
        // Format spent amount as currency, matching the budget's currency code
        valueFormatter: (params) => {
          if (params.value == null || !params.data) return '';
          return formatCurrency(Number(params.value), params.data.currency);
        },
      },
      {
        headerName: 'Progress',
        width: 180,
        sortable: false,
        // Custom cell renderer showing a color-coded progress bar with percentage text
        // The bar visually indicates how much of the budget has been consumed
        cellRenderer: (params: { data: BudgetRead | undefined }) => {
          if (!params.data) return null;
          const budgetAmount = Number(params.data.amount);
          const spentAmount = Number(params.data.spent);
          // Guard against division by zero (should not happen since amount must be > 0)
          const spentPercentage = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
          const progressColor = getProgressColor(spentPercentage);

          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', height: '100%' }}>
              <LinearProgress
                variant="determinate"
                // Cap visual progress at 100% to prevent overflow, but display actual percentage in text
                value={Math.min(spentPercentage, 100)}
                color={progressColor}
                sx={{ flex: 1, height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
                {Math.round(spentPercentage)}%
              </Typography>
            </Box>
          );
        },
      },
      {
        headerName: 'Categories',
        flex: 1,
        minWidth: 200,
        sortable: false,
        // Custom cell renderer showing category names as MUI Chips
        // Universal budgets (no categories) show a single "All Categories" chip
        cellRenderer: (params: { data: BudgetRead | undefined }) => {
          if (!params.data) return null;
          const budgetCategories = params.data.categories;

          // Universal budget: no specific categories means it tracks all spending
          if (!budgetCategories || budgetCategories.length === 0) {
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <Chip label="All Categories" size="small" variant="outlined" color="info" />
              </Box>
            );
          }

          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%', flexWrap: 'wrap' }}>
              {budgetCategories.map((category) => (
                <Chip key={category.id} label={category.name} size="small" variant="outlined" />
              ))}
            </Box>
          );
        },
      },
      {
        headerName: 'Actions',
        width: 120,
        sortable: false,
        // Action buttons for editing and deleting individual budgets
        // Stops event propagation to prevent row click from firing when buttons are clicked
        cellRenderer: (params: { data: BudgetRead | undefined }) => {
          if (!params.data) return null;
          const budget = params.data;

          return (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: '100%' }}>
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(budget);
                }}
                aria-label={`Edit budget ${budget.name}`}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(budget);
                }}
                aria-label={`Delete budget ${budget.name}`}
                color="error"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          );
        },
      },
    ],
    [onEdit, onDelete]
  );

  // Loading overlay shown while budget data is being fetched
  const loadingOverlayComponent = useMemo(() => {
    return () => (
      <Box display="flex" alignItems="center" justifyContent="center" height="100%">
        <Typography variant="body1">Loading budgets...</Typography>
      </Box>
    );
  }, []);

  // Empty state overlay shown when no budgets exist for the tenant
  const noRowsOverlayComponent = useMemo(() => {
    return () => (
      <Box display="flex" alignItems="center" justifyContent="center" height="100%">
        <Typography variant="body1" color="text.secondary">
          No budgets found
        </Typography>
      </Box>
    );
  }, []);

  return (
    <Box
      className="ag-theme-alpine"
      style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }}
    >
      <AgGridReact<BudgetRead>
        rowData={budgets}
        columnDefs={columnDefinitions}
        theme="legacy"
        defaultColDef={{
          resizable: true,
          filter: false,
        }}
        loading={isLoading}
        loadingOverlayComponent={loadingOverlayComponent}
        noRowsOverlayComponent={noRowsOverlayComponent}
        animateRows={true}
        pagination={false}
        domLayout="normal"
        // Set row height to accommodate category chips which may wrap
        rowHeight={48}
      />
    </Box>
  );
}
