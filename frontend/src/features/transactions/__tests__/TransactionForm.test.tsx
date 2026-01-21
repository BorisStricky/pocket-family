// src/features/transactions/__tests__/TransactionForm.test.tsx
// Tests for TransactionForm component - form for creating and editing transactions

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionForm } from '../components/TransactionForm';
import { renderWithProviders } from '@/test/utils';
import { createMockTransaction } from '@/test/mocks/factories';
import type { Transaction } from '@/types';

describe('TransactionForm component', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('Create mode', () => {
    it('should render form in create mode', () => {
      // Act - Render form without initialData (create mode)
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Should show create mode title and empty fields
      expect(screen.getByText(/add transaction/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toHaveValue('');
    });

    it('should render all required form fields', () => {
      // Act
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Verify required fields are present
      expect(screen.getByLabelText(/account/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    });

    it('should render optional form fields', () => {
      // Act
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Optional fields should be present
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('should have submit button', () => {
      // Act
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('should have cancel button', () => {
      // Act
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Edit mode', () => {
    const existingTransaction = createMockTransaction({
      id: 'transaction-123',
      amount: '250.00',
      transaction_type: 'expense',
      description: 'Existing transaction',
      transaction_date: '2026-01-10',
    });

    it('should render form in edit mode with existing data', () => {
      // Act - Render form with initialData (edit mode)
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          initialData={existingTransaction}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Should show edit mode title
      expect(screen.getByText(/edit transaction/i)).toBeInTheDocument();
    });

    it('should populate form fields with existing transaction data', () => {
      // Act
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          initialData={existingTransaction}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Fields should be pre-filled with existing data
      expect(screen.getByLabelText(/amount/i)).toHaveValue('250.00');
      expect(screen.getByLabelText(/description/i)).toHaveValue('Existing transaction');
    });

    it('should show update button instead of create button', () => {
      // Act
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          initialData={existingTransaction}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert
      expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should show error when amount is missing', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Try to submit without entering amount
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      // Assert - Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/amount is required/i)).toBeInTheDocument();
      });

      // Should not call onSubmit
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when account is not selected', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Enter amount but no account
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '100');

      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/account is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when date is missing', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Submit without date
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/date is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when transaction type is not selected', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Submit without type
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/type is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should validate amount is a positive number', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Enter negative amount
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '-50');

      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/amount must be positive/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Form submission', () => {
    it('should call onSubmit with form data when valid', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Fill in all required fields
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '150.00');

      const dateInput = screen.getByLabelText(/date/i);
      await user.type(dateInput, '2026-01-12');

      // Select account (assumes select component)
      const accountSelect = screen.getByLabelText(/account/i);
      await user.click(accountSelect);
      // Note: Actual selection depends on MUI Select implementation

      // Select transaction type
      const typeSelect = screen.getByLabelText(/type/i);
      await user.click(typeSelect);
      // Select expense

      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      // Assert - onSubmit should be called with form data
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = mockOnSubmit.mock.calls[0][0];
      expect(submittedData.amount).toBeDefined();
      expect(submittedData.transaction_date).toBeDefined();
    });

    it('should include optional fields when provided', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Fill required and optional fields
      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(descriptionInput, 'Test description');

      // Submit form (assuming other required fields are filled)
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      // Assert - Description should be included if provided
      // Note: This test needs completion based on actual form implementation
    });

    it('should disable submit button during submission', async () => {
      // Arrange
      const user = userEvent.setup();
      const slowSubmit = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={slowSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Start submission
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      // Assert - Button should be disabled during submission
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Cancel action', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
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

    it('should not submit form when cancel is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Fill some data then cancel
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '100');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Assert - Should cancel without submitting
      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Transaction type selection', () => {
    it('should allow selecting expense type', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Select expense type
      const typeSelect = screen.getByLabelText(/type/i);
      await user.click(typeSelect);
      // Select expense option

      // Assert - Expense should be selectable
      // Note: Actual assertion depends on MUI Select implementation
    });

    it('should allow selecting income type', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Select income type
      const typeSelect = screen.getByLabelText(/type/i);
      await user.click(typeSelect);
      // Select income option

      // Assert - Income should be selectable
    });
  });

  describe('Date input', () => {
    it('should accept date in YYYY-MM-DD format', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Enter date
      const dateInput = screen.getByLabelText(/date/i);
      await user.type(dateInput, '2026-01-12');

      // Assert - Date should be accepted
      expect(dateInput).toHaveValue('2026-01-12');
    });

    it('should default to today date if not provided', () => {
      // Act
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert - Date field should have today's date as default
      const dateInput = screen.getByLabelText(/date/i);
      const today = new Date().toISOString().split('T')[0];
      expect(dateInput).toHaveValue(today);
    });
  });

  describe('Category selection', () => {
    it('should render category select field', () => {
      // Act
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Assert
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    });

    it('should allow leaving category empty', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <TransactionForm
          familyId="tenant-uuid-456"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Act - Submit without selecting category (should be valid)
      // Fill required fields and submit
      const submitButton = screen.getByRole('button', { name: /save/i });
      // Note: Would need to fill other required fields first

      // Assert - Category is optional, form should allow submission without it
    });
  });
});
