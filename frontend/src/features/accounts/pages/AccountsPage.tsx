// src/features/accounts/pages/AccountsPage.tsx
// Main page for displaying list of accounts within a family context

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Button, Typography, Stack, Alert, Paper } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { AgAccountsGrid } from '@/components/domain/ag/AgAccountsGrid';
import { AddAccountModal } from '../components/AddAccountModal';
import { useAccounts } from '../hooks/useAccounts';
import { useCurrentRole } from '@/features/family/hooks/useCurrentRole';
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
  const { t } = useTranslation();
  // Viewers have read-only access — hide account creation within the family context
  const currentRole = useCurrentRole();
  const isViewer = currentRole === 'viewer';

  // Modal state for inline account creation
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Fetch accounts for current family
  // Hook automatically includes tenant_id in API request
  const { data: accounts = [], isLoading, error } = useAccounts(familyId);

  // Handle row click - navigate to account detail page within family context
  const handleAccountClick = (account: AccountRead) => {
    navigate(`/app/${familyId}/accounts/${account.id}`);
  };

  // Open the add account modal instead of navigating to a separate page
  const handleAddAccount = () => {
    setAddModalOpen(true);
  };

  // Show error state if API request failed
  if (error) {
    return (
      <Box>
        <Alert severity="error">
          {t('accounts.loadError', { message: (error as Error).message })}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Page Header with Title and Add Button */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" component="h1">
          {t('accounts.title')}
        </Typography>
        {/* Viewers are read-only — hide account creation */}
        {!isViewer && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddAccount}
          >
            {t('accounts.addAccount')}
          </Button>
        )}
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
            {t('accounts.clickToViewDetails')}
          </Typography>
        </>
      )}

      {/* Empty State - show when no accounts exist and not loading */}
      {!isLoading && accounts.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('accounts.noAccountsYet')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {isViewer
              ? t('accounts.noAccountsSharedWithFamily')
              : t('accounts.addFirstAccountPrompt')}
          </Typography>
          {!isViewer && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddAccount}
            >
              {t('accounts.addYourFirstAccount')}
            </Button>
          )}
        </Paper>
      )}

      {/* Add Account Modal — conditionally rendered so the form remounts on each open */}
      {addModalOpen && (
        <AddAccountModal
          open={addModalOpen}
          familyId={familyId!}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </Box>
  );
}
