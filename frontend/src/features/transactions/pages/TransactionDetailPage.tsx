// src/features/transactions/pages/TransactionDetailPage.tsx
// Page for viewing and editing a single transaction with delete functionality

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Paper,
  IconButton,
  Stack,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { TransactionForm } from '../components/TransactionForm';
import { DeleteConfirmDialog } from '@/components/ui/molecules/DeleteConfirmDialog';
import { useTransaction } from '../hooks/useTransaction';
import { useUpdateTransaction } from '../hooks/useUpdateTransaction';
import { useDeleteTransaction } from '../hooks/useDeleteTransaction';
import type { TransactionUpdate } from '../types';

/**
 * TransactionDetailPage Component
 *
 * Page for viewing, editing, and deleting a single transaction
 *
 * Features:
 * - Fetch and display transaction details
 * - TransactionForm in edit mode with pre-populated data
 * - Update transaction with form submission
 * - Delete button with confirmation dialog
 * - Back button to return to transactions list
 * - Loading state while fetching transaction
 * - Error state if transaction not found or fetch fails
 * - Success handling for both update and delete operations
 *
 * The page uses three mutation hooks:
 * - useTransaction: Fetches the transaction data for display
 * - useUpdateTransaction: Updates the transaction when form is submitted
 * - useDeleteTransaction: Deletes the transaction when confirmed
 *
 * All mutations automatically invalidate query cache and trigger refetch
 * of the transactions list, ensuring data consistency across the app.
 */
export function TransactionDetailPage() {
  const { t } = useTranslation();
  const { familyId, transactionId } = useParams<{ familyId: string; transactionId: string }>();
  const navigate = useNavigate();

  // Track delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch transaction data
  const { data: transaction, isLoading, error } = useTransaction(transactionId!);

  // Update mutation
  const { mutate: updateTransaction, isPending: isUpdating, error: updateError } = useUpdateTransaction(transactionId!);

  // Delete mutation
  const { mutate: deleteTransaction, isPending: isDeleting } = useDeleteTransaction();

  // Handle form submission - update transaction
  const handleUpdate = (data: TransactionUpdate) => {
    updateTransaction(data, {
      onSuccess: () => {
        // Navigate back to list page on success
        // The list will automatically refetch to show the updated transaction
        navigate(`/app/${familyId}/transactions`);
      },
    });
  };

  // Handle cancel button - navigate back to list
  const handleCancel = () => {
    navigate(`/app/${familyId}/transactions`);
  };

  // Handle back button - same as cancel
  const handleBack = () => {
    navigate(`/app/${familyId}/transactions`);
  };

  // Handle delete confirmation
  const handleDelete = () => {
    deleteTransaction(transactionId!, {
      onSuccess: () => {
        // Close modal immediately to prevent visual glitch during navigation
        setDeleteDialogOpen(false);
        // Navigate back to list page on successful deletion
        // The list will automatically refetch without the deleted transaction
        navigate(`/app/${familyId}/transactions`);
      },
      onError: (error) => {
        // Log error to help debug why deletion callback isn't running
        console.error('Delete transaction error:', error);
        // Keep modal open on error so user can retry
      },
    });
  };

  // Loading State
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error State - Transaction Not Found or Fetch Error
  if (error || !transaction) {
    return (
      <Box>
        {/* Page Header with Back Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton
            onClick={handleBack}
            sx={{ mr: 2 }}
            aria-label="Go back to transactions list"
          >
            <ArrowBackIcon />
          </IconButton>

          <Typography variant="h4" component="h1">
            {t('transactions.transactionNotFound')}
          </Typography>
        </Box>

        <Paper sx={{ p: 3, bgcolor: 'error.light' }}>
          <Typography color="error.dark" variant="body1">
            {error instanceof Error ? error.message : t('transactions.transactionNotFoundMessage')}
          </Typography>

          <Button
            onClick={handleBack}
            variant="contained"
            sx={{ mt: 2 }}
          >
            {t('transactions.backToTransactions')}
          </Button>
        </Paper>
      </Box>
    );
  }

  // Main Content - Transaction Detail and Edit Form
  return (
    <Box>
      {/* Page Header with Back Button and Delete Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            onClick={handleBack}
            sx={{ mr: 2 }}
            aria-label="Go back to transactions list"
          >
            <ArrowBackIcon />
          </IconButton>

          <Typography variant="h4" component="h1">
            {t('transactions.transactionDetails')}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteDialogOpen(true)}
          disabled={isDeleting}
        >
          {t('common.delete')}
        </Button>
      </Box>

      {/* Form Container */}
      <Paper sx={{ p: 3, maxWidth: 600 }}>
        {/* Error Message Display for Update Errors */}
        {updateError && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: 'error.light',
              borderRadius: 1,
            }}
          >
            <Typography color="error.dark">
              {t('transactions.updateError', { message: updateError instanceof Error ? updateError.message : t('transactions.unknownError') })}
            </Typography>
          </Box>
        )}

        {/* Transaction Form in Edit Mode */}
        <TransactionForm
          familyId={familyId!}
          initialData={transaction}
          onSubmit={handleUpdate}
          onCancel={handleCancel}
          isLoading={isUpdating}
        />
      </Paper>

      {/* Transaction Metadata */}
      <Paper sx={{ p: 2, mt: 2, maxWidth: 600 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t('transactions.transactionInformation')}
        </Typography>

        <Stack spacing={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {t('transactions.created')}
            </Typography>
            <Typography variant="body2">
              {new Date(transaction.created_at).toLocaleString()}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {t('transactions.lastUpdated')}
            </Typography>
            <Typography variant="body2">
              {new Date(transaction.updated_at).toLocaleString()}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {t('transactions.transactionId')}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {transaction.id}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        title={t('transactions.deleteTransactionTitle')}
        message={t('transactions.deleteTransactionMessage')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}
