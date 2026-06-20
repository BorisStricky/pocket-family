// src/features/transactions/components/BulkActions.tsx
// Toolbar component for performing bulk operations on selected transactions

import React, { useState } from 'react';
import { Box, Button, Typography, Stack, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ClearIcon from '@mui/icons-material/Clear';
import { DeleteConfirmDialog } from '@/components/ui/molecules/DeleteConfirmDialog';

/**
 * Props for BulkActions component
 */
interface BulkActionsProps {
  selectedIds: string[];
  onDelete: () => void;
  onExport?: () => void;
  onClearSelection?: () => void;
}

/**
 * Toolbar for performing bulk actions on selected transactions
 *
 * Features:
 * - Shows count of selected transactions
 * - Delete button with confirmation dialog
 * - Optional export button for CSV export
 * - Clear selection button
 * - Hidden when no transactions are selected
 *
 * The delete action uses a confirmation dialog to prevent accidental
 * deletion of multiple transactions. The dialog clearly states how many
 * transactions will be deleted and that the action cannot be undone.
 *
 * @example
 * <BulkActions
 *   selectedIds={selectedTransactionIds}
 *   onDelete={() => handleBulkDelete(selectedTransactionIds)}
 *   onExport={() => handleExport(selectedTransactionIds)}
 *   onClearSelection={() => setSelectedTransactionIds([])}
 * />
 */
export function BulkActions({
  selectedIds,
  onDelete,
  onExport,
  onClearSelection,
}: BulkActionsProps) {
  const { t } = useTranslation();
  // Track delete confirmation dialog open state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const selectedCount = selectedIds.length;

  // Don't render anything if no transactions are selected
  // This keeps the UI clean when not in selection mode
  if (selectedCount === 0) {
    return null;
  }

  // Handle delete confirmation
  // Close dialog and trigger delete callback
  const handleConfirmDelete = () => {
    setDeleteDialogOpen(false);
    onDelete();
  };

  return (
    <>
      {/* Bulk Actions Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          backgroundColor: 'action.selected',
          borderRadius: 1,
          mb: 2,
        }}
      >
        {/* Selection Count Display */}
        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            label={selectedCount}
            color="primary"
            size="small"
          />
          <Typography variant="body1">
            {t('transactions.selectedSuffix', { count: selectedCount })}
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Stack direction="row" spacing={1}>
          {/* Clear Selection Button */}
          {onClearSelection && (
            <Button
              onClick={onClearSelection}
              startIcon={<ClearIcon />}
              size="small"
            >
              {t('transactions.clearSelection')}
            </Button>
          )}

          {/* Export Button - Optional Feature for Future CSV Export */}
          {onExport && (
            <Button
              onClick={onExport}
              startIcon={<FileDownloadIcon />}
              variant="outlined"
              size="small"
            >
              {t('transactions.exportCsv')}
            </Button>
          )}

          {/* Delete Button - Opens Confirmation Dialog */}
          <Button
            onClick={() => setDeleteDialogOpen(true)}
            startIcon={<DeleteIcon />}
            color="error"
            variant="contained"
            size="small"
          >
            {t('transactions.deleteSelected')}
          </Button>
        </Stack>
      </Box>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        title={t('transactions.deleteTransactionsTitle')}
        message={t('transactions.deleteTransactionsMessage', { count: selectedCount })}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </>
  );
}
