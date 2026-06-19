// src/features/category/components/AddCategoryModal.tsx
// Modal dialog for creating new categories with name, kind, and parent selection

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
import type { CategoryCreate, CategoryKind, CategoryRead } from '@/types/category';
import { CategorySelect } from '@/components/domain/CategorySelect';
import { IconPicker } from '@/components/ui/molecules/IconPicker';
import { ColorSwatchPicker } from '@/components/ui/molecules/ColorSwatchPicker';

/**
 * Props for AddCategoryModal component
 */
export interface AddCategoryModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when category is created with form data */
  onCreate: (data: CategoryCreate) => void;
  /** Optional pre-selected parent category ID */
  parentId?: string | null;
  /** Optional pre-selected category kind */
  kind?: CategoryKind;
  /** Array of existing categories for parent selection */
  categories: CategoryRead[];
  /** Optional loading state during creation */
  isLoading?: boolean;
  /** Optional error message */
  error?: string | null;
  /** Optional initial name to pre-fill (e.g. from a search typed in CategorySelect) */
  initialName?: string;
}

/**
 * AddCategoryModal - Modal form for creating new categories
 * Validates category name and allows selecting parent category and kind
 *
 * @example
 * <AddCategoryModal
 *   open={modalOpen}
 *   onClose={() => setModalOpen(false)}
 *   onCreate={(data) => createCategory(data)}
 *   categories={categories}
 * />
 */
export function AddCategoryModal({
  open,
  onClose,
  onCreate,
  parentId = null,
  kind = 'expense',
  categories,
  isLoading = false,
  error = null,
  initialName = '',
}: AddCategoryModalProps) {
  const { t } = useTranslation();

  // Form state
  const [name, setName] = useState('');
  const [selectedKind, setSelectedKind] = useState<CategoryKind>(kind);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(parentId);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Form validation
  const [nameError, setNameError] = useState<string | null>(null);

  // Sync form state from props whenever the modal opens.
  // useState only uses its initial value on first mount, so when the always-mounted
  // modal reopens with different kind/parentId/initialName props, we must explicitly update state.
  useEffect(() => {
    if (open) {
      setSelectedKind(kind);
      setSelectedParentId(parentId);
      // Pre-fill name from the search text the user typed in CategorySelect (if any)
      setName(initialName ?? '');
      setNameError(null);
      setSelectedIcon(null);
      setSelectedColor(null);
    }
  }, [open, kind, parentId, initialName]);

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
   * Handle form submission
   * Validates inputs and calls onCreate callback
   */
  const handleSubmit = () => {
    // Validate name
    if (!validateName(name)) {
      return;
    }

    // Create category data object
    const categoryData: CategoryCreate = {
      name: name.trim(),
      kind: selectedKind,
      parent_id: selectedParentId,
      icon: selectedIcon,
      color: selectedColor,
    };

    onCreate(categoryData);
  };

  /**
   * Handle modal close
   * Resets form state when modal is closed
   */
  const handleClose = () => {
    if (!isLoading) {
      setName('');
      setSelectedKind(kind);
      setSelectedParentId(parentId);
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
   * Filter categories for parent selection based on selected kind
   * Parent must have same kind as child
   */
  const parentCategoriesForKind = categories.filter(
    (category) => category.kind === selectedKind
  );

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="add-category-dialog-title"
    >
      <DialogTitle id="add-category-dialog-title">{t('categories.addCategory')}</DialogTitle>
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
            helperText={t('categories.categoryTypeHelper')}
          >
            <MenuItem value="expense">{t('enums.transactionType.expense')}</MenuItem>
            <MenuItem value="income">{t('enums.transactionType.income')}</MenuItem>
          </TextField>

          {/* Parent Category Select (Optional) */}
          <CategorySelect
            value={selectedParentId}
            onChange={setSelectedParentId}
            kind={selectedKind}
            categories={parentCategoriesForKind}
            label={t('categories.parentCategory')}
            placeholder={t('categories.parentCategoryPlaceholderAdd')}
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
          disabled={isLoading || !name.trim()}
        >
          {isLoading ? t('categories.creating') : t('categories.createCategory')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddCategoryModal;
