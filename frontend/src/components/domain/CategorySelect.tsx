// src/components/domain/CategorySelect.tsx
// Searchable dropdown component for selecting categories with hierarchical display
// Filters by category kind (expense/income) and supports keyboard navigation
// Optionally shows a "Create new category" sentinel option at the bottom of the list

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { ChevronRight, Plus } from 'lucide-react';
import type { CategoryRead, CategoryKind } from '@/types/category';
import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/Icon';

// Sentinel ID used to represent the "Create new category" option in the dropdown.
// When the user selects this option, onCreateNew is called instead of setting a value.
const CREATE_NEW_ID = '__CREATE_NEW__';

// Minimal sentinel object that satisfies the CategoryRead shape for MUI Autocomplete
const createNewSentinel: CategoryRead = {
  id: CREATE_NEW_ID,
  name: '',
  kind: 'expense',
  parent_id: null,
  parent_name: null,
  tenant_id: '',
  created_at: '',
  updated_at: '',
};

/**
 * Props for CategorySelect component
 */
export interface CategorySelectProps {
  /** Currently selected category ID */
  value: string | null;
  /** Callback when category selection changes */
  onChange: (categoryId: string | null) => void;
  /** Optional filter by category kind (expense or income) */
  kind?: CategoryKind;
  /** Array of available categories */
  categories: CategoryRead[];
  /** Optional label for the select field */
  label?: string;
  /** Optional placeholder text */
  placeholder?: string;
  /** Optional error state */
  error?: boolean;
  /** Optional error message */
  helperText?: string;
  /** Optional disabled state */
  disabled?: boolean;
  /** Optional required field indicator */
  required?: boolean;
  /**
   * When provided, a "+ Create new category" option is appended to the dropdown.
   * Called with the user's current search text so the creation modal can pre-fill it.
   */
  onCreateNew?: (inputText?: string) => void;
}

/**
 * Format category for display with parent hierarchy
 * Shows full path like "Food > Groceries" for child categories
 *
 * @param category - Category to format
 * @returns Formatted display string with hierarchy
 */
function formatCategoryDisplay(category: CategoryRead): string {
  if (category.parent_name) {
    return `${category.parent_name} > ${category.name}`;
  }
  return category.name;
}

/**
 * Build full path string for category including all ancestors
 * Used for search filtering to match against parent names
 *
 * @param category - Category to build path for
 * @returns Full path string for searching
 */
function buildSearchPath(category: CategoryRead): string {
  const parts: string[] = [];
  if (category.parent_name) {
    parts.push(category.parent_name.toLowerCase());
  }
  parts.push(category.name.toLowerCase());
  return parts.join(' ');
}

/**
 * CategorySelect - Searchable dropdown for selecting categories
 * Features hierarchical display, filtering by kind, and search across full paths
 *
 * @example
 * <CategorySelect
 *   value={selectedCategoryId}
 *   onChange={(id) => setSelectedCategoryId(id)}
 *   kind="expense"
 *   categories={categories}
 *   label="Category"
 *   required
 * />
 */
export function CategorySelect({
  value,
  onChange,
  kind,
  categories,
  // Default to the shared translated label/placeholder; callers may override
  // with their own (already-translated) text.
  label,
  placeholder,
  error = false,
  helperText,
  disabled = false,
  required = false,
  onCreateNew,
}: CategorySelectProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('categorySelect.label');
  const resolvedPlaceholder = placeholder ?? t('categorySelect.placeholder');

  // Track search input value for custom filtering
  const [inputValue, setInputValue] = useState('');

  // Filter categories by kind if specified
  const filteredCategories = useMemo(() => {
    if (!kind) {
      return categories;
    }
    return categories.filter((category) => category.kind === kind);
  }, [categories, kind]);

  // Find currently selected category object
  const selectedCategory = useMemo(() => {
    if (!value) {
      return null;
    }
    return filteredCategories.find((cat) => cat.id === value) || null;
  }, [value, filteredCategories]);

  // Sort categories hierarchically: each parent followed immediately by its children
  // Parents sorted alphabetically, children sorted alphabetically within each parent
  const sortedCategories = useMemo(() => {
    // Separate parents and children
    const parents = filteredCategories.filter(category => category.parent_id === null);
    const children = filteredCategories.filter(category => category.parent_id !== null);

    // Sort parents alphabetically
    parents.sort((a, b) => a.name.localeCompare(b.name));

    // Build final list: each parent followed by its children
    const result: CategoryRead[] = [];
    for (const parent of parents) {
      result.push(parent);

      // Find and sort this parent's children alphabetically
      const parentChildren = children
        .filter(child => child.parent_id === parent.id)
        .sort((a, b) => a.name.localeCompare(b.name));

      result.push(...parentChildren);
    }

    return result;
  }, [filteredCategories]);

  return (
    <Autocomplete
      value={selectedCategory}
      onChange={(_event, newValue) => {
        // When the sentinel is selected, open the creation flow instead of setting a value
        if (newValue?.id === CREATE_NEW_ID) {
          onCreateNew?.(inputValue || undefined);
          setInputValue('');
          return;
        }
        onChange(newValue?.id || null);
      }}
      inputValue={inputValue}
      onInputChange={(_event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      options={sortedCategories}
      getOptionLabel={(option) => {
        if (option.id === CREATE_NEW_ID) return '';
        return formatCategoryDisplay(option);
      }}
      isOptionEqualToValue={(option, compareValue) => option.id === compareValue.id}
      disabled={disabled}
      // Custom filter: search across full path (parent + child names), then always append
      // the "Create new" sentinel at the bottom when onCreateNew is provided
      filterOptions={(options, state) => {
        const searchTerm = state.inputValue.toLowerCase();
        const realOptions = options.filter((option) => option.id !== CREATE_NEW_ID);
        const filtered = searchTerm
          ? realOptions.filter((option) => buildSearchPath(option).includes(searchTerm))
          : realOptions;

        if (onCreateNew) {
          return [...filtered, createNewSentinel];
        }
        return filtered;
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={resolvedLabel}
          placeholder={resolvedPlaceholder}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            // Show the selected category's color/icon swatch before the text input
            startAdornment: (
              <>
                {selectedCategory && (selectedCategory.icon || selectedCategory.color) && (
                  <Box
                    component="span"
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: selectedCategory.color ?? 'transparent',
                      border: selectedCategory.color ? 'none' : '1px dashed',
                      borderColor: 'divider',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      ml: 0.5,
                      mr: 0.5,
                    }}
                  >
                    {selectedCategory.icon && (
                      <Icon
                        name={selectedCategory.icon as IconName}
                        size={10}
                        style={{ color: selectedCategory.color ? '#fff' : 'inherit' }}
                      />
                    )}
                  </Box>
                )}
                {params.InputProps.startAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        // Render the "Create new category" sentinel distinctively
        if (option.id === CREATE_NEW_ID) {
          const createLabel = inputValue
            ? t('categorySelect.createNewWithText', { text: inputValue })
            : t('categorySelect.createNew');
          return (
            <Box
              component="li"
              {...props}
              key={CREATE_NEW_ID}
              sx={{ borderTop: '1px solid', borderColor: 'divider', color: 'primary.main' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Plus size={16} />
                <Typography variant="body2" color="primary" fontWeight={600}>
                  {createLabel}
                </Typography>
              </Box>
            </Box>
          );
        }

        return (
          <Box component="li" {...props} key={option.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
              {/* Show indentation for child categories */}
              {option.parent_id && (
                <ChevronRight
                  size={16}
                  style={{ marginLeft: '8px', color: '#9e9e9e' }}
                />
              )}
              {/* Color circle with optional icon when at least one is set */}
              {(option.icon || option.color) && (
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: option.color ?? 'transparent',
                    border: option.color ? 'none' : '1px dashed',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {option.icon && (
                    <Icon
                      name={option.icon as IconName}
                      size={10}
                      style={{ color: option.color ? '#fff' : 'inherit' }}
                    />
                  )}
                </Box>
              )}
              {/* Category name */}
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  fontWeight: option.parent_id ? 'normal' : 600,
                }}
              >
                {option.name}
              </Typography>
              {/* Parent name for context (shown for child categories) */}
              {option.parent_name && (
                <Typography variant="caption" color="text.secondary">
                  {t('categorySelect.inParent', { parent: option.parent_name })}
                </Typography>
              )}
              {/* Category kind badge — localize the expense/income kind label */}
              <Chip
                label={t(`enums.transactionType.${option.kind}`)}
                size="small"
                color={option.kind === 'expense' ? 'error' : 'success'}
                sx={{ height: 18, fontSize: '0.7rem' }}
              />
            </Box>
          </Box>
        );
      }}
      // No options text is only reached when onCreateNew is not provided and no matches exist
      noOptionsText={
        kind
          ? t('categorySelect.noCategoriesOfKind', {
              kind: t(`enums.transactionType.${kind}`).toLowerCase(),
            })
          : t('categorySelect.noCategories')
      }
    />
  );
}

export default CategorySelect;
