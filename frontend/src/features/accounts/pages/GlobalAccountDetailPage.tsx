// src/features/accounts/pages/GlobalAccountDetailPage.tsx
// Global account detail page showing account info without family context

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
import { AccountShareList } from '../components/AccountShareList';
import { ShareAccountDialog } from '../components/ShareAccountDialog';
import { EditShareDialog } from '../components/EditShareDialog';
import { AgTransactionsGrid } from '@/components/domain/ag/AgTransactionsGrid';
import { DeleteConfirmDialog } from '@/components/ui/molecules/DeleteConfirmDialog';
import { useAccount } from '../hooks/useAccount';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { AccountShareRead } from '@/types/account';

/**
 * GlobalAccountDetailPage - Account detail view in global context (no family scope)
 *
 * Features:
 * - Displays account summary with current balance
 * - Shows ALL transactions for this account across all families
 * - Edit button to modify account details (if owner)
 * - Delete button to remove account (if owner)
 * - Back button to return to global accounts list
 * - Loading states for account and transactions
 * - Error handling with user-friendly messages
 *
 * Route: /app/accounts/:accountId
 * Protected: Yes (requires authentication but NOT family membership)
 *
 * Unlike FamilyAccountDetailPage, this page shows all transactions for the account
 * regardless of which family they belong to, providing a complete account history
 *
 * @example
 * // Route configuration:
 * <Route path="/app/accounts/:accountId" element={<GlobalAccountDetailPage />} />
 */
export function GlobalAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();

  // Get current authenticated user to determine ownership
  const { user } = useAuth();

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // State for delete error messages
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // State for share dialogs
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editShareDialogOpen, setEditShareDialogOpen] = useState(false);
  const [selectedShare, setSelectedShare] = useState<AccountShareRead | null>(null);

  // Fetch account details
  const {
    data: account,
    isLoading: isLoadingAccount,
    error: accountError,
  } = useAccount(accountId!);

  // Fetch ALL transactions for this account across all families
  // Pass undefined as familyId to get global transactions filtered by account only
  const {
    data: transactions = [],
    isLoading: isLoadingTransactions,
    error: transactionsError,
  } = useTransactions(undefined, {
    account_id: accountId,
  });

  // Mutation hook for deleting account in global context (no familyId)
  // This passes fromFamilyContext=false to the API allowing multi-shared accounts to be deleted
  const { mutate: deleteAccountMutation, isPending: isDeleting } = useDeleteAccount();

  // Navigate back to global accounts list
  const handleBack = () => {
    navigate('/app/accounts');
  };

  // Navigate to edit account page in global context
  // Note: This would need a GlobalEditAccountPage component
  const handleEdit = () => {
    // TODO: Create GlobalEditAccountPage or reuse EditAccountPage with optional familyId
    navigate(`/app/accounts/${accountId}/edit`);
  };

  // Open delete confirmation dialog
  const handleDelete = () => {
    // Clear any previous errors
    setDeleteError(null);
    // Open confirmation dialog
    setDeleteDialogOpen(true);
  };

  // Confirm deletion - call mutation to delete account globally
  const handleConfirmDelete = () => {
    deleteAccountMutation(accountId!, {
      onSuccess: () => {
        // Navigate back to global accounts list after successful deletion
        // Query cache is automatically invalidated by the hook
        navigate('/app/accounts');
      },
      onError: (error: any) => {
        // Close dialog and show error message
        setDeleteDialogOpen(false);

        // In global context, multi-shared accounts can be deleted
        // Backend handles cascading share deletions and transaction updates
        const errorMessage = error.message || 'Failed to delete account';
        setDeleteError(errorMessage);
      },
    });
  };

  // Cancel deletion - close dialog
  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
  };

  // Handle transaction row click - navigate to transaction detail
  // Use global transaction detail route if available, or family route
  const handleTransactionClick = (transaction: any) => {
    // If transaction has a tenant_id, navigate to family-scoped detail
    // Otherwise, would need a global transaction detail page
    if (transaction.tenant_id) {
      navigate(`/app/${transaction.tenant_id}/transactions/${transaction.id}`);
    }
  };

  // Handle opening share account dialog
  const handleShareClick = () => {
    setShareDialogOpen(true);
  };

  // Handle opening edit share dialog
  const handleEditShare = (share: AccountShareRead) => {
    setSelectedShare(share);
    setEditShareDialogOpen(true);
  };

  // Handle closing share dialog
  const handleShareDialogClose = () => {
    setShareDialogOpen(false);
  };

  // Handle closing edit share dialog
  const handleEditShareDialogClose = () => {
    setEditShareDialogOpen(false);
    setSelectedShare(null);
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
          Back to All Accounts
        </Button>
      </Box>
    );
  }

  // Determine if current user is account owner (for showing edit/delete/share buttons)
  // Compare current user ID with account owner ID
  const isOwner = user?.id === account.user_id;

  return (
    <Box p={3}>
      {/* Back Button */}
      <Button
        variant="text"
        onClick={handleBack}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to All Accounts
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

      {/* Account Sharing Section (Owner Only) */}
      {isOwner && (
        <Box mb={4}>
          <AccountShareList
            accountId={accountId!}
            isOwner={isOwner}
            onShareClick={handleShareClick}
            onEditShare={handleEditShare}
          />
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Transactions Section */}
      <Typography variant="h5" component="h2" gutterBottom>
        All Transactions
      </Typography>

      {/* Show error if transactions fetch failed */}
      {transactionsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load transactions: {(transactionsError as Error).message}
        </Alert>
      )}

      {/* Transactions Grid showing all transactions for this account */}
      <AgTransactionsGrid
        transactions={transactions}
        isLoading={isLoadingTransactions}
        onRowClick={handleTransactionClick}
        height={400}
      />

      {/* Helpful hint below grid when transactions exist */}
      {!isLoadingTransactions && transactions.length > 0 && (
        <Typography variant="body2" color="text.secondary" mt={2}>
          Showing all transactions for this account across all families
        </Typography>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        title="Delete Account"
        message={
          transactions.length > 0
            ? `This account has ${transactions.length} transaction(s). Deleting this account will set their account_id to NULL, preserving transaction history. Are you sure you want to continue? This action cannot be undone.`
            : 'Are you sure you want to delete this account? This action cannot be undone.'
        }
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        confirmButtonText={isDeleting ? 'Deleting...' : 'Delete'}
      />

      {/* Share Account Dialog */}
      <ShareAccountDialog
        accountId={accountId!}
        open={shareDialogOpen}
        onClose={handleShareDialogClose}
        currentFamilyId={undefined}
      />

      {/* Edit Share Dialog */}
      <EditShareDialog
        accountId={accountId!}
        share={selectedShare}
        open={editShareDialogOpen}
        onClose={handleEditShareDialogClose}
      />
    </Box>
  );
}
