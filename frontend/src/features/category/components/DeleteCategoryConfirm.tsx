// src/features/category/components/DeleteCategoryConfirm.tsx
// Confirmation dialog for deleting categories with transaction reassignment option

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  Alert,
  Stack,
  Typography,
  Box,
} from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import type { CategoryRead } from '@/types/category';
import { CategorySelect } from '@/components/domain/CategorySelect';

/**
 * Props for DeleteCategoryConfirm component
 */
export interface DeleteCategoryConfirmProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when delete is confirmed */
  onConfirm: (reassignToCategoryId?: string | null) => void;
  /** Category being deleted */
  category: CategoryRead;
  /** Number of transactions using this category */
  transactionCount: number;
  /** Array of available categories for reassignment */
  categories: CategoryRead[];
  /** Optional loading state during deletion */
  isLoading?: boolean;
  /** Optional error message */
  error?: string | null;
}

/**
 * DeleteCategoryConfirm - Confirmation dialog for category deletion
 * If category has transactions, requires selecting a replacement category
 * Prevents deletion without reassignment to avoid orphaned transactions
 *
 * @example
 * <DeleteCategoryConfirm
 *   open={dialogOpen}
 *   onClose={() => setDialogOpen(false)}
 *   onConfirm={(reassignTo) => deleteCategory(categoryId, reassignTo)}
 *   category={categoryToDelete}
 *   transactionCount={15}
 *   categories={allCategories}
 * />
 */
export function DeleteCategoryConfirm({
  open,
  onClose,
  onConfirm,
  category,
  transactionCount,
  categories,
  isLoading = false,
  error = null,
}: DeleteCategoryConfirmProps) {
  const { t } = useTranslation();

  // Track selected replacement category for reassignment
  const [reassignToCategoryId, setReassignToCategoryId] = useState<string | null>(
    null
  );

  /**
   * Handle confirm button click
   * Validates reassignment selection if category has transactions
   */
  const handleConfirm = () => {
    if (transactionCount > 0 && !reassignToCategoryId) {
      // Should not reach here due to button disabled state, but add safety check
      return;
    }
    onConfirm(reassignToCategoryId);
  };

  /**
   * Handle modal close
   * Resets reassignment selection
   */
  const handleClose = () => {
    if (!isLoading) {
      setReassignToCategoryId(null);
      onClose();
    }
  };

  /**
   * Filter categories available for reassignment
   * Excludes the category being deleted and shows only same kind
   */
  const availableReassignCategories = categories.filter(
    (potentialCategory) =>
      potentialCategory.id !== category.id && potentialCategory.kind === category.kind
  );

  // Determine if deletion is safe (no transactions linked)
  const isSafeDelete = transactionCount === 0;

  // Check if category has child categories
  // Backend prevents deletion of categories with children
  const hasChildren = categories.some(
    (potentialChild) => potentialChild.parent_id === category.id
  );

  return (
    <Dialog
      open={open}
      // Prevent closing on backdrop click to avoid accidental data loss on mobile
      onClose={(_event: object, reason: string) => {
        if (reason === 'backdropClick') return;
        handleClose();
      }}
      maxWidth="sm"
      fullWidth
      aria-labelledby="delete-category-dialog-title"
      aria-describedby="delete-category-dialog-description"
    >
      <DialogTitle id="delete-category-dialog-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={24} color="#d32f2f" />
          <Typography variant="h6" component="span">
            {t('categories.deleteCategory')}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => {}}>
              {error}
            </Alert>
          )}

          {/* Confirmation Message */}
          <DialogContentText id="delete-category-dialog-description">
            {t('categories.deleteConfirmMessage', { name: category.name })}
          </DialogContentText>

          {/* Transaction Count Warning — uses plural interpolation */}
          {transactionCount > 0 ? (
            <>
              <Alert severity="warning">
                <strong>
                  {t('categories.transactionsWarning', { count: transactionCount })}
                </strong>
              </Alert>

              <DialogContentText>
                {t('categories.reassignRequired')}
              </DialogContentText>

              {/* Reassignment Category Select */}
              {availableReassignCategories.length > 0 ? (
                <CategorySelect
                  value={reassignToCategoryId}
                  onChange={setReassignToCategoryId}
                  kind={category.kind}
                  categories={availableReassignCategories}
                  label={t('categories.reassignLabel')}
                  placeholder={t('categorySelect.placeholder')}
                  required
                  disabled={isLoading}
                  helperText={t('categories.reassignHelperText', {
                    kind: t(`enums.transactionType.${category.kind}`).toLowerCase(),
                    name: category.name,
                  })}
                />
              ) : (
                <Alert severity="error">
                  {t('categories.noOtherCategoriesAvailable', {
                    kind: t(`enums.transactionType.${category.kind}`).toLowerCase(),
                  })}
                </Alert>
              )}
            </>
          ) : (
            <Alert severity="info">
              {t('categories.safeToDelete')}
            </Alert>
          )}

          {/* Warning about child categories */}
          {hasChildren && (
            <Alert severity="warning">
              <Typography variant="body2">
                {t('categories.hasChildrenWarning')}
              </Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={
            isLoading ||
            (transactionCount > 0 &&
              (!reassignToCategoryId || availableReassignCategories.length === 0))
          }
        >
          {isLoading
            ? t('common.deleting')
            : transactionCount > 0
              ? t('categories.deleteAndReassign')
              : t('categories.deleteCategory')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DeleteCategoryConfirm;
