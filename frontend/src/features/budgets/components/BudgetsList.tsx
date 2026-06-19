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
import { useTranslation } from 'react-i18next';
import type { BudgetRead } from '../types';
import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/Icon';

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
  // useTranslation provides t() for column headers and cell labels;
  // i18n.language is included in useMemo deps so columns re-render when language changes
  const { t, i18n } = useTranslation();

  // Column definitions for the AG Grid
  // Each column maps to a BudgetRead field with appropriate formatting
  const columnDefinitions: ColDef<BudgetRead>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: t('budgets.colName'),
        sortable: true,
        flex: 1,
        minWidth: 150,
        // Render budget name with a leading icon/color circle when set
        cellRenderer: (params: { data: BudgetRead | undefined; value: string }) => {
          const budget = params.data;
          if (!budget) return <span>{params.value}</span>;

          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
              {/* Only render the colored circle when at least one of icon/color is set */}
              {(budget.icon || budget.color) && (
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: budget.color ?? 'transparent',
                    border: budget.color ? 'none' : '1px dashed',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {budget.icon && (
                    <Icon
                      name={budget.icon as IconName}
                      size={11}
                      style={{ color: budget.color ? '#fff' : 'inherit' }}
                    />
                  )}
                </Box>
              )}
              <span>{budget.name}</span>
            </Box>
          );
        },
      },
      {
        field: 'amount',
        headerName: t('budgets.colAmount'),
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
        headerName: t('budgets.colCurrency'),
        sortable: true,
        width: 100,
      },
      {
        field: 'spent',
        headerName: t('budgets.colSpent'),
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
        headerName: t('budgets.colProgress'),
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
        headerName: t('budgets.colCategories'),
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
                <Chip label={t('budgets.allCategories')} size="small" variant="outlined" color="info" />
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
        headerName: t('budgets.colActions'),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onEdit, onDelete, i18n.language]
  );

  // Loading overlay shown while budget data is being fetched
  // Recreated when language changes so the translated text stays current
  const loadingOverlayComponent = useMemo(() => {
    return () => (
      <Box display="flex" alignItems="center" justifyContent="center" height="100%">
        <Typography variant="body1">{t('budgets.loadingBudgets')}</Typography>
      </Box>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  // Empty state overlay shown when no budgets exist for the tenant
  // Recreated when language changes so the translated text stays current
  const noRowsOverlayComponent = useMemo(() => {
    return () => (
      <Box display="flex" alignItems="center" justifyContent="center" height="100%">
        <Typography variant="body1" color="text.secondary">
          {t('budgets.noBudgetsFound')}
        </Typography>
      </Box>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

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
