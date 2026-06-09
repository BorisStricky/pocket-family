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
  CircularProgress,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { enUS } from "date-fns/locale";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";
import { useCategories } from "@/features/category/hooks/useCategories";
import { CategorySelect } from "@/components/domain/CategorySelect";
import { AccountSelect } from "@/components/domain/AccountSelect";
import type { TransactionRead, TransactionCreate } from "../types";
import type { CategoryRead } from "@/types/category";

/**
 * Props for TransactionForm component
 */
interface TransactionFormProps {
  familyId: string;
  initialData?: TransactionRead;
  /** Partial overrides for create-mode defaults (used for session memory) */
  defaultOverrides?: Partial<TransactionCreate>;
  onSubmit: (data: TransactionCreate) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Hide the form title when rendered inside a Dialog with its own DialogTitle */
  hideTitle?: boolean;
}

/**
 * Form for creating or editing transactions
 *
 * Features:
 * - React Hook Form for form state management and validation
 * - Required fields: account, amount, currency, date, transaction type, category
 * - Optional fields: description
 * - Client-side validation with helpful error messages
 * - Pre-populated fields in edit mode
 * - Loading state during submission
 *
 * Validation Rules:
 * - Amount must be a positive number greater than 0
 * - Transaction date is required and must be valid ISO date
 * - Account must be selected
 * - Transaction type must be selected (expense or income)
 * - Category must be selected
 * - Currency must be selected (BRL, USD, or EUR)
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
  defaultOverrides,
  onSubmit,
  onCancel,
  isLoading = false,
  hideTitle = false,
}: TransactionFormProps) {
  // Determine if this is create or edit mode based on initialData presence
  const isEditMode = !!initialData;

  // Fetch accounts for the current family to populate account dropdown
  // Uses React Query for caching and automatic refetching
  const {
    data: accounts = [],
    isLoading: isLoadingAccounts,
    isError: isAccountsError,
  } = useAccounts(familyId);

  // Fetch categories for the current family to populate category selector
  // Categories are filtered by transaction type (expense/income) in CategorySelect component
  const { data: categories = [], isLoading: isLoadingCategories } =
    useCategories(familyId);

  // Set up form with React Hook Form and default values
  // In edit mode, pre-populate fields from initialData
  // In create mode, use sensible defaults (today's date, expense type)
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
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
          account_id: defaultOverrides?.account_id || "",
          category_id: defaultOverrides?.category_id || "",
          amount: "", // Always fresh — amount varies per transaction
          currency: defaultOverrides?.currency || "BRL",
          transaction_date: defaultOverrides?.transaction_date || new Date().toISOString().split("T")[0],
          transaction_type: defaultOverrides?.transaction_type || "expense",
          description: "", // Always fresh — description varies per transaction
        },
  });

  // Watch transaction_type to dynamically filter categories in CategorySelect
  // When user switches between expense/income, CategorySelect will only show relevant categories
  const watchedTransactionType = watch("transaction_type");

  // Watch category_id to track selected category for CategorySelect component
  const selectedCategoryId = watch("category_id");

  // Find selected category object from categories list
  // CategorySelect expects the full category object, not just the ID
  const selectedCategory = categories.find(
    (category: CategoryRead) => category.id === selectedCategoryId,
  );

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
      {/* Form Title — hidden when rendered inside a modal Dialog */}
      {!hideTitle && (
        <Typography variant="h6" gutterBottom>
          {isEditMode ? "Edit Transaction" : "Add Transaction"}
        </Typography>
      )}

      <Stack spacing={3} sx={{ mt: hideTitle ? 0 : 2 }}>
        {/* Account Selection - Required Field */}
        {/* Uses AccountSelect (Autocomplete) to display icon/color swatches in options and selected state */}
        <Controller
          name="account_id"
          control={control}
          rules={{ required: "Account is required" }}
          render={({ field }) => (
            <AccountSelect
              label="Account"
              value={field.value || null}
              onChange={(accountId) => field.onChange(accountId || "")}
              accounts={accounts}
              required
              disabled={isLoading || isLoadingAccounts}
              loading={isLoadingAccounts}
              error={!!errors.account_id}
              helperText={
                errors.account_id?.message ||
                (isAccountsError ? "Error loading accounts" : undefined)
              }
            />
          )}
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

        {/* Category Selection - Required Field */}
        {/* CategorySelect filters by transaction type to show only relevant categories */}
        {/* Supports hierarchical display (parent > child) and search functionality */}
        {isLoadingCategories ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Loading categories...
            </Typography>
          </Box>
        ) : (
          <Controller
            name="category_id"
            control={control}
            rules={{
              required: "Category is required",
              validate: (value) =>
                (value && value !== "") || "Please select a category",
            }}
            render={({ field }) => (
              <CategorySelect
                label="Category"
                value={field.value || null}
                onChange={(categoryId: string | null) => {
                  // Update form value when category selection changes
                  // CategorySelect passes the category ID directly (not the full object)
                  field.onChange(categoryId || "");
                }}
                categories={categories}
                kind={watchedTransactionType}
                required={true}
                disabled={isLoading}
                error={!!errors.category_id}
                helperText={
                  errors.category_id?.message ||
                  "Required - select a category to classify this transaction"
                }
              />
            )}
          />
        )}

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

        {/* Currency Selection - Required Field */}
        {/* Multi-currency support for international transactions */}
        <FormControl fullWidth error={!!errors.currency} required>
          <InputLabel id="currency-select-label">Currency</InputLabel>
          <Controller
            name="currency"
            control={control}
            rules={{ required: "Currency is required" }}
            render={({ field }) => (
              <Select
                {...field}
                labelId="currency-select-label"
                label="Currency"
                disabled={isLoading}
              >
                <MenuItem value="BRL">Brazilian Real (BRL)</MenuItem>
                <MenuItem value="USD">United States Dollar (USD)</MenuItem>
                <MenuItem value="EUR">Euro (EUR)</MenuItem>
              </Select>
            )}
          />
          {errors.currency && (
            <FormHelperText>{errors.currency.message}</FormHelperText>
          )}
        </FormControl>

        {/* Transaction Date Input - Required Field */}
        {/* Uses MUI DatePicker for consistent dd-MMM-yyyy format across the app */}
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enUS}>
          <Controller
            name="transaction_date"
            control={control}
            rules={{ required: "Date is required" }}
            render={({ field }) => (
              <DatePicker
                label="Date *"
                format="dd-MMM-yyyy"
                value={field.value ? (() => {
                  // Parse YYYY-MM-DD string into local Date to avoid timezone shifts
                  const [year, month, day] = field.value.split("-").map(Number);
                  return new Date(year, month - 1, day);
                })() : null}
                onChange={(newDate: Date | null) => {
                  if (newDate) {
                    // Convert Date back to YYYY-MM-DD for the API
                    const year = newDate.getFullYear();
                    const month = String(newDate.getMonth() + 1).padStart(2, "0");
                    const day = String(newDate.getDate()).padStart(2, "0");
                    field.onChange(`${year}-${month}-${day}`);
                  } else {
                    field.onChange("");
                  }
                }}
                disabled={isLoading}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.transaction_date,
                    helperText: errors.transaction_date?.message,
                  },
                }}
              />
            )}
          />
        </LocalizationProvider>

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
          <Button
            onClick={onCancel}
            disabled={isLoading || isSubmitting}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading || isSubmitting}
            variant="contained"
            color="primary"
          >
            {isLoading || isSubmitting
              ? "Saving..."
              : isEditMode
                ? "Update"
                : "Save"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
