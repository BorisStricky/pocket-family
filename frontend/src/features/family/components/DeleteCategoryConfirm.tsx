// src/features/family/components/DeleteCategoryConfirm.tsx
// Confirmation dialog for deleting categories with transaction reassignment option

import { useState } from 'react';
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
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="delete-category-dialog-title"
      aria-describedby="delete-category-dialog-description"
    >
      <DialogTitle id="delete-category-dialog-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={24} color="#d32f2f" />
          <Typography variant="h6" component="span">
            Delete Category
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
            Are you sure you want to delete the category{' '}
            <strong>&quot;{category.name}&quot;</strong>?
          </DialogContentText>

          {/* Transaction Count Warning */}
          {transactionCount > 0 ? (
            <>
              <Alert severity="warning">
                This category is used by <strong>{transactionCount}</strong>{' '}
                {transactionCount === 1 ? 'transaction' : 'transactions'}.
              </Alert>

              <DialogContentText>
                To delete this category, you must first reassign all transactions to
                another category. Select a replacement category below.
              </DialogContentText>

              {/* Reassignment Category Select */}
              {availableReassignCategories.length > 0 ? (
                <CategorySelect
                  value={reassignToCategoryId}
                  onChange={setReassignToCategoryId}
                  kind={category.kind}
                  categories={availableReassignCategories}
                  label="Reassign Transactions To"
                  placeholder="Select a category"
                  required
                  disabled={isLoading}
                  helperText={`Select which ${category.kind} category should replace "${category.name}"`}
                />
              ) : (
                <Alert severity="error">
                  No other {category.kind} categories available. You must create another{' '}
                  {category.kind} category before deleting this one.
                </Alert>
              )}
            </>
          ) : (
            <Alert severity="info">
              This category is not used by any transactions and can be safely deleted.
            </Alert>
          )}

          {/* Warning about child categories */}
          {hasChildren && (
            <Alert severity="warning">
              <Typography variant="body2">
                <strong>Note:</strong> This category has subcategories. You must delete all
                child categories first before deleting this parent category.
              </Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
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
            ? 'Deleting...'
            : transactionCount > 0
              ? 'Delete & Reassign'
              : 'Delete Category'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DeleteCategoryConfirm;
