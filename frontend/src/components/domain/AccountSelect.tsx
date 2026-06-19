// src/components/domain/AccountSelect.tsx
// Searchable dropdown component for selecting an account with icon/color display.
// Follows the same Autocomplete pattern as CategorySelect for consistent UX.

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import { Plus } from 'lucide-react';
import type { AccountRead } from '@/types/account';
import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/Icon';

// Sentinel ID used to represent the "Create new account" option in the dropdown.
// When the user selects this option, onCreateNew is called instead of setting a value.
const CREATE_NEW_ID = '__CREATE_ACCOUNT__';

// Minimal sentinel object that satisfies the AccountRead shape for MUI Autocomplete
const createNewSentinel: AccountRead = {
  id: CREATE_NEW_ID,
  user_id: '',
  user_name: '',
  name: '',
  type: 'cash',
  currency: 'BRL',
  balance: null,
  icon: null,
  color: null,
  created_at: '',
  updated_at: '',
};

export interface AccountSelectProps {
  /** Currently selected account ID */
  value: string | null;
  /** Callback when account selection changes */
  onChange: (accountId: string | null) => void;
  /** Array of available accounts */
  accounts: AccountRead[];
  /** Optional label for the select field */
  label?: string;
  /** Optional placeholder text */
  placeholder?: string;
  /** Optional disabled state */
  disabled?: boolean;
  /** Optional required field indicator */
  required?: boolean;
  /** Optional error state */
  error?: boolean;
  /** Optional helper/error message */
  helperText?: string;
  /** Show a loading spinner in the input while accounts are fetching */
  loading?: boolean;
  /** When provided, an inline "Create new account" option appears at the bottom of the list */
  onCreateNew?: () => void;
}

/** Render the icon/color circle swatch for an account, or null if neither is set */
function AccountSwatch({ account, size = 18 }: { account: AccountRead; size?: number }) {
  if (!account.icon && !account.color) return null;
  return (
    <Box
      component="span"
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: account.color ?? 'transparent',
        border: account.color ? 'none' : '1px dashed',
        borderColor: 'divider',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {account.icon && (
        <Icon
          name={account.icon as IconName}
          size={Math.round(size * 0.6)}
          style={{ color: account.color ? '#fff' : 'inherit' }}
        />
      )}
    </Box>
  );
}

/**
 * AccountSelect — searchable dropdown for picking an account, with icon/color swatches.
 *
 * @example
 * <AccountSelect
 *   value={selectedAccountId}
 *   onChange={(id) => setSelectedAccountId(id)}
 *   accounts={accounts}
 *   label="Account"
 *   required
 * />
 */
export function AccountSelect({
  value,
  onChange,
  accounts,
  // Default to the shared translated label/placeholder; callers may override.
  label,
  placeholder,
  disabled = false,
  required = false,
  error = false,
  helperText,
  loading = false,
  onCreateNew,
}: AccountSelectProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('accountSelect.label');
  const resolvedPlaceholder = placeholder ?? t('accountSelect.placeholder');

  // Localize an account's type enum for display (e.g. cash → Dinheiro).
  const accountTypeLabel = (type: string) => t(`enums.accountType.${type}`);

  // Sort accounts alphabetically by name for consistent ordering
  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

  const selectedAccount = useMemo(
    () => sortedAccounts.find((account) => account.id === value) ?? null,
    [value, sortedAccounts],
  );

  return (
    <Autocomplete
      value={selectedAccount}
      onChange={(_event, newValue) => {
        // When the sentinel is selected, open the creation flow instead of setting a value
        if (newValue?.id === CREATE_NEW_ID) {
          onCreateNew?.();
          return;
        }
        onChange(newValue?.id ?? null);
      }}
      options={sortedAccounts}
      getOptionLabel={(option) => {
        if (option.id === CREATE_NEW_ID) return '';
        return `${option.name} (${accountTypeLabel(option.type)})`;
      }}
      isOptionEqualToValue={(option, compareValue) => option.id === compareValue.id}
      disabled={disabled}
      loading={loading}
      // Custom filter: match on the account label, then always append the
      // "Create new account" sentinel at the bottom when onCreateNew is provided
      filterOptions={(options, state) => {
        const searchTerm = state.inputValue.toLowerCase();
        const realOptions = options.filter((option) => option.id !== CREATE_NEW_ID);
        const filtered = searchTerm
          ? realOptions.filter((option) =>
              `${option.name} (${accountTypeLabel(option.type)})`
                .toLowerCase()
                .includes(searchTerm),
            )
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
            // Show the selected account's swatch before the text input
            startAdornment: (
              <>
                {selectedAccount && (
                  <Box component="span" sx={{ ml: 0.5, mr: 0.5, display: 'inline-flex', alignItems: 'center' }}>
                    <AccountSwatch account={selectedAccount} size={16} />
                  </Box>
                )}
                {params.InputProps.startAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        // Render the "Create new account" sentinel distinctively
        if (option.id === CREATE_NEW_ID) {
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
                  {t('accountSelect.createNew')}
                </Typography>
              </Box>
            </Box>
          );
        }

        return (
          <Box component="li" {...props} key={option.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <AccountSwatch account={option} />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {option.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {accountTypeLabel(option.type)} · {option.currency}
              </Typography>
            </Box>
          </Box>
        );
      }}
      noOptionsText={t('accountSelect.noAccounts')}
    />
  );
}

export default AccountSelect;
