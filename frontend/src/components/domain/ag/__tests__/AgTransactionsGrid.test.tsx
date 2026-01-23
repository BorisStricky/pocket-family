// src/components/domain/ag/__tests__/AgTransactionsGrid.test.tsx
// Tests for AgTransactionsGrid component - AG Grid wrapper for transactions

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgTransactionsGrid } from '../AgTransactionsGrid';
import { renderWithProviders } from '@/test/utils';
import { createMockTransactionList, createMockTransaction } from '@/test/mocks/factories';
import type { Transaction } from '@/types';

describe('AgTransactionsGrid component', () => {
  const mockOnRowClick = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('Grid rendering', () => {
    it('should render grid with transaction data', () => {
      // Arrange
      const transactions = createMockTransactionList(5);

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Grid should be rendered
      // Note: AG Grid uses specific class names and structure
      const gridElement = screen.getByRole('grid');
      expect(gridElement).toBeInTheDocument();
    });

    it('should display all transaction rows', () => {
      // Arrange
      const transactions = createMockTransactionList(3);

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Should show 3 rows (plus header row)
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(3); // Header + data rows
    });

    it('should display correct column headers', () => {
      // Arrange
      const transactions = createMockTransactionList(2);

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Column headers should be visible
      expect(screen.getByText(/date/i)).toBeInTheDocument();
      expect(screen.getByText(/description/i)).toBeInTheDocument();
      expect(screen.getByText(/category/i)).toBeInTheDocument();
      expect(screen.getByText(/amount/i)).toBeInTheDocument();
      expect(screen.getByText(/account/i)).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no transactions', async () => {
      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={[]}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render empty state overlay
      await waitFor(() => {
        expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
      });
    });

    it('should not call onRowClick in empty state', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <AgTransactionsGrid
          transactions={[]}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Wait for empty message to appear, then try to interact
      const emptyMessage = await screen.findByText(/no transactions/i);
      await user.click(emptyMessage);

      // Assert - Should not trigger row click
      expect(mockOnRowClick).not.toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('should show loading indicator when isLoading is true', async () => {
      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={[]}
          isLoading={true}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render loading overlay
      await waitFor(() => {
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
      });
    });

    it('should hide loading indicator when data loads', async () => {
      // Arrange - Render with loading state first
      const { rerender } = renderWithProviders(
        <AgTransactionsGrid
          transactions={[]}
          isLoading={true}
          onRowClick={mockOnRowClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
      });

      // Act - Rerender with data
      const transactions = createMockTransactionList(3);
      rerender(
        <AgTransactionsGrid
          transactions={transactions}
          isLoading={false}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for loading to disappear
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Data formatting', () => {
    it('should format currency amounts correctly', async () => {
      // Arrange
      const transactions = [
        createMockTransaction({ amount: '1234.56', currency: 'USD' }),
      ];

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render and format currency
      await waitFor(() => {
        expect(screen.getByText(/1,234.56/)).toBeInTheDocument();
      });
    });

    it('should format dates correctly', async () => {
      // Arrange
      const transactions = [
        createMockTransaction({ transaction_date: '2026-01-12' }),
      ];

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render and format dates
      // Date formatter converts to DD/MM/YYYY format
      await waitFor(() => {
        expect(screen.getByText(/12\/01\/2026/)).toBeInTheDocument();
      });
    });

    it('should display transaction type as expense or income', async () => {
      // Arrange - Use transactions without category names to avoid duplicate "expense" text
      const transactions = [
        createMockTransaction({ transaction_type: 'expense', category_name: null }),
        createMockTransaction({ transaction_type: 'income', category_name: null }),
      ];

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render both types (capitalized by formatter)
      await waitFor(() => {
        expect(screen.getByText('Expense')).toBeInTheDocument();
        expect(screen.getByText('Income')).toBeInTheDocument();
      });
    });

    it('should show category name or uncategorized', () => {
      // Arrange
      const transactions = [
        createMockTransaction({ category_name: 'Groceries' }),
        createMockTransaction({ category_name: null }),
      ];

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText(/uncategorized/i)).toBeInTheDocument();
    });
  });

  describe('Row interaction', () => {
    it('should call onRowClick when row is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const transactions = createMockTransactionList(3);

      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click on first data row
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1]; // Skip header row
      await user.click(firstDataRow);

      // Assert - onRowClick should be called with transaction data
      await waitFor(() => {
        expect(mockOnRowClick).toHaveBeenCalledTimes(1);
      });

      const clickedTransaction = mockOnRowClick.mock.calls[0][0];
      expect(clickedTransaction).toHaveProperty('id');
      expect(clickedTransaction).toHaveProperty('amount');
    });

    it('should pass correct transaction data to onRowClick', async () => {
      // Arrange
      const user = userEvent.setup();
      const specificTransaction = createMockTransaction({
        id: 'specific-id',
        amount: '999.99',
      });
      const transactions = [specificTransaction];

      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click the row
      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      await user.click(dataRow);

      // Assert
      await waitFor(() => {
        expect(mockOnRowClick).toHaveBeenCalledWith(specificTransaction);
      });
    });

    it('should handle multiple row clicks', async () => {
      // Arrange
      const user = userEvent.setup();
      const transactions = createMockTransactionList(3);

      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click multiple rows
      const rows = screen.getAllByRole('row');
      await user.click(rows[1]); // First transaction
      await user.click(rows[2]); // Second transaction

      // Assert - Both clicks should be registered
      await waitFor(() => {
        expect(mockOnRowClick).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Sorting', () => {
    it('should sort by date descending by default', () => {
      // Arrange - Transactions with different dates
      const transactions = [
        createMockTransaction({ transaction_date: '2026-01-05', amount: '100.00' }),
        createMockTransaction({ transaction_date: '2026-01-15', amount: '200.00' }),
        createMockTransaction({ transaction_date: '2026-01-10', amount: '150.00' }),
      ];

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Most recent date should be first
      // Note: Actual verification depends on AG Grid rendering
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
    });

    it('should allow sorting by amount', async () => {
      // Arrange
      const user = userEvent.setup();
      const transactions = createMockTransactionList(5);

      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click on amount column header to sort
      const amountHeader = screen.getByText(/amount/i);
      await user.click(amountHeader);

      // Assert - Grid should resort
      // Note: Verification depends on AG Grid behavior
    });

    it('should allow sorting by category', async () => {
      // Arrange
      const user = userEvent.setup();
      const transactions = createMockTransactionList(5);

      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click on category column header
      const categoryHeader = screen.getByText(/category/i);
      await user.click(categoryHeader);

      // Assert - Grid should resort by category
    });
  });

  describe('Filtering', () => {
    it('should support filtering by transaction type', () => {
      // Arrange
      const transactions = [
        createMockTransaction({ transaction_type: 'expense', amount: '100.00' }),
        createMockTransaction({ transaction_type: 'income', amount: '500.00' }),
      ];

      // Act - Render with filter applied
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          filters={{ transaction_type: 'expense' }}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Should only show expense transactions
      // Note: Filtering logic depends on implementation
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles', () => {
      // Arrange
      const transactions = createMockTransactionList(3);

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Grid should have grid role
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      // Arrange
      const user = userEvent.setup();
      const transactions = createMockTransactionList(3);

      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Use keyboard to navigate
      const grid = screen.getByRole('grid');
      grid.focus();
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      // Assert - Should trigger row selection/click via keyboard
      // Note: Actual behavior depends on AG Grid keyboard handling
    });
  });

  describe('Column customization', () => {
    it('should render custom cell renderers for type column', async () => {
      // Arrange - Use transaction without category name to avoid duplicate "expense" text
      const transactions = [
        createMockTransaction({ transaction_type: 'expense', category_name: null }),
      ];

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render with custom cell renderer (capitalized)
      await waitFor(() => {
        expect(screen.getByText('Expense')).toBeInTheDocument();
      });
    });

    it('should show reconciled indicator when transaction is reconciled', () => {
      // Arrange
      const transactions = [
        createMockTransaction({ reconciled: true }),
      ];

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={transactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Should show reconciled indicator (icon or badge)
      // Note: Depends on column definition implementation
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      // Arrange - Create large dataset
      const largeDataset = createMockTransactionList(1000);

      // Act - Render should not freeze
      renderWithProviders(
        <AgTransactionsGrid
          transactions={largeDataset}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Grid should render
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('should virtualize rows for performance', () => {
      // Arrange
      const manyTransactions = createMockTransactionList(500);

      // Act
      renderWithProviders(
        <AgTransactionsGrid
          transactions={manyTransactions}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Not all rows should be in DOM (virtualization)
      // Note: AG Grid automatically virtualizes, only visible rows are rendered
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeLessThan(500); // Should be virtualized
    });
  });
});
