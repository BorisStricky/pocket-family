import React from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/**
 * SearchInput component with search icon and clear button
 *
 * A text input optimized for search functionality. Includes a search icon
 * on the left and a clear button on the right when text is entered.
 * Used for filtering lists, searching transactions, and finding data.
 *
 * @example
 * <SearchInput
 *   value={searchQuery}
 *   onChange={(value) => setSearchQuery(value)}
 *   placeholder="Search transactions..."
 * />
 */
export interface SearchInputProps {
  /** Current search value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the input should take full width */
  fullWidth?: boolean;
  /** Optional callback when clear button is clicked */
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  // Falls back to the shared translated "Search..." placeholder; callers can
  // pass a feature-specific placeholder (already translated) to override it.
  placeholder,
  disabled = false,
  fullWidth = false,
  onClear,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('common.search');

  // Handle input change
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  // Handle clear button click
  const handleClear = () => {
    onChange('');
    // Call optional onClear callback if provided
    if (onClear) {
      onClear();
    }
  };

  return (
    <TextField
      value={value}
      onChange={handleChange}
      placeholder={resolvedPlaceholder}
      disabled={disabled}
      fullWidth={fullWidth}
      size="small"
      InputProps={{
        // Search icon on the left
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" sx={{ color: 'action.active' }} />
          </InputAdornment>
        ),
        // Clear button on the right (only shown when there's text)
        endAdornment: value && (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={handleClear}
              edge="end"
              aria-label="Clear search"
              disabled={disabled}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ),
      }}
      sx={{
        // Subtle styling for search input
        '& .MuiOutlinedInput-root': {
          backgroundColor: 'background.paper',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
          '&.Mui-focused': {
            backgroundColor: 'background.paper',
          },
        },
      }}
    />
  );
};

export default SearchInput;
