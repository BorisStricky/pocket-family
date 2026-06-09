// src/features/budgets/components/BudgetForm.tsx
// Modal dialog form for creating and editing budgets
//
// Provides fields for budget name, spending limit amount, currency selection,
// and multi-select category picker. Uses React Hook Form for validation and
// MUI Autocomplete for the category multi-select with chip display.
// Pre-populates fields when editing an existing budget.

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Autocomplete,
  Chip,
  CircularProgress,
  Box,
} from '@mui/material';
import { useCategories } from '@/features/category/hooks/useCategories';
import type { CategoryRead } from '@/types/category';
import type { BudgetRead, BudgetCreatePayload, BudgetUpdatePayload } from '../types';
import { IconPicker } from '@/components/ui/molecules/IconPicker';
import { ColorSwatchPicker } from '@/components/ui/molecules/ColorSwatchPicker';

/**
 * Internal form data shape used by React Hook Form
 *
 * Differs from API payloads because:
 * - amount is a string for TextField input, converted to number on submit
 * - selectedCategories holds full CategoryRead objects for Autocomplete display,
 *   converted to string[] of IDs on submit
 */
interface BudgetFormData {
  name: string;
  amount: string; // String for input field, converted to number on submit
  currency: string;
  selectedCategories: CategoryRead[];
}

/**
 * Props for BudgetForm component
 *
 * When mode is 'edit', existingBudget must be provided to pre-populate fields.
 * The onSubmit callback receives the properly typed API payload.
 */
interface BudgetFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  existingBudget?: BudgetRead | null;
  familyId: string;
  onSubmit: (data: BudgetCreatePayload | BudgetUpdatePayload) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/**
 * BudgetForm Component
 *
 * Modal dialog for creating or editing budgets. Displays a form with:
 * - Name field (required text input)
 * - Amount field (required number input, must be > 0)
 * - Currency dropdown (default "BRL", only BRL option for now)
 * - Categories multi-select autocomplete (fetches from useCategories hook)
 *
 * In edit mode, all fields are pre-populated from the existing budget data.
 * Categories are matched by ID from the fetched category list to ensure
 * the Autocomplete displays the correct labels.
 *
 * On submit, form data is transformed into the API payload format:
 * - amount string is parsed to a number
 * - selectedCategories objects are mapped to an array of ID strings
 */
export function BudgetForm({
  open,
  mode,
  existingBudget,
  familyId,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: BudgetFormProps) {
  // Fetch all categories for the family to populate the multi-select dropdown
  // Categories are tenant-scoped, so we need the familyId to load the correct set
  const { data: allCategories = [], isLoading: isCategoriesLoading } = useCategories(familyId);

  // Icon and color are controlled outside React Hook Form because they use
  // custom picker components rather than standard input fields
  const [selectedIcon, setSelectedIcon] = useState<string | null>(
    mode === 'edit' && existingBudget ? existingBudget.icon : null
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(
    mode === 'edit' && existingBudget ? existingBudget.color : null
  );

  // Build default values for the form
  // In edit mode, pre-populate from existingBudget; in create mode, use sensible defaults
  const defaultName = mode === 'edit' && existingBudget ? existingBudget.name : '';
  const defaultAmount = mode === 'edit' && existingBudget ? String(existingBudget.amount) : '';
  const defaultCurrency = mode === 'edit' && existingBudget ? existingBudget.currency : 'BRL';

  // Match existing budget categories to the full category objects from the fetched list
  // This is needed because Autocomplete requires reference equality for selected values
  const defaultSelectedCategories: CategoryRead[] =
    mode === 'edit' && existingBudget
      ? existingBudget.categories
          .map((budgetCategory) =>
            allCategories.find((category) => category.id === budgetCategory.id)
          )
          .filter((category): category is CategoryRead => category !== undefined)
      : [];

  // Initialize React Hook Form with default values
  // Reset happens automatically when the dialog opens with new defaultValues
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BudgetFormData>({
    defaultValues: {
      name: defaultName,
      amount: defaultAmount,
      currency: defaultCurrency,
      selectedCategories: defaultSelectedCategories,
    },
  });

  // Reset form (and icon/color state) when dialog opens or existingBudget changes
  React.useEffect(() => {
    if (open) {
      reset({
        name: defaultName,
        amount: defaultAmount,
        currency: defaultCurrency,
        selectedCategories: defaultSelectedCategories,
      });
      setSelectedIcon(mode === 'edit' && existingBudget ? existingBudget.icon : null);
      setSelectedColor(mode === 'edit' && existingBudget ? existingBudget.color : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingBudget?.id, reset]);

  // Transform form data into API payload format and call onSubmit
  const handleFormSubmit = (formData: BudgetFormData) => {
    // Convert category objects to array of ID strings for the API
    const categoryIds = formData.selectedCategories.map((category) => category.id);

    const payload: BudgetCreatePayload | BudgetUpdatePayload = {
      name: formData.name,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      category_ids: categoryIds.length > 0 ? categoryIds : [],
      icon: selectedIcon,
      color: selectedColor,
    };

    onSubmit(payload);
  };

  return (
    <Dialog
      open={open}
      // Prevent closing on backdrop click to avoid accidental data loss on mobile
      onClose={(_event: object, reason: string) => {
        if (reason === 'backdropClick') return;
        onCancel();
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{mode === 'create' ? 'Create Budget' : 'Edit Budget'}</DialogTitle>

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Budget name field - required */}
            <Controller
              name="name"
              control={control}
              rules={{
                required: 'Budget name is required',
                minLength: { value: 1, message: 'Budget name cannot be empty' },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  placeholder="e.g., Monthly Entertainment"
                  autoFocus
                />
              )}
            />

            {/* Budget amount field - required, must be a positive number */}
            <Controller
              name="amount"
              control={control}
              rules={{
                required: 'Amount is required',
                validate: (value) => {
                  const numericValue = parseFloat(value);
                  if (isNaN(numericValue)) return 'Amount must be a number';
                  if (numericValue <= 0) return 'Amount must be greater than 0';
                  return true;
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Amount"
                  type="number"
                  fullWidth
                  error={!!errors.amount}
                  helperText={errors.amount?.message}
                  placeholder="e.g., 500.00"
                  inputProps={{ min: 0.01, step: 0.01 }}
                />
              )}
            />

            {/* Currency dropdown - defaults to BRL, only BRL available for now */}
            {/* Future: add more currency options when multi-currency support is needed */}
            <Controller
              name="currency"
              control={control}
              rules={{ required: 'Currency is required' }}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.currency}>
                  <InputLabel id="budget-currency-label">Currency</InputLabel>
                  <Select
                    {...field}
                    labelId="budget-currency-label"
                    label="Currency"
                  >
                    <MenuItem value="BRL">BRL</MenuItem>
                  </Select>
                  {errors.currency && (
                    <FormHelperText>{errors.currency.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />

            {/* Categories multi-select autocomplete */}
            {/* Empty selection creates a "universal budget" that tracks all tenant spending */}
            <Controller
              name="selectedCategories"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Autocomplete
                  multiple
                  options={allCategories}
                  getOptionLabel={(option) => option.name}
                  // Use ID comparison for equality since objects from different sources
                  // (fetched list vs budget.categories) won't have reference equality
                  isOptionEqualToValue={(option, selectedValue) => option.id === selectedValue.id}
                  value={value}
                  onChange={(_event, newValue) => onChange(newValue)}
                  loading={isCategoriesLoading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Categories"
                      placeholder={value.length === 0 ? 'All Categories (universal budget)' : 'Add categories...'}
                      helperText="Leave empty to track all tenant spending"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {isCategoriesLoading ? <CircularProgress size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  // Display selected categories as chips for visual clarity
                  renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={option.id}
                        label={option.name}
                        size="small"
                      />
                    ))
                  }
                />
              )}
            />
            {/* Icon and color for visual identity in budget lists */}
            <IconPicker
              value={selectedIcon}
              onChange={setSelectedIcon}
              disabled={isSubmitting}
            />
            <ColorSwatchPicker
              value={selectedColor}
              onChange={setSelectedColor}
              disabled={isSubmitting}
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
