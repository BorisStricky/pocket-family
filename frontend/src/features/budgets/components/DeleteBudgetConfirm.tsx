// src/features/budgets/components/DeleteBudgetConfirm.tsx
// Confirmation dialog for deleting a budget
//
// Displays the budget name and asks the user to confirm deletion.
// The dialog prevents accidental deletions by requiring an explicit
// click on the Delete button. Deletion is permanent and removes
// the budget along with its category associations (CASCADE on backend).

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import type { BudgetRead } from '../types';

/**
 * Props for DeleteBudgetConfirm component
 *
 * The budget prop provides the name for display in the confirmation message.
 * onConfirm triggers the actual deletion via the useDeleteBudget hook in the parent.
 */
interface DeleteBudgetConfirmProps {
  open: boolean;
  budget: BudgetRead | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

/**
 * DeleteBudgetConfirm Component
 *
 * Simple MUI Dialog that asks the user to confirm budget deletion.
 * Shows the budget name so the user knows exactly which budget they are deleting.
 * The Delete button is disabled while the delete request is in progress
 * to prevent double-clicks.
 */
export function DeleteBudgetConfirm({
  open,
  budget,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteBudgetConfirmProps) {
  return (
    <Dialog
      open={open}
      // Prevent closing on backdrop click to avoid accidental data loss on mobile
      onClose={(_event: object, reason: string) => {
        if (reason === 'backdropClick') return;
        onCancel();
      }}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Delete Budget</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete the budget{' '}
          <strong>{budget?.name ?? ''}</strong>? This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
