// src/features/accounts/pages/EditAccountPage.tsx
// Page for editing existing accounts within family context

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Alert,
  Button,
  CircularProgress,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { AccountForm } from '../components/AccountForm';
import { useAccount } from '../hooks/useAccount';
import { useUpdateAccount } from '../hooks/useUpdateAccount';
import type { AccountCreate, AccountUpdate } from '@/types/account';

/**
 * EditAccountPage - Page for editing existing accounts
 *
 * Features:
 * - Fetches account data and pre-populates form
 * - Renders AccountForm in edit mode with initial data
 * - Shows success message after update
 * - Shows error message if update fails
 * - Navigates back to account detail page on success or cancel
 * - Loading state while fetching account
 * - Loading state during account update
 *
 * Route: /app/:familyId/accounts/:accountId/edit
 * Protected: Yes (requires authentication and family membership via FamilyGuard)
 *
 * Only the account owner can edit account details
 * Backend enforces this via JWT user_id check
 *
 * @example
 * // Route configuration:
 * <Route path="/app/:familyId/accounts/:accountId/edit" element={<EditAccountPage />} />
 */
export function EditAccountPage() {
  const { familyId, accountId } = useParams<{
    familyId: string;
    accountId: string;
  }>();
  const navigate = useNavigate();

  // Track error state for displaying error messages
  const [error, setError] = useState<string | null>(null);

  // Track success state to show confirmation before navigation
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch account data to pre-populate form
  const {
    data: account,
    isLoading: isLoadingAccount,
    error: fetchError,
  } = useAccount(accountId!);

  // Mutation hook for updating account
  const { mutate: updateAccount, isPending: isUpdating } = useUpdateAccount();

  // Navigate back to account detail page
  const handleBack = () => {
    navigate(`/app/${familyId}/accounts/${accountId}`);
  };

  // Handle form submission - update account with partial data
  const handleSubmit = (data: AccountCreate) => {
    // Clear any previous errors
    setError(null);

    // Convert AccountCreate to AccountUpdate
    // AccountUpdate accepts all fields as optional (partial update)
    // Convert balance to number if provided (backend expects number)
    const updateData: AccountUpdate = {
      name: data.name,
      type: data.type,
      currency: data.currency,
      // Balance may be string from form, convert to number if valid
      balance: data.balance !== undefined && data.balance !== ''
        ? Number(data.balance)
        : undefined,
    };

    // Call mutation to update account
    updateAccount(
      { accountId: accountId!, data: updateData },
      {
        onSuccess: () => {
          // Show success state briefly before navigating
          // This provides user feedback that account was updated
          setIsSuccess(true);

          // Navigate back to detail page after short delay
          // The delay allows user to see success message
          setTimeout(() => {
            handleBack();
          }, 1000);
        },
        onError: (err) => {
          // Show error message inline using Alert component
          // Follows existing pattern in other pages
          setError((err as Error).message || 'Failed to update account');
          setIsSuccess(false);
        },
      }
    );
  };

  // Handle form cancel - navigate back without saving
  const handleCancel = () => {
    handleBack();
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
  if (fetchError || !account) {
    return (
      <Box p={3}>
        <Alert severity="error">
          {fetchError
            ? `Failed to load account: ${(fetchError as Error).message}`
            : 'Account not found'}
        </Alert>
        <Button
          variant="outlined"
          onClick={handleBack}
          sx={{ mt: 2 }}
          startIcon={<ArrowBackIcon />}
        >
          Back to Account
        </Button>
      </Box>
    );
  }

  // Convert AccountRead to AccountCreate format for form initialData
  // This ensures the form can be pre-populated with existing values
  const initialData: Partial<AccountCreate> = {
    name: account.name,
    type: account.type,
    currency: account.currency,
    // Balance may be null for hidden accounts, use '0' as fallback
    balance: account.balance !== null ? account.balance : '0',
  };

  return (
    <Box p={3}>
      {/* Back Button */}
      <Button
        variant="text"
        onClick={handleBack}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
        disabled={isUpdating}
      >
        Back to Account
      </Button>

      {/* Success Message */}
      {isSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Account updated successfully! Redirecting...
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Account Form in Paper Container */}
      <Paper elevation={2} sx={{ p: 3, maxWidth: 600 }}>
        <AccountForm
          mode="edit"
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isUpdating}
        />
      </Paper>
    </Box>
  );
}
