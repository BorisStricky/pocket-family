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
import { useTranslation } from 'react-i18next';
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
  // useTranslation provides t() for the dialog title, message, and button labels
  const { t } = useTranslation();

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
      <DialogTitle>{t('budgets.deleteBudget')}</DialogTitle>
      <DialogContent>
        {/* Budget name is interpolated into the message via {{name}} so the user
            knows exactly which budget they are about to delete */}
        <DialogContentText>
          {t('budgets.deleteConfirmMessage', { name: budget?.name ?? '' })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isDeleting}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={isDeleting}
        >
          {isDeleting ? t('common.deleting') : t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
