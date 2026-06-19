// src/features/accounts/components/AccountForm.tsx
// Form component for creating and editing accounts with React Hook Form validation

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Button,
  Typography,
  Stack,
} from '@mui/material';
import type { AccountCreate, AccountType, Currency } from '@/types/account';
import { IconPicker } from '@/components/ui/molecules/IconPicker';
import { ColorSwatchPicker } from '@/components/ui/molecules/ColorSwatchPicker';

/**
 * Props for AccountForm component
 */
interface AccountFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<AccountCreate>;
  onSubmit: (data: AccountCreate) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Hide the form title when rendered inside a Dialog with its own DialogTitle */
  hideTitle?: boolean;
}

/**
 * Form for creating or editing financial accounts
 *
 * Features:
 * - React Hook Form for form state management and validation
 * - Required fields: name, account type
 * - Optional fields: currency (defaults to BRL), initial balance (defaults to 0)
 * - Client-side validation with helpful error messages
 * - Pre-populated fields in edit mode
 * - Loading state during submission
 *
 * Validation Rules:
 * - Name is required and cannot be empty
 * - Balance must be a number >= 0 (no negative initial balances except for credit)
 * - Account type must be selected (cash, debit, or credit)
 * - Currency must be selected (BRL, USD, or EUR)
 *
 * @example
 * // Create mode
 * <AccountForm
 *   mode="create"
 *   onSubmit={handleCreate}
 *   onCancel={handleClose}
 * />
 *
 * @example
 * // Edit mode
 * <AccountForm
 *   mode="edit"
 *   initialData={existingAccount}
 *   onSubmit={handleUpdate}
 *   onCancel={handleClose}
 *   isLoading={isUpdating}
 * />
 */
export function AccountForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  hideTitle = false,
}: AccountFormProps) {
  const { t } = useTranslation();
  // Determine if this is create or edit mode
  const isEditMode = mode === 'edit';

  // Icon and color are controlled outside React Hook Form because they use
  // custom picker components rather than standard input fields
  const [selectedIcon, setSelectedIcon] = useState<string | null>(initialData?.icon ?? null);
  const [selectedColor, setSelectedColor] = useState<string | null>(initialData?.color ?? null);

  // Set up form with React Hook Form and default values
  // In edit mode, pre-populate fields from initialData
  // In create mode, use sensible defaults (BRL currency, 0 balance, cash type)
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountCreate>({
    defaultValues: initialData || {
      name: '',
      type: 'cash',
      currency: 'BRL',
      balance: '0',
    },
  });

  // Handle form submission by passing data (plus icon/color state) to parent component
  const handleFormSubmit = (data: AccountCreate) => {
    onSubmit({ ...data, icon: selectedIcon, color: selectedColor });
  };

  return (
    <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
      {/* Form Title — hidden when rendered inside a modal Dialog */}
      {!hideTitle && (
        <Typography variant="h6" gutterBottom>
          {isEditMode ? t('accounts.formTitleEdit') : t('accounts.formTitleCreate')}
        </Typography>
      )}

      <Stack spacing={3} sx={{ mt: hideTitle ? 0 : 2 }}>
        {/* Account Name - Required Field */}
        <TextField
          {...register('name', {
            required: t('accounts.accountNameRequired'),
            minLength: {
              value: 1,
              message: t('accounts.accountNameEmpty'),
            },
          })}
          label={t('accounts.accountName')}
          placeholder={t('accounts.accountNamePlaceholder')}
          fullWidth
          required
          error={!!errors.name}
          helperText={errors.name?.message}
          disabled={isLoading}
        />

        {/* Account Type Selection - Required Field */}
        <FormControl fullWidth error={!!errors.type} required>
          <InputLabel id="type-select-label">{t('accounts.accountType')}</InputLabel>
          <Controller
            name="type"
            control={control}
            rules={{ required: t('accounts.accountTypeRequired') }}
            render={({ field }) => (
              <Select
                {...field}
                labelId="type-select-label"
                label={t('accounts.accountType')}
                disabled={isLoading}
              >
                {/* Use enums.accountType keys for the standard labels, with a
                    localised parenthetical clarifier for debit accounts */}
                <MenuItem value="cash">{t('accounts.typeOptionCashLabel')}</MenuItem>
                <MenuItem value="debit">{t('accounts.typeOptionDebitLabel')}</MenuItem>
                <MenuItem value="credit">{t('accounts.typeOptionCreditLabel')}</MenuItem>
              </Select>
            )}
          />
          {errors.type && (
            <FormHelperText>{errors.type.message}</FormHelperText>
          )}
        </FormControl>

        {/* Currency Selection - Required Field with Default */}
        <FormControl fullWidth error={!!errors.currency} required>
          <InputLabel id="currency-select-label">{t('accounts.currency')}</InputLabel>
          <Controller
            name="currency"
            control={control}
            rules={{ required: t('accounts.currencyRequired') }}
            render={({ field }) => (
              <Select
                {...field}
                labelId="currency-select-label"
                label={t('accounts.currency')}
                disabled={isLoading}
              >
                {/* Currency codes (BRL/USD/EUR) stay as ISO codes — only the
                    descriptive name beside the code is translated */}
                <MenuItem value="BRL">{t('accounts.currencyBRL')}</MenuItem>
                <MenuItem value="USD">{t('accounts.currencyUSD')}</MenuItem>
                <MenuItem value="EUR">{t('accounts.currencyEUR')}</MenuItem>
              </Select>
            )}
          />
          {errors.currency && (
            <FormHelperText>{errors.currency.message}</FormHelperText>
          )}
        </FormControl>

        {/* Initial Balance - Optional Field with Validation */}
        <TextField
          {...register('balance', {
            validate: (value) => {
              // Allow empty values (defaults to 0 on backend)
              if (!value) return true;

              const numValue = Number(value);

              // Check if it's a valid number
              if (isNaN(numValue)) {
                return t('accounts.balanceMustBeNumber');
              }

              // For non-credit accounts, balance must be >= 0
              // Credit accounts can start with negative balance (debt)
              if (numValue < 0) {
                return t('accounts.balanceCannotBeNegative');
              }

              return true;
            },
          })}
          label={t('accounts.initialBalance')}
          type="number"
          placeholder="0.00"
          fullWidth
          error={!!errors.balance}
          helperText={
            errors.balance?.message ||
            t('accounts.balanceDefaultHint')
          }
          disabled={isLoading}
          inputProps={{
            step: '0.01',
            min: '0',
          }}
        />

        {/* Icon and color for visual identity in account lists and cards */}
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

        {/* Form Action Buttons */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            onClick={onCancel}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
          >
            {isLoading
              ? t('accounts.saving')
              : isEditMode
              ? t('accounts.updateAccount')
              : t('accounts.createAccount')}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
