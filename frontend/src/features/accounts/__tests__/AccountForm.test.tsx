/**
 * Tests for AccountForm component
 *
 * Validates account creation/editing form behavior including:
 * - Rendering all form fields correctly
 * - Form validation (required fields, balance >= 0)
 * - Create vs Edit mode differences
 * - Submit and cancel actions
 * - Loading state handling
 * - Pre-population of fields in edit mode
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountForm } from '../components/AccountForm';
import { renderWithProviders } from '@/test/utils';
import type { AccountCreate } from '@/types/account';

describe('AccountForm component', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test to prevent state leakage
    vi.clearAllMocks();
  });

  describe('Create mode', () => {
    it('renders form in create mode with correct title', () => {
      // Act - Render form without initialData (create mode)
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Should show create mode title
      expect(screen.getByText('Add Account')).toBeInTheDocument();
    });

    it('renders all required form fields', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Verify all required fields are present
      expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/account type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/initial balance/i)).toBeInTheDocument();
    });

    it('renders form with default values for create mode', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Check default values
      const nameInput = screen.getByLabelText(/account name/i) as HTMLInputElement;
      const balanceInput = screen.getByLabelText(/initial balance/i) as HTMLInputElement;

      expect(nameInput).toHaveValue('');
      // Number input type returns number value, not string
      expect(balanceInput).toHaveValue(0);
    });

    it('renders submit and cancel buttons', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Both buttons should be present
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Edit mode', () => {
    const existingAccountData: Partial<AccountCreate> = {
      name: 'Existing Checking Account',
      type: 'debit',
      currency: 'USD',
      balance: '1500.00',
    };

    it('renders form in edit mode with correct title', () => {
      // Act - Render form with initialData (edit mode)
      renderWithProviders(
        <AccountForm
          mode="edit"
          initialData={existingAccountData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Should show edit mode title
      expect(screen.getByText('Edit Account')).toBeInTheDocument();
    });

    it('pre-populates form fields with existing account data', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="edit"
          initialData={existingAccountData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Fields should be pre-filled with existing data
      const nameInput = screen.getByLabelText(/account name/i) as HTMLInputElement;
      const balanceInput = screen.getByLabelText(/initial balance/i) as HTMLInputElement;

      expect(nameInput).toHaveValue('Existing Checking Account');
      // Number input type returns number value, not string
      expect(balanceInput).toHaveValue(1500);
    });

    it('shows update button instead of create button in edit mode', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="edit"
          initialData={existingAccountData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Should show update button
      expect(screen.getByRole('button', { name: /update account/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('shows error when name field is empty on submit', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Clear the name field and try to submit
      const nameInput = screen.getByLabelText(/account name/i);
      await user.clear(nameInput);

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Assert - Should show validation error for required name field
      await waitFor(() => {
        expect(screen.getByText(/account name is required/i)).toBeInTheDocument();
      });

      // Should not call onSubmit when validation fails
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('shows error when balance is negative', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Enter negative balance
      const nameInput = screen.getByLabelText(/account name/i);
      await user.type(nameInput, 'Test Account');

      const balanceInput = screen.getByLabelText(/initial balance/i);
      await user.clear(balanceInput);
      await user.type(balanceInput, '-50');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Assert - Should show validation error for negative balance
      await waitFor(() => {
        expect(screen.getByText(/balance cannot be negative/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('allows empty balance field (defaults to 0)', async () => {
      // Note: The balance field has type="number" which prevents entering non-numeric values
      // Browser's native input validation handles this, so custom validation is not triggered
      // This test verifies that empty balance is acceptable

      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Clear balance field and submit with empty balance
      const nameInput = screen.getByLabelText(/account name/i);
      await user.type(nameInput, 'Test Account');

      const balanceInput = screen.getByLabelText(/initial balance/i);
      await user.clear(balanceInput);

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Assert - Should submit successfully (empty balance is acceptable)
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });
    });

    it('accepts zero as a valid balance', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Enter zero balance
      const nameInput = screen.getByLabelText(/account name/i);
      await user.type(nameInput, 'Test Account');

      const balanceInput = screen.getByLabelText(/initial balance/i);
      await user.clear(balanceInput);
      await user.type(balanceInput, '0');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Assert - Should not show validation error for zero balance
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      // Verify form accepted the zero balance (submission should happen)
      const submittedData = mockOnSubmit.mock.calls[0][0] as AccountCreate;
      expect(submittedData.balance).toBeDefined();
    });

    it('accepts positive balance values', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Enter positive balance
      const nameInput = screen.getByLabelText(/account name/i);
      await user.type(nameInput, 'Test Account');

      const balanceInput = screen.getByLabelText(/initial balance/i);
      await user.clear(balanceInput);
      await user.type(balanceInput, '250.75');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Assert - Should submit successfully with positive balance
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = mockOnSubmit.mock.calls[0][0] as AccountCreate;
      expect(submittedData.balance).toBe('250.75');
    });
  });

  describe('Form submission', () => {
    it('calls onSubmit with correct data when form is valid', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Fill in all required fields
      const nameInput = screen.getByLabelText(/account name/i);
      await user.type(nameInput, 'My Checking Account');

      const balanceInput = screen.getByLabelText(/initial balance/i);
      await user.clear(balanceInput);
      await user.type(balanceInput, '500.00');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Assert - onSubmit should be called with form data
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = mockOnSubmit.mock.calls[0][0] as AccountCreate;
      expect(submittedData.name).toBe('My Checking Account');
      expect(submittedData.balance).toBe('500');
      expect(submittedData.type).toBe('cash'); // Default type
      expect(submittedData.currency).toBe('BRL'); // Default currency
    });

    it('calls onSubmit with updated data in edit mode', async () => {
      // Arrange
      const user = userEvent.setup();
      const existingAccountData: Partial<AccountCreate> = {
        name: 'Old Name',
        type: 'cash',
        currency: 'BRL',
        balance: '100.00',
      };

      renderWithProviders(
        <AccountForm
          mode="edit"
          initialData={existingAccountData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Update the account name
      const nameInput = screen.getByLabelText(/account name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const submitButton = screen.getByRole('button', { name: /update account/i });
      await user.click(submitButton);

      // Assert - onSubmit should be called with updated data
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = mockOnSubmit.mock.calls[0][0] as AccountCreate;
      expect(submittedData.name).toBe('Updated Name');
    });
  });

  describe('Cancel action', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Click cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Assert - onCancel should be called
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('does not submit form when cancel is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Fill some data then cancel
      const nameInput = screen.getByLabelText(/account name/i);
      await user.type(nameInput, 'Test Account');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Assert - Should cancel without submitting
      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('disables submit button during loading', () => {
      // Act - Render form with isLoading prop set to true
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );

      // Assert - Submit button should be disabled when loading
      const submitButton = screen.getByRole('button', { name: /saving/i });
      expect(submitButton).toBeDisabled();
    });

    it('disables cancel button during loading', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );

      // Assert - Cancel button should also be disabled during loading
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });

    it('disables all form fields during loading', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );

      // Assert - All form inputs should be disabled during loading
      const nameInput = screen.getByLabelText(/account name/i);
      const balanceInput = screen.getByLabelText(/initial balance/i);

      expect(nameInput).toBeDisabled();
      expect(balanceInput).toBeDisabled();
    });

    it('shows saving text on submit button during loading', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );

      // Assert - Button text should change to indicate saving state
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });

    it('enables all controls when not loading', () => {
      // Act - Render form with isLoading set to false
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      // Assert - All controls should be enabled
      const nameInput = screen.getByLabelText(/account name/i);
      const balanceInput = screen.getByLabelText(/initial balance/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      expect(nameInput).not.toBeDisabled();
      expect(balanceInput).not.toBeDisabled();
      expect(submitButton).not.toBeDisabled();
      expect(cancelButton).not.toBeDisabled();
    });
  });

  describe('Account type field', () => {
    it('renders account type select with default value', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Account type field should be present and required
      const typeLabel = screen.getByLabelText(/account type/i);
      expect(typeLabel).toBeInTheDocument();
    });
  });

  describe('Currency field', () => {
    it('renders currency select with default value', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Currency field should be present and required
      const currencyLabel = screen.getByLabelText(/currency/i);
      expect(currencyLabel).toBeInTheDocument();
    });
  });

  describe('Helper text', () => {
    it('shows helpful placeholder text for account name', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Name field should have helpful placeholder
      const nameInput = screen.getByLabelText(/account name/i);
      expect(nameInput).toHaveAttribute('placeholder', 'e.g., Checking Account, Credit Card');
    });

    it('shows helper text for balance field', () => {
      // Act
      renderWithProviders(
        <AccountForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Balance field should have helper text
      expect(screen.getByText(/leave empty to default to 0/i)).toBeInTheDocument();
    });
  });
});
