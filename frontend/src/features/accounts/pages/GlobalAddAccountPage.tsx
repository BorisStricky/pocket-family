// src/features/accounts/pages/GlobalAddAccountPage.tsx
// Page for creating new accounts in global context (no automatic family sharing)

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Alert,
  Button,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { AccountForm } from '../components/AccountForm';
import { useCreateAccount } from '../hooks/useCreateAccount';
import type { AccountCreate } from '@/types/account';

/**
 * GlobalAddAccountPage - Page for creating new accounts in global context
 *
 * Features:
 * - Renders AccountForm in create mode
 * - NO automatic family sharing (unlike AddAccountPage)
 * - User owns account and can share it later if desired
 * - Shows success message after creation
 * - Shows error message if creation fails
 * - Navigates back to global accounts list on success or cancel
 * - Loading state during account creation
 *
 * Route: /app/accounts/new
 * Protected: Yes (requires authentication but NOT family membership)
 *
 * When creating an account in global context:
 * - Account is NOT automatically shared with any family
 * - User remains the sole account owner (user_id set by backend from JWT)
 * - User can share the account with families later via account settings
 *
 * This allows users to create personal accounts that aren't immediately
 * visible to any family, providing more control over account visibility
 *
 * @example
 * // Route configuration:
 * <Route path="/app/accounts/new" element={<GlobalAddAccountPage />} />
 */
export function GlobalAddAccountPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Track error state for displaying error messages
  const [error, setError] = useState<string | null>(null);

  // Track success state to show confirmation before navigation
  const [isSuccess, setIsSuccess] = useState(false);

  // Mutation hook for creating account in global context (no familyId)
  const { mutate: createAccount, isPending } = useCreateAccount();

  // Navigate back to global accounts list
  const handleBack = () => {
    navigate('/app/accounts');
  };

  // Handle form submission - create account WITHOUT family sharing
  const handleSubmit = (data: AccountCreate) => {
    // Clear any previous errors
    setError(null);

    // DO NOT add share_with field - account will be created without any shares
    // User can add shares later if desired via account settings
    const accountData: AccountCreate = {
      ...data,
      // share_with intentionally omitted - no automatic sharing in global context
    };

    // Call mutation to create account
    createAccount(accountData, {
      onSuccess: (newAccount) => {
        // Show success state briefly before navigating
        // This provides user feedback that account was created
        setIsSuccess(true);

        // Navigate to the new account's detail page after short delay
        // This allows user to see the account they just created
        setTimeout(() => {
          navigate(`/app/accounts/${newAccount.id}`);
        }, 1000);
      },
      onError: (err) => {
        // Show error message inline using Alert component
        // Follows existing pattern throughout the accounts feature
        setError((err as Error).message || t('accounts.failedToCreate'));
        setIsSuccess(false);
      },
    });
  };

  // Handle form cancel - navigate back without saving
  const handleCancel = () => {
    handleBack();
  };

  return (
    <Box p={3}>
      {/* Back Button */}
      <Button
        variant="text"
        onClick={handleBack}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
        disabled={isPending}
      >
        {t('accounts.backToAllAccounts')}
      </Button>

      {/* Success Message */}
      {isSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t('accounts.accountCreatedSuccess')}
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
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isPending}
        />
      </Paper>
    </Box>
  );
}
