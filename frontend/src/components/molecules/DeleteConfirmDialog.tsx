import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  CircularProgress,
} from '@mui/material';

/**
 * DeleteConfirmDialog component for confirming delete operations
 *
 * A reusable confirmation dialog specifically styled for dangerous delete
 * actions. Shows a warning message and requires explicit confirmation
 * before proceeding with deletion. Supports loading state during the
 * delete operation.
 *
 * @example
 * <DeleteConfirmDialog
 *   open={isOpen}
 *   title="Delete Transaction"
 *   message="Are you sure you want to delete this transaction? This action cannot be undone."
 *   onConfirm={handleDelete}
 *   onCancel={handleCancel}
 *   loading={isDeleting}
 * />
 */
export interface DeleteConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Title of the dialog */
  title: string;
  /** Confirmation message to display */
  message: string;
  /** Label for the confirm button (defaults to "Delete") */
  confirmLabel?: string;
  /** Label for the cancel button (defaults to "Cancel") */
  cancelLabel?: string;
  /** Callback when confirm button is clicked */
  onConfirm: () => void;
  /** Callback when cancel button is clicked or dialog is closed */
  onCancel: () => void;
  /** Whether the delete operation is in progress */
  loading?: boolean;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  // Handle dialog close (via ESC key or backdrop click)
  const handleClose = (event: object, reason: string) => {
    // Prevent closing during loading state
    if (loading) return;

    // Allow closing via ESC key or backdrop click
    if (reason === 'escapeKeyDown' || reason === 'backdropClick') {
      onCancel();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      // Disable closing during loading
      disableEscapeKeyDown={loading}
      aria-labelledby="delete-confirm-dialog-title"
      aria-describedby="delete-confirm-dialog-description"
    >
      {/* Dialog Title */}
      <DialogTitle id="delete-confirm-dialog-title">{title}</DialogTitle>

      {/* Dialog Content */}
      <DialogContent>
        <DialogContentText id="delete-confirm-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>

      {/* Dialog Actions */}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {/* Cancel Button */}
        <Button
          onClick={onCancel}
          disabled={loading}
          variant="outlined"
          color="inherit"
        >
          {cancelLabel}
        </Button>

        {/* Confirm Button - Styled for dangerous action */}
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color="error"
          autoFocus
          startIcon={
            loading ? <CircularProgress size={18} thickness={5} color="inherit" /> : null
          }
        >
          {loading ? 'Deleting...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
