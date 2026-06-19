// src/features/category/components/EditCategoryModal.tsx
// Modal dialog for editing existing categories with pre-filled data

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { IconPicker } from '@/components/ui/molecules/IconPicker';
import { ColorSwatchPicker } from '@/components/ui/molecules/ColorSwatchPicker';

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
  const { t } = useTranslation();

  // Form state - initialize with current category values
  const [name, setName] = useState(category.name);
  const [selectedKind, setSelectedKind] = useState<CategoryKind>(category.kind);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    category.parent_id
  );
  const [selectedIcon, setSelectedIcon] = useState<string | null>(category.icon);
  const [selectedColor, setSelectedColor] = useState<string | null>(category.color);

  // Form validation
  const [nameError, setNameError] = useState<string | null>(null);

  /**
   * Reset form state when category prop changes.
   * This ensures form is updated when switching between categories.
   */
  useEffect(() => {
    setName(category.name);
    setSelectedKind(category.kind);
    setSelectedParentId(category.parent_id);
    setSelectedIcon(category.icon);
    setSelectedColor(category.color);
    setNameError(null);
  }, [category]);

  /**
   * Validate category name input
   * Name must be at least 2 characters and not empty
   */
  const validateName = (value: string): boolean => {
    if (!value.trim()) {
      setNameError(t('categories.categoryNameRequired'));
      return false;
    }
    if (value.trim().length < 2) {
      setNameError(t('categories.categoryNameMinLength'));
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
      selectedParentId !== category.parent_id ||
      selectedIcon !== category.icon ||
      selectedColor !== category.color
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
    // Always include icon/color so the user can clear them (null = "remove")
    if (selectedIcon !== category.icon) {
      updateData.icon = selectedIcon;
    }
    if (selectedColor !== category.color) {
      updateData.color = selectedColor;
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
      setSelectedIcon(category.icon);
      setSelectedColor(category.color);
      setNameError(null);
      onClose();
    }
  };

  // Prevent closing on backdrop click to avoid accidental data loss on mobile
  const handleDialogClose = (_event: object, reason: string) => {
    if (reason === 'backdropClick') return;
    handleClose();
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
      onClose={handleDialogClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="edit-category-dialog-title"
    >
      <DialogTitle id="edit-category-dialog-title">{t('categories.editCategory')}</DialogTitle>
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
            label={t('categories.categoryName')}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) {
                validateName(event.target.value);
              }
            }}
            onBlur={() => validateName(name)}
            error={!!nameError}
            helperText={nameError || t('categories.categoryNameHelper')}
            required
            autoFocus
            fullWidth
            disabled={isLoading}
          />

          {/* Category Kind Select */}
          <TextField
            select
            label={t('categories.categoryType')}
            value={selectedKind}
            onChange={(event) => {
              setSelectedKind(event.target.value as CategoryKind);
              // Reset parent selection when kind changes
              setSelectedParentId(null);
            }}
            required
            fullWidth
            disabled={isLoading}
            helperText={t('categories.categoryTypeHelperEdit')}
          >
            <MenuItem value="expense">{t('enums.transactionType.expense')}</MenuItem>
            <MenuItem value="income">{t('enums.transactionType.income')}</MenuItem>
          </TextField>

          {/* Parent Category Select (Optional) */}
          <CategorySelect
            value={selectedParentId}
            onChange={setSelectedParentId}
            kind={selectedKind}
            categories={availableParentCategories}
            label={t('categories.parentCategory')}
            placeholder={t('categories.parentCategoryPlaceholderEdit')}
            disabled={isLoading}
          />

          {/* Icon and color selection for visual identity across the app */}
          <IconPicker
            value={selectedIcon}
            onChange={setSelectedIcon}
            disabled={isLoading}
          />
          <ColorSwatchPicker
            value={selectedColor}
            onChange={setSelectedColor}
            disabled={isLoading}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || !name.trim() || !hasChanges()}
        >
          {isLoading ? t('common.loading') : t('categories.saveChanges')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default EditCategoryModal;
