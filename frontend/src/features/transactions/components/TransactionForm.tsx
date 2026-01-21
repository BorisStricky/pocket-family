// src/features/transactions/components/TransactionForm.tsx
// Form component for creating and editing transactions with React Hook Form validation

import React from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  FormLabel,
  FormHelperText,
  Button,
  Typography,
  InputLabel,
  Stack,
} from "@mui/material";
import type { TransactionRead, TransactionCreate } from "../types";

/**
 * Props for TransactionForm component
 */
interface TransactionFormProps {
  familyId: string;
  initialData?: TransactionRead;
  onSubmit: (data: TransactionCreate) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Form for creating or editing transactions
 *
 * Features:
 * - React Hook Form for form state management and validation
 * - Required fields: account, amount, date, transaction type
 * - Optional fields: category, description
 * - Client-side validation with helpful error messages
 * - Pre-populated fields in edit mode
 * - Loading state during submission
 *
 * Validation Rules:
 * - Amount must be a positive number greater than 0
 * - Transaction date is required and must be valid ISO date
 * - Account must be selected
 * - Transaction type must be selected (expense or income)
 *
 * @example
 * // Create mode
 * <TransactionForm
 *   familyId="tenant-123"
 *   onSubmit={handleCreate}
 *   onCancel={handleCancel}
 * />
 *
 * @example
 * // Edit mode
 * <TransactionForm
 *   familyId="tenant-123"
 *   initialData={existingTransaction}
 *   onSubmit={handleUpdate}
 *   onCancel={handleCancel}
 *   isLoading={isUpdating}
 * />
 */
export function TransactionForm({
  familyId,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: TransactionFormProps) {
  // Determine if this is create or edit mode based on initialData presence
  const isEditMode = !!initialData;

  // Set up form with React Hook Form and default values
  // In edit mode, pre-populate fields from initialData
  // In create mode, use sensible defaults (today's date, expense type)
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TransactionCreate>({
    defaultValues: initialData
      ? {
          tenant_id: initialData.tenant_id,
          account_id: initialData.account_id,
          category_id: initialData.category_id,
          amount: initialData.amount,
          currency: initialData.currency,
          transaction_date: initialData.transaction_date,
          transaction_type: initialData.transaction_type,
          description: initialData.description || "",
        }
      : {
          tenant_id: familyId,
          account_id: "",
          category_id: "",
          amount: "",
          currency: "BRL", // Brazilian Real as default currency for MVP
          transaction_date: new Date().toISOString().split("T")[0], // Today's date in YYYY-MM-DD
          transaction_type: "expense",
          description: "",
        },
  });

  // Handle form submission by passing data to parent component
  // The parent component will handle the API call and state updates
  const handleFormSubmit = (data: TransactionCreate) => {
    // Ensure tenant_id is set correctly for multi-tenant validation
    const submitData = {
      ...data,
      tenant_id: familyId,
    };
    onSubmit(submitData);
  };

  return (
    <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
      {/* Form Title */}
      <Typography variant="h6" gutterBottom>
        {isEditMode ? "Edit Transaction" : "Add Transaction"}
      </Typography>

      <Stack spacing={3} sx={{ mt: 2 }}>
        {/* Account Selection - Required Field */}
        <FormControl fullWidth error={!!errors.account_id} required>
          <InputLabel id="account-select-label">Account</InputLabel>
          <Controller
            name="account_id"
            control={control}
            rules={{ required: "Account is required" }}
            render={({ field }) => (
              <Select
                {...field}
                labelId="account-select-label"
                label="Account"
                disabled={isLoading}
              >
                {/* Temporary placeholder - replaced with real account from development database
                    TODO: Replace with dynamic account loading from /accounts API in future sprint */}
                <MenuItem value="">
                  <em>Select an account</em>
                </MenuItem>
                <MenuItem value="20c3fafc-b75f-4197-bfa9-b5dac43c6000">
                  Cash (BRL)
                </MenuItem>
              </Select>
            )}
          />
          {errors.account_id && (
            <FormHelperText>{errors.account_id.message}</FormHelperText>
          )}
        </FormControl>

        {/* Category Selection - Optional Field */}
        <FormControl fullWidth error={!!errors.category_id}>
          <InputLabel id="category-select-label">Category</InputLabel>
          <Controller
            name="category_id"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                labelId="category-select-label"
                label="Category"
                disabled={isLoading}
              >
                {/* Temporary placeholder - replaced with real category from development database
                    TODO: Replace with dynamic category loading from /categories API in future sprint */}
                <MenuItem value="">
                  <em>Uncategorized</em>
                </MenuItem>
                <MenuItem value="638d246d-ed81-4831-a511-8e76faa25e4a">
                  Test (Expense)
                </MenuItem>
              </Select>
            )}
          />
          {errors.category_id && (
            <FormHelperText>{errors.category_id.message}</FormHelperText>
          )}
        </FormControl>

        {/* Amount Input - Required Field with Validation */}
        <TextField
          label="Amount"
          type="text"
          required
          fullWidth
          error={!!errors.amount}
          helperText={errors.amount?.message || "Enter a positive number"}
          disabled={isLoading}
          {...register("amount", {
            required: "Amount is required",
            validate: (value) => {
              const numValue = Number(value);
              if (isNaN(numValue)) {
                return "Amount must be a valid number";
              }
              if (numValue <= 0) {
                return "Amount must be positive";
              }
              return true;
            },
          })}
        />

        {/* Transaction Date Input - Required Field */}
        <TextField
          label="Date"
          type="date"
          required
          fullWidth
          InputLabelProps={{ shrink: true }}
          error={!!errors.transaction_date}
          helperText={errors.transaction_date?.message}
          disabled={isLoading}
          {...register("transaction_date", {
            required: "Date is required",
          })}
        />

        {/* Transaction Type Selection - Required Field */}
        <FormControl fullWidth error={!!errors.transaction_type} required>
          <InputLabel id="type-select-label">Type</InputLabel>
          <Controller
            name="transaction_type"
            control={control}
            rules={{ required: "Type is required" }}
            render={({ field }) => (
              <Select
                {...field}
                labelId="type-select-label"
                label="Type"
                disabled={isLoading}
              >
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </Select>
            )}
          />
          {errors.transaction_type && (
            <FormHelperText>{errors.transaction_type.message}</FormHelperText>
          )}
        </FormControl>

        {/* Description Input - Optional Field */}
        <TextField
          label="Description"
          multiline
          rows={3}
          fullWidth
          error={!!errors.description}
          helperText={
            errors.description?.message ||
            "Optional notes about this transaction"
          }
          disabled={isLoading}
          {...register("description")}
        />

        {/* Form Action Buttons */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button onClick={onCancel} disabled={isLoading} variant="outlined">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            variant="contained"
            color="primary"
          >
            {isLoading ? "Saving..." : isEditMode ? "Update" : "Save"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
