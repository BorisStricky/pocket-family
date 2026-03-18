// src/features/budgets/pages/BudgetsPage.tsx
// Main budgets page that composes the BudgetsList grid, BudgetForm modal,
// and DeleteBudgetConfirm dialog into a complete budget management experience.
//
// This page follows the same layout pattern as TransactionsPage:
// - Page header with title and "Add" button
// - Loading, error, and empty states
// - Grid for data display
// - Modals for create/edit/delete operations

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, Typography, CircularProgress, Paper, Alert } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import { useBudgets } from '../hooks/useBudgets';
import { useCreateBudget } from '../hooks/useCreateBudget';
import { useUpdateBudget } from '../hooks/useUpdateBudget';
import { useDeleteBudget } from '../hooks/useDeleteBudget';
import { BudgetsList } from '../components/BudgetsList';
import { BudgetForm } from '../components/BudgetForm';
import { DeleteBudgetConfirm } from '../components/DeleteBudgetConfirm';
import { useCurrentRole } from '@/features/family/hooks/useCurrentRole';
import type { BudgetRead, BudgetCreatePayload, BudgetUpdatePayload } from '../types';

/**
 * Form modal state type
 *
 * null = no modal open
 * 'create' = creating a new budget
 * 'edit' = editing an existing budget (selectedBudget must be set)
 */
type FormMode = null | 'create' | 'edit';

/**
 * BudgetsPage Component
 *
 * Main page for viewing and managing monthly budgets within a family/tenant context.
 *
 * Features:
 * - AG Grid table showing all budgets with progress bars and category chips
 * - "Add Budget" button to open the create form modal
 * - Edit and delete actions per budget row
 * - Create/edit modal with name, amount, currency, and multi-category selection
 * - Delete confirmation dialog to prevent accidental deletions
 * - Loading, error, and empty state handling
 *
 * State management:
 * - formMode controls which modal is visible (null/create/edit)
 * - selectedBudget tracks which budget is being edited or deleted
 * - budgetToDelete tracks which budget the delete confirmation refers to
 * - All mutations use the pre-built React Query hooks for cache invalidation
 */
export function BudgetsPage() {
  // Extract familyId from URL params (set by React Router's :familyId segment)
  const { familyId } = useParams<{ familyId: string }>();
  // Viewers have read-only access — hide budget creation and editing
  const currentRole = useCurrentRole();
  const isViewer = currentRole === 'viewer';

  // Modal state: which form dialog is open and which budget is being operated on
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetRead | null>(null);
  const [budgetToDelete, setBudgetToDelete] = useState<BudgetRead | null>(null);

  // Fetch all budgets for the current family (defaults to current month on backend)
  const { data: budgets = [], isLoading, error } = useBudgets(familyId!);

  // Mutation hooks for CRUD operations
  // Each hook handles cache invalidation automatically on success
  const { mutate: createBudget, isPending: isCreating } = useCreateBudget(familyId!);
  // useUpdateBudget requires a budgetId, so we initialize with selectedBudget's ID
  // The hook is only called when selectedBudget is set (edit mode)
  const { mutate: editBudget, isPending: isUpdating } = useUpdateBudget(
    familyId!,
    selectedBudget?.id ?? ''
  );
  const { mutate: removeBudget, isPending: isDeleting } = useDeleteBudget(familyId!);

  // Open the create budget modal
  const handleOpenCreateForm = () => {
    setSelectedBudget(null);
    setFormMode('create');
  };

  // Open the edit budget modal with the selected budget's data
  const handleOpenEditForm = (budget: BudgetRead) => {
    setSelectedBudget(budget);
    setFormMode('edit');
  };

  // Close the create/edit modal and reset selection
  const handleCloseForm = () => {
    setFormMode(null);
    setSelectedBudget(null);
  };

  // Handle form submission for both create and edit modes
  // Closes the modal on success; errors are handled by React Query
  const handleFormSubmit = (data: BudgetCreatePayload | BudgetUpdatePayload) => {
    if (formMode === 'create') {
      createBudget(data as BudgetCreatePayload, {
        onSuccess: () => {
          handleCloseForm();
        },
      });
    } else if (formMode === 'edit' && selectedBudget) {
      editBudget(data as BudgetUpdatePayload, {
        onSuccess: () => {
          handleCloseForm();
        },
      });
    }
  };

  // Open the delete confirmation dialog for a specific budget
  const handleOpenDeleteConfirm = (budget: BudgetRead) => {
    setBudgetToDelete(budget);
  };

  // Close the delete confirmation dialog
  const handleCloseDeleteConfirm = () => {
    setBudgetToDelete(null);
  };

  // Execute the delete operation and close the dialog on success
  const handleConfirmDelete = () => {
    if (!budgetToDelete) return;

    removeBudget(budgetToDelete.id, {
      onSuccess: () => {
        handleCloseDeleteConfirm();
      },
    });
  };

  return (
    <Box>
      {/* Page Header - Title and Add Budget button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Budgets
        </Typography>

        {/* Owners only can create budgets — hide the button for viewers and members */}
        {currentRole === 'owner' && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateForm}
          >
            Add Budget
          </Button>
        )}
      </Box>

      {/* Viewer notice — budget creation is restricted to owners */}
      {isViewer && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have viewer access. Only family owners can create or modify budgets.
        </Alert>
      )}

      {/* Loading State - shown while budgets are being fetched */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error State - shown when the fetch request fails */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading budgets: {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      )}

      {/* Budgets Grid - shown when data is loaded successfully */}
      {!isLoading && !error && budgets.length > 0 && (
        <Paper sx={{ p: 0, overflow: 'hidden' }}>
          <BudgetsList
            budgets={budgets}
            isLoading={isLoading}
            onEdit={handleOpenEditForm}
            onDelete={handleOpenDeleteConfirm}
          />
        </Paper>
      )}

      {/* Empty State - shown when no budgets exist for this family */}
      {!isLoading && !error && budgets.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No budgets yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create your first budget to start tracking your spending!
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateForm}
          >
            Add Budget
          </Button>
        </Paper>
      )}

      {/* Create/Edit Budget Modal */}
      {formMode !== null && (
        <BudgetForm
          open={formMode !== null}
          mode={formMode}
          existingBudget={selectedBudget}
          familyId={familyId!}
          onSubmit={handleFormSubmit}
          onCancel={handleCloseForm}
          isSubmitting={isCreating || isUpdating}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteBudgetConfirm
        open={budgetToDelete !== null}
        budget={budgetToDelete}
        onConfirm={handleConfirmDelete}
        onCancel={handleCloseDeleteConfirm}
        isDeleting={isDeleting}
      />
    </Box>
  );
}
