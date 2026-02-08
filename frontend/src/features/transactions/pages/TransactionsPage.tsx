// src/features/transactions/pages/TransactionsPage.tsx
// Main transactions list page with filtering, search, and bulk actions

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Typography, CircularProgress, Paper, Stack } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useTransactions } from '../hooks/useTransactions';
import { useDeleteTransaction } from '../hooks/useDeleteTransaction';
import { AgTransactionsGrid } from '@/components/domain/ag/AgTransactionsGrid';
import { DateRangePicker } from '@/components/molecules/DateRangePicker';
import { SearchInput } from '@/components/molecules/SearchInput';
import { BulkActions } from '../components/BulkActions';
import { useDebounce } from '@/hooks/useDebounce';
import type { TransactionFilters, TransactionRead } from '../types';

/**
 * TransactionsPage Component
 *
 * Main page for viewing and managing transactions in the family/tenant context
 *
 * Features:
 * - AG Grid table showing all transactions with sortable columns
 * - Filter controls for date range and text search
 * - Add Transaction button to create new transactions
 * - Row selection for bulk operations
 * - Bulk delete with confirmation dialog
 * - Click row to navigate to transaction detail page
 * - Loading and error states
 * - Empty state when no transactions exist
 *
 * The page integrates all previously built components and hooks:
 * - useTransactions: Fetches filtered transaction list
 * - AgTransactionsGrid: Displays transactions in sortable grid
 * - TransactionForm: Used on separate pages for create/edit
 * - BulkActions: Handles multi-select operations
 * - DateRangePicker: Filters by date range
 * - SearchInput: Filters by description text
 */
export function TransactionsPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();

  // Separate local state for immediate UI updates from debounced state for API calls
  // This prevents API call on every keystroke while keeping UI responsive
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localStartDate, setLocalStartDate] = useState<string | null>(null);
  const [localEndDate, setLocalEndDate] = useState<string | null>(null);

  // Debounce search and date inputs to reduce API calls
  // Only triggers API call 500ms after user stops typing/selecting
  const debouncedSearchQuery = useDebounce(localSearchQuery, 500);
  const debouncedStartDate = useDebounce(localStartDate, 500);
  const debouncedEndDate = useDebounce(localEndDate, 500);

  // Build filters object from debounced values
  // This is what goes into the React Query key, triggering API calls
  const filters: TransactionFilters = {
    start_date: debouncedStartDate || undefined,
    end_date: debouncedEndDate || undefined,
    search: debouncedSearchQuery || undefined,
  };

  // Track selected transaction IDs for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch transactions with debounced filters
  // API is only called when debounced values change (not on every keystroke)
  const { data: transactions = [], isLoading, error } = useTransactions(familyId!, filters);

  // Delete mutation for bulk operations
  const { mutate: deleteTransaction } = useDeleteTransaction();

  // Handle navigation to add transaction page
  const handleAddTransaction = () => {
    navigate(`/app/${familyId}/transactions/new`);
  };

  // Handle row click - navigate to transaction detail page
  const handleRowClick = (transaction: TransactionRead) => {
    navigate(`/app/${familyId}/transactions/${transaction.id}`);
  };

  // Handle bulk delete operation
  // Deletes all selected transactions sequentially
  const handleBulkDelete = async () => {
    // Delete each selected transaction
    // The mutation will invalidate queries and refetch the list
    for (const transactionId of selectedIds) {
      deleteTransaction(transactionId);
    }

    // Clear selection after deleting
    setSelectedIds([]);
  };

  // Handle date range filter change (updates local state immediately)
  // Debounced values will trigger API call 500ms after user stops selecting dates
  const handleDateRangeChange = (startDate: string | null, endDate: string | null) => {
    setLocalStartDate(startDate);
    setLocalEndDate(endDate);
  };

  // Handle search input change (updates local state immediately for responsive UI)
  // Debounced value will trigger API call 500ms after user stops typing
  const handleSearchChange = (searchValue: string) => {
    setLocalSearchQuery(searchValue);
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Transactions
        </Typography>

        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddTransaction}
        >
          Add Transaction
        </Button>
      </Box>

      {/* Filters Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Filters
        </Typography>

        <Stack spacing={2}>
          {/* Date Range Filter */}
          {/* Uses local state for immediate UI updates, debounced for API calls */}
          <DateRangePicker
            startDate={localStartDate}
            endDate={localEndDate}
            onChange={handleDateRangeChange}
            label="Filter by date"
          />

          {/* Search Filter */}
          {/* Uses local state for immediate UI updates, debounced for API calls */}
          <SearchInput
            value={localSearchQuery}
            onChange={handleSearchChange}
            placeholder="Search transactions by description..."
            fullWidth
          />
        </Stack>
      </Paper>

      {/* Bulk Actions Bar (only visible when rows are selected) */}
      <BulkActions
        selectedIds={selectedIds}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedIds([])}
      />

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Paper sx={{ p: 3, bgcolor: 'error.light' }}>
          <Typography color="error.dark" variant="body1">
            Error loading transactions: {error instanceof Error ? error.message : 'Unknown error'}
          </Typography>
        </Paper>
      )}

      {/* Transactions Grid */}
      {!isLoading && !error && (
        <Paper sx={{ p: 0, overflow: 'hidden' }}>
          <AgTransactionsGrid
            transactions={transactions}
            isLoading={isLoading}
            filters={filters}
            onRowClick={handleRowClick}
            onSelectionChange={setSelectedIds}
            height={600}
          />
        </Paper>
      )}

      {/* Empty State */}
      {!isLoading && !error && transactions.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No transactions found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {localSearchQuery || localStartDate || localEndDate
              ? 'Try adjusting your filters to see more results.'
              : 'Get started by adding your first transaction.'}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddTransaction}
          >
            Add Transaction
          </Button>
        </Paper>
      )}
    </Box>
  );
}
