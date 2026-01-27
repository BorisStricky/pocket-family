// src/features/accounts/pages/AccountsPage.tsx
// Main page for displaying list of accounts within a family context

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Stack, Alert, Paper } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { AgAccountsGrid } from '@/components/domain/ag/AgAccountsGrid';
import { useAccounts } from '../hooks/useAccounts';
import type { AccountRead } from '@/types/account';

/**
 * AccountsPage - Main accounts list view within family context
 *
 * Features:
 * - Displays all accounts shared with current family in AG Grid
 * - "Add Account" button to navigate to account creation
 * - Click on account row to navigate to detail view
 * - Loading state while fetching accounts
 * - Error state with user-friendly message
 * - Empty state encouraging first account creation
 *
 * Route: /app/:familyId/accounts
 * Protected: Yes (requires authentication and family membership via FamilyGuard)
 *
 * This page shows only accounts shared with the current family
 * (passes tenant_id to GET /accounts endpoint)
 *
 * @example
 * // Route configuration:
 * <Route path="/app/:familyId/accounts" element={<AccountsPage />} />
 */
export function AccountsPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();

  // Fetch accounts for current family
  // Hook automatically includes tenant_id in API request
  const { data: accounts = [], isLoading, error } = useAccounts(familyId);

  // Handle row click - navigate to account detail page within family context
  const handleAccountClick = (account: AccountRead) => {
    navigate(`/app/${familyId}/accounts/${account.id}`);
  };

  // Handle add account button - navigate to creation page
  const handleAddAccount = () => {
    navigate(`/app/${familyId}/accounts/new`);
  };

  // Show error state if API request failed
  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Failed to load accounts: {(error as Error).message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Page Header with Title and Add Button */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" component="h1">
          Accounts
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddAccount}
        >
          Add Account
        </Button>
      </Stack>

      {/* Accounts Grid - only show when accounts exist */}
      {!isLoading && accounts.length > 0 && (
        <>
          <AgAccountsGrid
            accounts={accounts}
            isLoading={isLoading}
            onRowClick={handleAccountClick}
            height={600}
          />

          {/* Helpful hint below grid when accounts exist */}
          <Typography variant="body2" color="text.secondary" mt={2}>
            Click on an account to view details and transactions
          </Typography>
        </>
      )}

      {/* Empty State - show when no accounts exist and not loading */}
      {!isLoading && accounts.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No accounts yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add your first account to start tracking your finances.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddAccount}
          >
            Add your first account
          </Button>
        </Paper>
      )}
    </Box>
  );
}
