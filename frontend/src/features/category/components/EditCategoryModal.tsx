// src/features/category/components/EditCategoryModal.tsx
// Modal dialog for editing existing categories with pre-filled data

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Alert,
} from '@mui/material';
import type { CategoryRead, CategoryUpdate, CategoryKind } from '@/types/category';
import { CategorySelect } from '@/components/domain/CategorySelect';

/**
 * Props for EditCategoryModal component
 */
export interface EditCategoryModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when category is updated with form data */
  onUpdate: (data: CategoryUpdate) => void;
  /** Category being edited */
  category: CategoryRead;
  /** Array of existing categories for parent selection */
  categories: CategoryRead[];
  /** Optional loading state during update */
  isLoading?: boolean;
  /** Optional error message */
  error?: string | null;
}

/**
 * EditCategoryModal - Modal form for editing existing categories
 * Pre-fills form with current category data and validates changes
 *
 * @example
 * <EditCategoryModal
 *   open={modalOpen}
 *   onClose={() => setModalOpen(false)}
 *   onUpdate={(data) => updateCategory(data)}
 *   category={selectedCategory}
 *   categories={allCategories}
 * />
 */
export function EditCategoryModal({
  open,
  onClose,
  onUpdate,
  category,
  categories,
  isLoading = false,
  error = null,
}: EditCategoryModalProps) {
  // Form state - initialize with current category values
  const [name, setName] = useState(category.name);
  const [selectedKind, setSelectedKind] = useState<CategoryKind>(category.kind);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    category.parent_id
  );

  // Form validation
  const [nameError, setNameError] = useState<string | null>(null);

  /**
   * Reset form state when category prop changes
   * This ensures form is updated when switching between categories
   */
  useEffect(() => {
    setName(category.name);
    setSelectedKind(category.kind);
    setSelectedParentId(category.parent_id);
    setNameError(null);
  }, [category]);

  /**
   * Validate category name input
   * Name must be at least 2 characters and not empty
   */
  const validateName = (value: string): boolean => {
    if (!value.trim()) {
      setNameError('Category name is required');
      return false;
    }
    if (value.trim().length < 2) {
      setNameError('Category name must be at least 2 characters');
      return false;
    }
    setNameError(null);
    return true;
  };

  /**
   * Check if form has any changes from original values
   * Used to enable/disable save button
   */
  const hasChanges = (): boolean => {
    return (
      name.trim() !== category.name ||
      selectedKind !== category.kind ||
      selectedParentId !== category.parent_id
    );
  };

  /**
   * Handle form submission
   * Validates inputs and calls onUpdate callback with only changed fields
   */
  const handleSubmit = () => {
    // Validate name
    if (!validateName(name)) {
      return;
    }

    // Build update data with only changed fields
    const updateData: CategoryUpdate = {};

    if (name.trim() !== category.name) {
      updateData.name = name.trim();
    }
    if (selectedKind !== category.kind) {
      updateData.kind = selectedKind;
    }
    if (selectedParentId !== category.parent_id) {
      updateData.parent_id = selectedParentId;
    }

    // Only call onUpdate if there are actual changes
    if (Object.keys(updateData).length > 0) {
      onUpdate(updateData);
    }
  };

  /**
   * Handle modal close
   * Resets form state when modal is closed
   */
  const handleClose = () => {
    if (!isLoading) {
      setName(category.name);
      setSelectedKind(category.kind);
      setSelectedParentId(category.parent_id);
      setNameError(null);
      onClose();
    }
  };

  /**
   * Filter categories for parent selection
   * Excludes current category and its descendants to prevent circular references
   * Only shows categories of same kind
   */
  const availableParentCategories = categories.filter((potentialParent) => {
    // Cannot be its own parent
    if (potentialParent.id === category.id) {
      return false;
    }
    // Cannot be a child of current category (prevents circular reference)
    if (potentialParent.parent_id === category.id) {
      return false;
    }
    // Must have same kind
    if (potentialParent.kind !== selectedKind) {
      return false;
    }
    return true;
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="edit-category-dialog-title"
    >
      <DialogTitle id="edit-category-dialog-title">Edit Category</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ marginTop: 1 }}>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => {}}>
              {error}
            </Alert>
          )}

          {/* Category Name Input */}
          <TextField
            label="Category Name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) {
                validateName(event.target.value);
              }
            }}
            onBlur={() => validateName(name)}
            error={!!nameError}
            helperText={nameError || 'Enter a descriptive name for the category'}
            required
            autoFocus
            fullWidth
            disabled={isLoading}
          />

          {/* Category Kind Select */}
          <TextField
            select
            label="Category Type"
            value={selectedKind}
            onChange={(event) => {
              setSelectedKind(event.target.value as CategoryKind);
              // Reset parent selection when kind changes
              setSelectedParentId(null);
            }}
            required
            fullWidth
            disabled={isLoading}
            helperText="Changing type will reset parent category"
          >
            <MenuItem value="expense">Expense</MenuItem>
            <MenuItem value="income">Income</MenuItem>
          </TextField>

          {/* Parent Category Select (Optional) */}
          <CategorySelect
            value={selectedParentId}
            onChange={setSelectedParentId}
            kind={selectedKind}
            categories={availableParentCategories}
            label="Parent Category (Optional)"
            placeholder="None - keep as top-level category"
            disabled={isLoading}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || !name.trim() || !hasChanges()}
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default EditCategoryModal;
