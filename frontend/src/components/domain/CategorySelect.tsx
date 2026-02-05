// src/components/domain/CategorySelect.tsx
// Searchable dropdown component for selecting categories with hierarchical display
// Filters by category kind (expense/income) and supports keyboard navigation

import { useState, useMemo } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { ChevronRight } from 'lucide-react';
import type { CategoryRead, CategoryKind } from '@/types/category';

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
  label = 'Category',
  placeholder = 'Select a category',
  error = false,
  helperText,
  disabled = false,
  required = false,
}: CategorySelectProps) {
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
    const parents = filteredCategories.filter(cat => cat.parent_id === null);
    const children = filteredCategories.filter(cat => cat.parent_id !== null);

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
        onChange(newValue?.id || null);
      }}
      inputValue={inputValue}
      onInputChange={(_event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      options={sortedCategories}
      getOptionLabel={(option) => formatCategoryDisplay(option)}
      isOptionEqualToValue={(option, compareValue) => option.id === compareValue.id}
      disabled={disabled}
      // Custom filter to search across full path (parent + child names)
      filterOptions={(options, state) => {
        const searchTerm = state.inputValue.toLowerCase();
        if (!searchTerm) {
          return options;
        }
        return options.filter((option) => {
          const searchPath = buildSearchPath(option);
          return searchPath.includes(searchTerm);
        });
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          error={error}
          helperText={helperText}
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
            {/* Show indentation for child categories */}
            {option.parent_id && (
              <ChevronRight
                size={16}
                style={{ marginLeft: '8px', color: '#9e9e9e' }}
              />
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
                in {option.parent_name}
              </Typography>
            )}
            {/* Category kind badge */}
            <Chip
              label={option.kind}
              size="small"
              color={option.kind === 'expense' ? 'error' : 'success'}
              sx={{ height: 18, fontSize: '0.7rem' }}
            />
          </Box>
        </Box>
      )}
      // No options text when filtered list is empty
      noOptionsText={
        kind
          ? `No ${kind} categories found`
          : 'No categories found'
      }
    />
  );
}

export default CategorySelect;
