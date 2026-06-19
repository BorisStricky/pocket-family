// src/features/accounts/pages/AddAccountPage.tsx
// Page for creating new accounts within family context

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Alert,
  Button,
  Stack,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { AccountForm } from '../components/AccountForm';
import { useCreateAccount } from '../hooks/useCreateAccount';
import type { AccountCreate } from '@/types/account';

/**
 * AddAccountPage - Page for creating new accounts
 *
 * Features:
 * - Renders AccountForm in create mode
 * - Automatically shares account with current family (sets share_with)
 * - Shows success message after creation
 * - Shows error message if creation fails
 * - Navigates back to accounts list on success or cancel
 * - Loading state during account creation
 *
 * Route: /app/:familyId/accounts/new
 * Protected: Yes (requires authentication and family membership via FamilyGuard)
 *
 * When creating an account within family context:
 * - Account is automatically shared with the family (share_with: { tenant_id: familyId, visibility: 'visible' })
 * - This ensures family members can see the new account immediately
 * - User remains the account owner (user_id set by backend from JWT)
 *
 * @example
 * // Route configuration:
 * <Route path="/app/:familyId/accounts/new" element={<AddAccountPage />} />
 */
export function AddAccountPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Track error state for displaying error messages
  const [error, setError] = useState<string | null>(null);

  // Track success state to show confirmation before navigation
  const [isSuccess, setIsSuccess] = useState(false);

  // Mutation hook for creating account with family context for cache invalidation
  const { mutate: createAccount, isPending } = useCreateAccount(familyId);

  // Navigate back to accounts list
  const handleBack = () => {
    navigate(`/app/${familyId}/accounts`);
  };

  // Handle form submission - create account with family sharing
  const handleSubmit = (data: AccountCreate) => {
    // Clear any previous errors
    setError(null);

    // Add share_with to automatically share account with current family
    // This allows all family members to see the account in their accounts list
    // Visibility is set to 'visible' so balance is shown to family members
    const accountData: AccountCreate = {
      ...data,
      share_with: {
        tenant_id: familyId!,
        visibility: 'visible',
      },
    };

    // Call mutation to create account
    createAccount(accountData, {
      onSuccess: () => {
        // Show success state briefly before navigating
        // This provides user feedback that account was created
        setIsSuccess(true);

        // Navigate back to accounts list after short delay
        // The delay allows user to see success message
        setTimeout(() => {
          handleBack();
        }, 1000);
      },
      onError: (err) => {
        // Show error message inline using Alert component
        // Follows existing pattern in AccountsPage and FamilyAccountDetailPage
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
        {t('accounts.backToAccounts')}
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
