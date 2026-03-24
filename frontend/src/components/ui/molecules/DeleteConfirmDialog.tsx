// src/components/ui/molecules/DeleteConfirmDialog.tsx
// Reusable confirmation dialog for delete operations across the application

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

/**
 * Props for DeleteConfirmDialog component
 */
interface DeleteConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

/**
 * Confirmation dialog for delete operations
 *
 * Provides a consistent user experience for confirming destructive actions
 * Uses MUI Dialog with proper accessibility and styling
 *
 * @example
 * <DeleteConfirmDialog
 *   open={dialogOpen}
 *   title="Delete Transaction"
 *   message="Are you sure you want to delete this transaction? This action cannot be undone."
 *   onConfirm={() => handleDelete()}
 *   onCancel={() => setDialogOpen(false)}
 * />
 */
export function DeleteConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmButtonText = 'Delete',
  cancelButtonText = 'Cancel',
}: DeleteConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      // Prevent closing on backdrop click to avoid accidental dismissal on mobile
      onClose={(_event: object, reason: string) => {
        if (reason === 'backdropClick') return;
        onCancel();
      }}
      aria-labelledby="delete-confirm-dialog-title"
      aria-describedby="delete-confirm-dialog-description"
    >
      <DialogTitle id="delete-confirm-dialog-title">
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="delete-confirm-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          {cancelButtonText}
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" autoFocus>
          {confirmButtonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
