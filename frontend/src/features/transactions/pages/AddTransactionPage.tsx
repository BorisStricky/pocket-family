// src/features/transactions/pages/AddTransactionPage.tsx
// Page for creating a new transaction with form validation

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Paper, IconButton } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { TransactionForm } from '../components/TransactionForm';
import { useCreateTransaction } from '../hooks/useCreateTransaction';
import type { TransactionCreate } from '../types';

/**
 * AddTransactionPage Component
 *
 * Page for creating a new transaction in the family/tenant context
 *
 * Features:
 * - TransactionForm in create mode with validation
 * - Back button to return to transactions list
 * - Success handling: Shows success message and navigates back to list
 * - Error handling: Displays error message to user
 * - Loading state during API call
 *
 * The form pre-populates tenant_id from URL params and defaults
 * to today's date and "expense" transaction type. Users must select
 * an account and enter an amount before submitting.
 *
 * On successful creation, the useCreateTransaction hook automatically
 * invalidates the transactions query cache, causing the list page to
 * refetch and display the new transaction.
 */
export function AddTransactionPage() {
  const { t } = useTranslation();
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();

  // Create transaction mutation hook
  const { mutate: createTransaction, isPending, error } = useCreateTransaction();

  // Handle form submission
  const handleSubmit = (data: TransactionCreate) => {
    createTransaction(data, {
      onSuccess: () => {
        // Navigate back to list page on success
        // The list will automatically refetch to show the new transaction
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
          {t('transactions.addTransaction')}
        </Typography>
      </Box>

      {/* Form Container */}
      <Paper sx={{ p: 3, maxWidth: 600 }}>
        {/* Error Message Display */}
        {error && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: 'error.light',
              borderRadius: 1,
            }}
          >
            <Typography color="error.dark">
              {t('transactions.createError', { message: error instanceof Error ? error.message : t('transactions.unknownError') })}
            </Typography>
          </Box>
        )}

        {/* Transaction Form */}
        <TransactionForm
          familyId={familyId!}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isPending}
        />
      </Paper>

      {/* Helper Text */}
      <Box sx={{ mt: 2, maxWidth: 600 }}>
        <Typography variant="body2" color="text.secondary">
          {t('transactions.addPageHelper')}
        </Typography>
      </Box>
    </Box>
  );
}
