// src/features/accounts/pages/FamilyAccountDetailPage.tsx
// Account detail page showing account info and filtered transactions within family context

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { AccountSummary } from '../components/AccountSummary';
import { AgTransactionsGrid } from '@/components/domain/ag/AgTransactionsGrid';
import { DeleteConfirmDialog } from '@/components/ui/molecules/DeleteConfirmDialog';
import { useAccount } from '../hooks/useAccount';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';

/**
 * FamilyAccountDetailPage - Account detail view within family context
 *
 * Features:
 * - Displays account summary with current balance
 * - Shows transactions filtered by both family AND account
 * - Edit button to modify account details (if owner)
 * - Delete button to remove account (if owner and no transactions)
 * - Back button to return to accounts list
 * - Loading states for account and transactions
 * - Error handling with user-friendly messages
 *
 * Route: /app/:familyId/accounts/:accountId
 * Protected: Yes (requires authentication and family membership via FamilyGuard)
 *
 * The transactions grid shows only transactions that belong to:
 * 1. The current family (tenant_id filter)
 * 2. The current account (account_id filter)
 *
 * This ensures proper data isolation in multi-tenant context
 *
 * @example
 * // Route configuration:
 * <Route path="/app/:familyId/accounts/:accountId" element={<FamilyAccountDetailPage />} />
 */
export function FamilyAccountDetailPage() {
  const { familyId, accountId } = useParams<{
    familyId: string;
    accountId: string;
  }>();
  const navigate = useNavigate();

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // State for delete error messages
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch account details
  const {
    data: account,
    isLoading: isLoadingAccount,
    error: accountError,
  } = useAccount(accountId!);

  // Fetch transactions filtered by family AND account
  // This double filtering ensures we only show transactions visible in this context
  const {
    data: transactions = [],
    isLoading: isLoadingTransactions,
    error: transactionsError,
  } = useTransactions(familyId!, {
    account_id: accountId,
  });

  // Mutation hook for deleting account with family context for cache invalidation
  const { mutate: deleteAccountMutation, isPending: isDeleting } = useDeleteAccount(familyId);

  // Navigate back to accounts list
  const handleBack = () => {
    navigate(`/app/${familyId}/accounts`);
  };

  // Navigate to edit account page
  const handleEdit = () => {
    navigate(`/app/${familyId}/accounts/${accountId}/edit`);
  };

  // Open delete confirmation dialog
  // Check transaction count to show appropriate warning
  const handleDelete = () => {
    // Clear any previous errors
    setDeleteError(null);
    // Open confirmation dialog
    setDeleteDialogOpen(true);
  };

  // Confirm deletion - call mutation to delete account
  const handleConfirmDelete = () => {
    deleteAccountMutation(accountId!, {
      onSuccess: () => {
        // Navigate back to accounts list after successful deletion
        // Query cache is automatically invalidated by the hook
        navigate(`/app/${familyId}/accounts`);
      },
      onError: (error) => {
        // Close dialog and show error message
        setDeleteDialogOpen(false);

        // Backend returns 409 Conflict if account has transactions
        // or 400 if account cannot be deleted for other reasons
        const errorMessage = (error as Error).message || 'Failed to delete account';

        // Show user-friendly error message
        setDeleteError(errorMessage);
      },
    });
  };

  // Cancel deletion - close dialog
  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
  };

  // Handle transaction row click - navigate to transaction detail
  const handleTransactionClick = (transaction: any) => {
    navigate(`/app/${familyId}/transactions/${transaction.id}`);
  };

  // Show loading state while fetching account
  if (isLoadingAccount) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Show error state if account fetch failed
  if (accountError || !account) {
    return (
      <Box p={3}>
        <Alert severity="error">
          {accountError
            ? `Failed to load account: ${(accountError as Error).message}`
            : 'Account not found'}
        </Alert>
        <Button
          variant="outlined"
          onClick={handleBack}
          sx={{ mt: 2 }}
          startIcon={<ArrowBackIcon />}
        >
          Back to Accounts
        </Button>
      </Box>
    );
  }

  // Determine if current user is account owner (for showing edit/delete buttons)
  // TODO: Get current user ID from auth context to compare with account.user_id
  // For now, we'll show buttons to all users (will be restricted in Milestone 2)
  const isOwner = true; // Placeholder - will be replaced with actual auth check

  return (
    <Box p={3}>
      {/* Back Button */}
      <Button
        variant="text"
        onClick={handleBack}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to Accounts
      </Button>

      {/* Delete Error Message */}
      {deleteError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setDeleteError(null)}>
          {deleteError}
        </Alert>
      )}

      {/* Account Summary Card */}
      <Box mb={4}>
        <AccountSummary
          account={account}
          onEdit={handleEdit}
          showEditButton={isOwner}
        />
      </Box>

      {/* Action Buttons (Owner Only) */}
      {isOwner && (
        <Stack direction="row" spacing={2} mb={3}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </Button>
        </Stack>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Transactions Section */}
      <Typography variant="h5" component="h2" gutterBottom>
        Transactions
      </Typography>

      {/* Show error if transactions fetch failed */}
      {transactionsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load transactions: {(transactionsError as Error).message}
        </Alert>
      )}

      {/* Transactions Grid filtered by account */}
      <AgTransactionsGrid
        transactions={transactions}
        isLoading={isLoadingTransactions}
        onRowClick={handleTransactionClick}
        height={400}
      />

      {/* Helpful hint below grid when transactions exist */}
      {!isLoadingTransactions && transactions.length > 0 && (
        <Typography variant="body2" color="text.secondary" mt={2}>
          Showing transactions for this account in the current family
        </Typography>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        title="Delete Account"
        message={
          transactions.length > 0
            ? `This account has ${transactions.length} transaction(s). Deleting this account may affect those transactions. Are you sure you want to continue? This action cannot be undone.`
            : 'Are you sure you want to delete this account? This action cannot be undone.'
        }
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        confirmButtonText={isDeleting ? 'Deleting...' : 'Delete'}
      />
    </Box>
  );
}
