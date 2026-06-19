// src/features/accounts/pages/FamilyAccountDetailPage.tsx
// Account detail page showing account info and filtered transactions within family context

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

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
      onError: (error: any) => {
        // Close dialog and show error message
        setDeleteDialogOpen(false);

        // Check for 409 Conflict error indicating account is shared with multiple families
        if (error.status === 409) {
          // Show specific message for multi-shared account conflict
          // Guide user to delete from main accounts page instead
          setDeleteError(t('accounts.deleteAccountMultiFamilyError'));
        } else {
          // Backend may return other errors:
          // - 404 if account not found
          // - 403 if user doesn't have permission to delete
          // - 400 for other validation errors
          const errorMessage = error.message || t('accounts.deleteAccountFailed');
          setDeleteError(errorMessage);
        }
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
            ? t('accounts.loadAccountError', { message: (accountError as Error).message })
            : t('accounts.accountNotFound')}
        </Alert>
        <Button
          variant="outlined"
          onClick={handleBack}
          sx={{ mt: 2 }}
          startIcon={<ArrowBackIcon />}
        >
          {t('accounts.backToAccounts')}
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
        {t('accounts.backToAccounts')}
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
            {isDeleting ? t('common.deleting') : t('accounts.deleteAccount')}
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
        {t('accounts.transactions')}
      </Typography>

      {/* Show error if transactions fetch failed */}
      {transactionsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('accounts.loadTransactionsError', { message: (transactionsError as Error).message })}
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
          {t('accounts.showingTransactionsForFamily')}
        </Typography>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        title={t('accounts.deleteAccount')}
        message={
          transactions.length > 0
            ? t('accounts.deleteAccountConfirmWithTransactions', { count: transactions.length })
            : t('accounts.deleteAccountConfirmNoTransactions')
        }
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        confirmButtonText={isDeleting ? t('common.deleting') : t('common.delete')}
      />

      {/* Share Account Dialog */}
      <ShareAccountDialog
        accountId={accountId!}
        open={shareDialogOpen}
        onClose={handleShareDialogClose}
        currentFamilyId={familyId}
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
