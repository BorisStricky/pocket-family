// src/components/domain/AccountSelect.tsx
// Searchable dropdown component for selecting an account with icon/color display.
// Follows the same Autocomplete pattern as CategorySelect for consistent UX.

import { useMemo } from 'react';
import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import type { AccountRead } from '@/types/account';
import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/Icon';

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
  label = 'Account',
  placeholder = 'Select an account',
  disabled = false,
  required = false,
  error = false,
  helperText,
  loading = false,
}: AccountSelectProps) {
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
      onChange={(_event, newValue) => onChange(newValue?.id ?? null)}
      options={sortedAccounts}
      getOptionLabel={(option) => `${option.name} (${option.type})`}
      isOptionEqualToValue={(option, compareValue) => option.id === compareValue.id}
      disabled={disabled}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
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
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <AccountSwatch account={option} />
            <Typography variant="body2" sx={{ flex: 1 }}>
              {option.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {option.type} · {option.currency}
            </Typography>
          </Box>
        </Box>
      )}
      noOptionsText="No accounts found"
    />
  );
}

export default AccountSelect;
