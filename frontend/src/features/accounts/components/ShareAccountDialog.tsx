// src/features/accounts/components/ShareAccountDialog.tsx
// Dialog component for sharing an account with another family

import React, { useMemo } from 'react';
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
} from '@mui/material';
import { useFamilies } from '@/features/family/hooks/useFamilies';
import { useCreateAccountShare } from '../hooks/useCreateAccountShare';
import { useAccountShares } from '../hooks/useAccountShares';
import type { AccountShareCreate, ShareVisibility } from '@/types/account';

/**
 * Props for ShareAccountDialog component
 */
interface ShareAccountDialogProps {
  accountId: string;
  open: boolean;
  onClose: () => void;
  currentFamilyId?: string;
}

/**
 * Form data type for share creation
 */
interface ShareFormData {
  tenant_id: string;
  visibility: ShareVisibility;
}

/**
 * ShareAccountDialog component for creating new account shares
 *
 * Features:
 * - MUI Dialog for modal presentation
 * - Family dropdown populated from user's families
 * - Excludes current family (if in family context)
 * - Excludes families already shared with
 * - Visibility select: hidden (default) / visible
 * - Form validation (family selection required)
 * - Loading states during submission
 * - Error display within dialog
 * - Success handling with dialog close
 *
 * Visibility Options:
 * - Hidden (default): Family members see account but balance is masked
 * - Visible: Family members see full account details including balance
 *
 * @example
 * <ShareAccountDialog
 *   accountId={accountId}
 *   open={shareDialogOpen}
 *   onClose={() => setShareDialogOpen(false)}
 *   currentFamilyId={familyId}
 * />
 */
export function ShareAccountDialog({
  accountId,
  open,
  onClose,
  currentFamilyId,
}: ShareAccountDialogProps) {
  // Fetch user's families for dropdown options
  const { data: families, isLoading: isLoadingFamilies } = useFamilies();

  // Fetch existing shares to exclude already-shared families
  const { data: existingShares } = useAccountShares(accountId, { isOwner: true });

  // Mutation for creating new share
  const {
    mutate: createShare,
    isPending: isCreating,
    error: createError,
  } = useCreateAccountShare(accountId);

  // Set up form with React Hook Form
  // Default visibility is 'hidden' per backend spec
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ShareFormData>({
    defaultValues: {
      tenant_id: '',
      visibility: 'hidden',
    },
  });

  // Calculate available families for sharing
  // Exclude current family and already-shared families
  const availableFamilies = useMemo(() => {
    if (!families) return [];

    // Get set of tenant IDs already shared with
    const sharedTenantIds = new Set(
      existingShares?.map((share) => share.tenant_id) || []
    );

    // Filter out current family and already-shared families
    return families.filter(
      (family) =>
        family.id !== currentFamilyId && !sharedTenantIds.has(family.id)
    );
  }, [families, existingShares, currentFamilyId]);

  // Handle form submission
  const handleFormSubmit = (data: ShareFormData) => {
    const shareData: AccountShareCreate = {
      tenant_id: data.tenant_id,
      visibility: data.visibility,
    };

    createShare(shareData, {
      onSuccess: () => {
        // Reset form and close dialog on success
        reset();
        onClose();
      },
      // Error is handled by displaying createError below
    });
  };

  // Handle dialog close with form reset
  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="share-account-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="share-account-dialog-title">Share Account</DialogTitle>

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Stack spacing={3}>
            {/* Error Display */}
            {createError && (
              <Alert severity="error">
                {createError.message || 'Failed to share account'}
              </Alert>
            )}

            {/* Loading State for Families */}
            {isLoadingFamilies && <Alert severity="info">Loading families...</Alert>}

            {/* No Families Available */}
            {!isLoadingFamilies && availableFamilies.length === 0 && (
              <Alert severity="warning">
                {families && families.length === 0
                  ? 'You are not a member of any other families'
                  : 'This account is already shared with all your families'}
              </Alert>
            )}

            {/* Family Selection */}
            {!isLoadingFamilies && availableFamilies.length > 0 && (
              <>
                <Controller
                  name="tenant_id"
                  control={control}
                  rules={{ required: 'Please select a family to share with' }}
                  render={({ field }) => (
                    <FormControl
                      fullWidth
                      error={!!errors.tenant_id}
                      disabled={isCreating}
                    >
                      <InputLabel id="family-select-label">Family</InputLabel>
                      <Select
                        {...field}
                        labelId="family-select-label"
                        label="Family"
                      >
                        {availableFamilies.map((family) => (
                          <MenuItem key={family.id} value={family.id}>
                            {family.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.tenant_id && (
                        <FormHelperText>{errors.tenant_id.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />

                {/* Visibility Selection */}
                <Controller
                  name="visibility"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth disabled={isCreating}>
                      <InputLabel id="visibility-select-label">
                        Visibility
                      </InputLabel>
                      <Select
                        {...field}
                        labelId="visibility-select-label"
                        label="Visibility"
                      >
                        <MenuItem value="hidden">
                          Hidden (balance not visible)
                        </MenuItem>
                        <MenuItem value="visible">
                          Visible (balance shown)
                        </MenuItem>
                      </Select>
                      <FormHelperText>
                        Controls whether the shared family can see the account balance
                      </FormHelperText>
                    </FormControl>
                  )}
                />
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isCreating || isLoadingFamilies || availableFamilies.length === 0}
          >
            {isCreating ? 'Sharing...' : 'Share Account'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
