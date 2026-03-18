// src/features/accounts/components/AccountForm.tsx
// Form component for creating and editing accounts with React Hook Form validation

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
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
  // Determine if this is create or edit mode
  const isEditMode = mode === 'edit';

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

  // Handle form submission by passing data to parent component
  // The parent component will handle the API call and state updates
  const handleFormSubmit = (data: AccountCreate) => {
    onSubmit(data);
  };

  return (
    <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
      {/* Form Title — hidden when rendered inside a modal Dialog */}
      {!hideTitle && (
        <Typography variant="h6" gutterBottom>
          {isEditMode ? 'Edit Account' : 'Add Account'}
        </Typography>
      )}

      <Stack spacing={3} sx={{ mt: hideTitle ? 0 : 2 }}>
        {/* Account Name - Required Field */}
        <TextField
          {...register('name', {
            required: 'Account name is required',
            minLength: {
              value: 1,
              message: 'Account name cannot be empty',
            },
          })}
          label="Account Name"
          placeholder="e.g., Checking Account, Credit Card"
          fullWidth
          required
          error={!!errors.name}
          helperText={errors.name?.message}
          disabled={isLoading}
        />

        {/* Account Type Selection - Required Field */}
        <FormControl fullWidth error={!!errors.type} required>
          <InputLabel id="type-select-label">Account Type</InputLabel>
          <Controller
            name="type"
            control={control}
            rules={{ required: 'Account type is required' }}
            render={({ field }) => (
              <Select
                {...field}
                labelId="type-select-label"
                label="Account Type"
                disabled={isLoading}
              >
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="debit">Debit (Checking/Savings)</MenuItem>
                <MenuItem value="credit">Credit Card</MenuItem>
              </Select>
            )}
          />
          {errors.type && (
            <FormHelperText>{errors.type.message}</FormHelperText>
          )}
        </FormControl>

        {/* Currency Selection - Required Field with Default */}
        <FormControl fullWidth error={!!errors.currency} required>
          <InputLabel id="currency-select-label">Currency</InputLabel>
          <Controller
            name="currency"
            control={control}
            rules={{ required: 'Currency is required' }}
            render={({ field }) => (
              <Select
                {...field}
                labelId="currency-select-label"
                label="Currency"
                disabled={isLoading}
              >
                <MenuItem value="BRL">BRL - Brazilian Real</MenuItem>
                <MenuItem value="USD">USD - US Dollar</MenuItem>
                <MenuItem value="EUR">EUR - Euro</MenuItem>
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
                return 'Balance must be a valid number';
              }

              // For non-credit accounts, balance must be >= 0
              // Credit accounts can start with negative balance (debt)
              if (numValue < 0) {
                return 'Balance cannot be negative';
              }

              return true;
            },
          })}
          label="Initial Balance"
          type="number"
          placeholder="0.00"
          fullWidth
          error={!!errors.balance}
          helperText={
            errors.balance?.message ||
            'Leave empty to default to 0'
          }
          disabled={isLoading}
          inputProps={{
            step: '0.01',
            min: '0',
          }}
        />

        {/* Form Action Buttons */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
          >
            {isLoading
              ? 'Saving...'
              : isEditMode
              ? 'Update Account'
              : 'Create Account'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
