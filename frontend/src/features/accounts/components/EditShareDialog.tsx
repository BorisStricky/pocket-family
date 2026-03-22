// src/features/accounts/components/EditShareDialog.tsx
// Dialog component for editing account share visibility

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Stack,
  Alert,
  Typography,
} from '@mui/material';
import { useUpdateAccountShare } from '../hooks/useUpdateAccountShare';
import type { AccountShareRead, ShareVisibility } from '@/types/account';

/**
 * Props for EditShareDialog component
 */
interface EditShareDialogProps {
  accountId: string;
  share: AccountShareRead | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Form data type for share editing
 */
interface EditShareFormData {
  visibility: ShareVisibility;
}

/**
 * EditShareDialog component for updating account share visibility
 *
 * Features:
 * - MUI Dialog for modal presentation
 * - Family name display (read-only)
 * - Visibility select: hidden / visible
 * - Form pre-populated with current visibility
 * - Loading states during submission
 * - Error display within dialog
 * - Success handling with dialog close
 *
 * Visibility Options:
 * - Hidden: Family members see account but balance is masked
 * - Visible: Family members see full account details including balance
 *
 * @example
 * <EditShareDialog
 *   accountId={accountId}
 *   share={selectedShare}
 *   open={editDialogOpen}
 *   onClose={() => setEditDialogOpen(false)}
 * />
 */
export function EditShareDialog({
  accountId,
  share,
  open,
  onClose,
}: EditShareDialogProps) {
  // Mutation for updating share
  const {
    mutate: updateShare,
    isPending: isUpdating,
    error: updateError,
  } = useUpdateAccountShare();

  // Set up form with React Hook Form
  const {
    control,
    handleSubmit,
    reset,
  } = useForm<EditShareFormData>({
    defaultValues: {
      visibility: share?.visibility || 'hidden',
    },
  });

  // Reset form when share changes or dialog opens
  // This ensures form always shows current share's visibility
  useEffect(() => {
    if (share) {
      reset({
        visibility: share.visibility,
      });
    }
  }, [share, reset]);

  // Handle form submission
  const handleFormSubmit = (data: EditShareFormData) => {
    if (!share) return;

    updateShare(
      {
        accountId,
        tenantId: share.tenant_id,
        data: { visibility: data.visibility },
      },
      {
        onSuccess: () => {
          // Close dialog on success
          onClose();
        },
        // Error is handled by displaying updateError below
      }
    );
  };

  // Handle dialog close with form reset
  const handleClose = () => {
    reset();
    onClose();
  };

  // Prevent closing on backdrop click to avoid accidental data loss on mobile
  const handleDialogClose = (_event: object, reason: string) => {
    if (reason === 'backdropClick') return;
    handleClose();
  };

  // Don't render if no share is selected
  if (!share) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      aria-labelledby="edit-share-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="edit-share-dialog-title">Edit Share Settings</DialogTitle>

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Stack spacing={3}>
            {/* Error Display */}
            {updateError && (
              <Alert severity="error">
                {updateError.message || 'Failed to update share'}
              </Alert>
            )}

            {/* Family Name (Read-Only) */}
            <Typography variant="body1" color="text.secondary">
              <strong>Family:</strong> {share.tenant_name}
            </Typography>

            {/* Visibility Selection */}
            <Controller
              name="visibility"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth disabled={isUpdating}>
                  <InputLabel id="edit-visibility-select-label">
                    Visibility
                  </InputLabel>
                  <Select
                    {...field}
                    labelId="edit-visibility-select-label"
                    label="Visibility"
                  >
                    <MenuItem value="hidden">
                      Hidden (balance not visible)
                    </MenuItem>
                    <MenuItem value="visible">Visible (balance shown)</MenuItem>
                  </Select>
                  <FormHelperText>
                    Controls whether the shared family can see the account balance
                  </FormHelperText>
                </FormControl>
              )}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isUpdating}>
            {isUpdating ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
