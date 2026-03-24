// src/features/accounts/pages/AllAccountsPage.tsx
// Global accounts view showing all user accounts across all families

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Paper } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useAccounts } from '../hooks/useAccounts';
import { AgAccountsGrid } from '@/components/domain/ag/AgAccountsGrid';
import { AddAccountModal } from '../components/AddAccountModal';
import type { AccountRead } from '@/types/account';

/**
 * AllAccountsPage Component
 *
 * Displays all accounts owned by or shared with the current user across all families
 * This is a global view that is not scoped to a specific family context
 *
 * Features:
 * - Shows all user's accounts using useAccounts hook without familyId
 * - Provides "Add Account" button to create new account
 * - Clicking account row navigates to global account detail page
 * - Displays empty state when user has no accounts
 *
 * Route: /app/accounts (exact)
 *
 * This page does not require FamilyGuard since it operates in global context
 * However, it still requires authentication via ProtectedRoute
 */
export default function AllAccountsPage() {
  const navigate = useNavigate();

  // Modal state for inline account creation
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Fetch all user accounts across all families by omitting familyId parameter
  // The hook uses query key ['accounts', 'all'] for proper cache isolation
  const { data: accounts, isLoading, error } = useAccounts();

  // Navigate to global account detail page when user clicks a row
  // Uses global route /app/accounts/:accountId instead of family-scoped route
  const handleRowClick = (account: AccountRead) => {
    navigate(`/app/accounts/${account.id}`);
  };

  // Open the add account modal instead of navigating to a separate page
  const handleAddAccount = () => {
    setAddModalOpen(true);
  };

  // Show error state if accounts fetch fails
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          All My Accounts
        </Typography>
        <Paper sx={{ p: 3, mt: 2, bgcolor: 'error.light' }}>
          <Typography color="error">
            Error loading accounts: {error instanceof Error ? error.message : 'Unknown error'}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Page header with title and add button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          All My Accounts
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddAccount}
        >
          Add Account
        </Button>
      </Box>

      {/* Accounts grid showing all user accounts across families */}
      <Paper sx={{ p: 2 }}>
        <AgAccountsGrid
          accounts={accounts || []}
          isLoading={isLoading}
          onRowClick={handleRowClick}
          height={600}
        />
      </Paper>

      {/* Add Account Modal — no familyId means global context (no auto-sharing) */}
      {addModalOpen && (
        <AddAccountModal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </Box>
  );
}
