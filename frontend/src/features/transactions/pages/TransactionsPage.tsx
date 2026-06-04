// src/features/transactions/pages/TransactionsPage.tsx
// Main transactions list page with filtering, search, and bulk actions

import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Collapse,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowDropDown as ArrowDropDownIcon,
  FileUpload as FileUploadIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useTransactions } from '../hooks/useTransactions';
import { useDeleteTransaction } from '../hooks/useDeleteTransaction';
import { AgTransactionsGrid } from '@/components/domain/ag/AgTransactionsGrid';
import { DateRangePicker } from '@/components/molecules/DateRangePicker';
import { MonthPicker, getMonthRange, getCurrentYearMonth } from '@/components/molecules/MonthPicker';
import { SearchInput } from '@/components/molecules/SearchInput';
import { BulkActions } from '../components/BulkActions';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { useDebounce } from '@/hooks/useDebounce';
import { useCurrentRole } from '@/features/family/hooks/useCurrentRole';
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
  const location = useLocation();
  // Viewers have read-only access — hide write actions so they don't hit 403s
  const currentRole = useCurrentRole();
  const isViewer = currentRole === 'viewer';

  // Most browsing happens one month at a time, so the month picker is the primary period
  // control and defaults to the current month. The free-form date range is kept as a
  // secondary "Custom range" option for arbitrary spans.
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [useCustomRange, setUseCustomRange] = useState(false);

  // Default date range to current month (1st to last day) for faster loading on large datasets
  const currentMonthRange = getMonthRange(selectedMonth.year, selectedMonth.month);

  // Separate local state for immediate UI updates from debounced state for API calls
  // This prevents API call on every keystroke while keeping UI responsive
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localStartDate, setLocalStartDate] = useState<string | null>(currentMonthRange.startDate);
  const [localEndDate, setLocalEndDate] = useState<string | null>(currentMonthRange.endDate);

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

  // Modal state for inline transaction creation
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Anchor for the Import CSV split-button's dropdown menu. The dropdown
  // currently exposes a single action ("See previous imports") but is kept as
  // a Menu so additional import-related actions can be added without rewiring.
  const importMenuAnchorRef = useRef<HTMLDivElement>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);

  // Auto-open the Add Transaction modal when navigated here with a state flag
  // (e.g., from Dashboard QuickActions). Clear the state after reading it so
  // the modal does not reopen on browser back/forward navigation.
  useEffect(() => {
    if (location.state?.openAddModal) {
      setAddModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Track selected transaction IDs for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch transactions with debounced filters
  // API is only called when debounced values change (not on every keystroke)
  const { data: transactions = [], isLoading, error } = useTransactions(familyId!, filters);

  // Delete mutation for bulk operations
  const { mutate: deleteTransaction } = useDeleteTransaction();

  // Open the add transaction modal instead of navigating to a separate page
  const handleAddTransaction = () => {
    setAddModalOpen(true);
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

  // Stepping the month picker updates the selected month and snaps the filter dates to
  // that month's bounds. The debounced filters then drive the transactions query.
  const handleMonthChange = (year: number, month: number) => {
    setSelectedMonth({ year, month });
    const { startDate, endDate } = getMonthRange(year, month);
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

        {/* Viewers are read-only — hide write actions entirely */}
        {!isViewer && (
          <Stack direction="row" spacing={1}>
            {/* Split button: primary click runs a new import, the arrow opens
                a menu with import-related actions (currently just history). */}
            <ButtonGroup variant="outlined" ref={importMenuAnchorRef}>
              <Button
                startIcon={<FileUploadIcon />}
                onClick={() => navigate(`/app/${familyId}/import-csv`)}
              >
                Import CSV
              </Button>
              <Button
                size="small"
                aria-label="more import options"
                aria-haspopup="menu"
                onClick={() => setImportMenuOpen((open) => !open)}
              >
                <ArrowDropDownIcon />
              </Button>
            </ButtonGroup>
            <Menu
              anchorEl={importMenuAnchorRef.current}
              open={importMenuOpen}
              onClose={() => setImportMenuOpen(false)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => {
                  setImportMenuOpen(false);
                  navigate(`/app/${familyId}/imports`);
                }}
              >
                <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
                See previous imports
              </MenuItem>
            </Menu>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddTransaction}
            >
              Add Transaction
            </Button>
          </Stack>
        )}
      </Box>

      {/* Filters Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Filters
        </Typography>

        <Stack spacing={2}>
          {/* Period filter: month picker is the primary control; "Custom range" reveals
              the free-form date range for arbitrary spans. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {/* No label: the `< Month Year >` control is self-explanatory, and omitting
                it keeps the picker a single row so it stays vertically centered with the
                "Custom range" button beside it. */}
            <MonthPicker
              year={selectedMonth.year}
              month={selectedMonth.month}
              onChange={handleMonthChange}
            />
            <Button
              size="small"
              variant="text"
              onClick={() => setUseCustomRange((open) => !open)}
            >
              {useCustomRange ? 'Hide custom range' : 'Custom range'}
            </Button>
          </Box>

          {/* Custom date range (secondary). When the user picks a custom range it drives
              the filter dates directly, independent of the month picker. */}
          <Collapse in={useCustomRange} unmountOnExit>
            <DateRangePicker
              startDate={localStartDate}
              endDate={localEndDate}
              onChange={handleDateRangeChange}
              label="Filter by date"
            />
          </Collapse>

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
              : isViewer
              ? 'No transactions have been recorded yet.'
              : 'Get started by adding your first transaction.'}
          </Typography>
          {!isViewer && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddTransaction}
            >
              Add Transaction
            </Button>
          )}
        </Paper>
      )}

      {/* Add Transaction Modal — conditionally rendered so the form remounts
          on each open, picking up fresh session defaults */}
      {addModalOpen && (
        <AddTransactionModal
          open={addModalOpen}
          familyId={familyId!}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </Box>
  );
}
