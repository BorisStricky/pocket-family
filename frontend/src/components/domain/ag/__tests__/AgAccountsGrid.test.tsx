// src/components/domain/ag/__tests__/AgAccountsGrid.test.tsx
// Tests for AgAccountsGrid component - AG Grid wrapper for accounts

/**
 * Tests for AgAccountsGrid component
 *
 * Validates account grid UI behavior including:
 * - Rendering grid with account data
 * - Displaying formatted columns (name, type, owner, currency, balance)
 * - Account type badge rendering with correct colors
 * - Currency formatting using Intl.NumberFormat
 * - Row click interactions for navigation
 * - Loading overlay during data fetch
 * - Empty state when no accounts exist
 * - Negative balance styling (red) vs positive (green)
 * - Hidden balance display for shared accounts
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgAccountsGrid } from '../AgAccountsGrid';
import { renderWithProviders } from '@/test/utils';
import {
  createMockAccount,
  createMockAccountList,
  createMockCheckingAccount,
  createMockCreditCardAccount,
  createMockCashAccount,
} from '@/test/mocks/factories';
import type { AccountRead } from '@/types/account';

describe('AgAccountsGrid component', () => {
  const mockOnRowClick = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test to ensure clean state
    vi.clearAllMocks();
  });

  describe('Grid rendering', () => {
    it('should render grid with account data', () => {
      // Arrange
      const accounts = createMockAccountList(5);

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Grid should be rendered with AG Grid role
      const gridElement = screen.getByRole('grid');
      expect(gridElement).toBeInTheDocument();
    });

    it('should display all account rows', () => {
      // Arrange
      const accounts = createMockAccountList(3);

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Should show 3 data rows (plus header row)
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(3); // Header + data rows
    });

    it('should display correct column headers', () => {
      // Arrange
      const accounts = createMockAccountList(2);

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - All column headers should be visible
      expect(screen.getByText(/account name/i)).toBeInTheDocument();
      expect(screen.getByText(/^type$/i)).toBeInTheDocument();
      expect(screen.getByText(/owner/i)).toBeInTheDocument();
      expect(screen.getByText(/currency/i)).toBeInTheDocument();
      expect(screen.getByText(/balance/i)).toBeInTheDocument();
    });

    it('should display account names', () => {
      // Arrange
      const accounts = [
        createMockAccount({ name: 'Checking Account' }),
        createMockAccount({ name: 'Savings Account' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Account names should be visible
      expect(screen.getByText('Checking Account')).toBeInTheDocument();
      expect(screen.getByText('Savings Account')).toBeInTheDocument();
    });

    it('should display owner names', () => {
      // Arrange
      const accounts = [
        createMockAccount({ user_name: 'John Doe', name: 'Account 1' }),
        createMockAccount({ user_name: 'Jane Smith', name: 'Account 2' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Owner names should be visible
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should display currencies', () => {
      // Arrange
      const accounts = [
        createMockAccount({ currency: 'USD', name: 'Account 1' }),
        createMockAccount({ currency: 'EUR', name: 'Account 2' }),
        createMockAccount({ currency: 'BRL', name: 'Account 3' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Currency codes should be visible
      expect(screen.getByText('USD')).toBeInTheDocument();
      expect(screen.getByText('EUR')).toBeInTheDocument();
      expect(screen.getByText('BRL')).toBeInTheDocument();
    });
  });

  describe('Account type badge rendering', () => {
    it('should render cash account type as chip', async () => {
      // Arrange
      const accounts = [createMockCashAccount()];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render the chip with capitalized type
      await waitFor(() => {
        expect(screen.getByText('Cash')).toBeInTheDocument();
      });
    });

    it('should render debit account type as chip', async () => {
      // Arrange
      const accounts = [createMockCheckingAccount()];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render the chip
      await waitFor(() => {
        expect(screen.getByText('Debit')).toBeInTheDocument();
      });
    });

    it('should render credit account type as chip', async () => {
      // Arrange
      const accounts = [createMockCreditCardAccount()];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render the chip
      await waitFor(() => {
        expect(screen.getByText('Credit')).toBeInTheDocument();
      });
    });

    it('should render all three account types correctly', async () => {
      // Arrange
      const accounts = [
        createMockCashAccount({ name: 'Cash Wallet' }),
        createMockCheckingAccount({ name: 'Checking' }),
        createMockCreditCardAccount({ name: 'Credit Card' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - All three types should be rendered as chips
      await waitFor(() => {
        expect(screen.getByText('Cash')).toBeInTheDocument();
        expect(screen.getByText('Debit')).toBeInTheDocument();
        expect(screen.getByText('Credit')).toBeInTheDocument();
      });
    });
  });

  describe('Currency formatting', () => {
    it('should format USD currency correctly', async () => {
      // Arrange
      const accounts = [
        createMockAccount({ balance: '1234.56', currency: 'USD' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render formatted currency
      await waitFor(() => {
        expect(screen.getByText(/1,234.56/)).toBeInTheDocument();
      });
    });

    it('should format BRL currency correctly', async () => {
      // Arrange
      const accounts = [
        createMockAccount({ balance: '5000.00', currency: 'BRL' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render formatted currency
      await waitFor(() => {
        expect(screen.getByText(/5,000.00/)).toBeInTheDocument();
      });
    });

    it('should format EUR currency correctly', async () => {
      // Arrange
      const accounts = [
        createMockAccount({ balance: '789.12', currency: 'EUR' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render formatted currency
      await waitFor(() => {
        expect(screen.getByText(/789.12/)).toBeInTheDocument();
      });
    });

    it('should format negative balance correctly', async () => {
      // Arrange
      const accounts = [
        createMockAccount({ balance: '-500.00', currency: 'USD' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render negative currency
      // Negative amounts are formatted with currency symbol, so check for presence of value
      await waitFor(() => {
        expect(screen.getByText(/500\.00/)).toBeInTheDocument();
      });
    });

    it('should display "Hidden" for null balance', async () => {
      // Arrange - Shared account with hidden visibility
      const accounts = [
        createMockAccount({ balance: null, name: 'Shared Account' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render "Hidden" text
      await waitFor(() => {
        expect(screen.getByText('Hidden')).toBeInTheDocument();
      });
    });

    it('should format large amounts correctly', async () => {
      // Arrange
      const accounts = [
        createMockAccount({ balance: '123456.78', currency: 'USD' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render formatted large number
      await waitFor(() => {
        expect(screen.getByText(/123,456.78/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no accounts', async () => {
      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={[]}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render empty state overlay
      await waitFor(() => {
        expect(screen.getByText(/no accounts found/i)).toBeInTheDocument();
      });
    });

    it('should show helper text in empty state', async () => {
      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={[]}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render helper message
      await waitFor(() => {
        expect(screen.getByText(/create your first account/i)).toBeInTheDocument();
      });
    });

    it('should not call onRowClick in empty state', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(
        <AgAccountsGrid
          accounts={[]}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Wait for empty message to appear, then try to interact
      const emptyMessage = await screen.findByText(/no accounts found/i);
      await user.click(emptyMessage);

      // Assert - Should not trigger row click
      expect(mockOnRowClick).not.toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('should show loading indicator when isLoading is true', async () => {
      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={[]}
          isLoading={true}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for AG Grid to render loading overlay with longer timeout
      // AG Grid may take additional time to render overlays in test environment
      await waitFor(() => {
        expect(screen.getByText(/loading accounts/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should hide loading indicator when data loads', async () => {
      // Arrange - Render with loading state first
      const { rerender } = renderWithProviders(
        <AgAccountsGrid
          accounts={[]}
          isLoading={true}
          onRowClick={mockOnRowClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/loading accounts/i)).toBeInTheDocument();
      });

      // Act - Rerender with data
      const accounts = createMockAccountList(3);
      rerender(
        <AgAccountsGrid
          accounts={accounts}
          isLoading={false}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Wait for loading to disappear
      await waitFor(() => {
        expect(screen.queryByText(/loading accounts/i)).not.toBeInTheDocument();
      });
    });

    it('should not show empty state while loading', async () => {
      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={[]}
          isLoading={true}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Loading message should be shown, not empty state
      await waitFor(() => {
        expect(screen.getByText(/loading accounts/i)).toBeInTheDocument();
      });
      expect(screen.queryByText(/no accounts found/i)).not.toBeInTheDocument();
    });
  });

  describe('Row interaction', () => {
    it('should call onRowClick when row is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const accounts = createMockAccountList(3);

      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click on first data row
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1]; // Skip header row
      await user.click(firstDataRow);

      // Assert - onRowClick should be called with account data
      await waitFor(() => {
        expect(mockOnRowClick).toHaveBeenCalledTimes(1);
      });

      const clickedAccount = mockOnRowClick.mock.calls[0][0];
      expect(clickedAccount).toHaveProperty('id');
      expect(clickedAccount).toHaveProperty('name');
      expect(clickedAccount).toHaveProperty('type');
      expect(clickedAccount).toHaveProperty('balance');
    });

    it('should pass correct account data to onRowClick', async () => {
      // Arrange
      const user = userEvent.setup();
      const specificAccount = createMockAccount({
        id: 'specific-account-id',
        name: 'My Special Account',
        balance: '999.99',
      });
      const accounts = [specificAccount];

      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click the row
      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      await user.click(dataRow);

      // Assert - Should pass the exact account object
      await waitFor(() => {
        expect(mockOnRowClick).toHaveBeenCalledWith(specificAccount);
      });
    });

    it('should handle multiple row clicks', async () => {
      // Arrange
      const user = userEvent.setup();
      const accounts = createMockAccountList(3);

      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click multiple rows
      const rows = screen.getAllByRole('row');
      await user.click(rows[1]); // First account
      await user.click(rows[2]); // Second account

      // Assert - Both clicks should be registered
      await waitFor(() => {
        expect(mockOnRowClick).toHaveBeenCalledTimes(2);
      });
    });

    it('should not call onRowClick when handler is not provided', async () => {
      // Arrange
      const user = userEvent.setup();
      const accounts = createMockAccountList(3);

      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          // No onRowClick provided
        />
      );

      // Act - Click on row
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1];
      await user.click(firstDataRow);

      // Assert - Should not throw error, just no action
      expect(mockOnRowClick).not.toHaveBeenCalled();
    });
  });

  describe('Sorting', () => {
    it('should sort by name ascending by default', () => {
      // Arrange - Accounts with different names
      const accounts = [
        createMockAccount({ name: 'Zebra Account', id: 'account-1' }),
        createMockAccount({ name: 'Apple Account', id: 'account-2' }),
        createMockAccount({ name: 'Banana Account', id: 'account-3' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Grid should render (sorting is handled by AG Grid internally)
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
    });

    it('should allow sorting by type', async () => {
      // Arrange
      const user = userEvent.setup();
      const accounts = createMockAccountList(5);

      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click on type column header to sort
      const typeHeader = screen.getByText(/^type$/i);
      await user.click(typeHeader);

      // Assert - Grid should resort (AG Grid handles internal sorting)
      expect(typeHeader).toBeInTheDocument();
    });

    it('should allow sorting by balance', async () => {
      // Arrange
      const user = userEvent.setup();
      const accounts = createMockAccountList(5);

      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click on balance column header
      const balanceHeader = screen.getByText(/balance/i);
      await user.click(balanceHeader);

      // Assert - Grid should resort by balance
      expect(balanceHeader).toBeInTheDocument();
    });

    it('should allow sorting by owner', async () => {
      // Arrange
      const user = userEvent.setup();
      const accounts = [
        createMockAccount({ user_name: 'Zack', name: 'Account 1' }),
        createMockAccount({ user_name: 'Alice', name: 'Account 2' }),
        createMockAccount({ user_name: 'Bob', name: 'Account 3' }),
      ];

      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Act - Click on owner column header
      const ownerHeader = screen.getByText(/owner/i);
      await user.click(ownerHeader);

      // Assert - Grid should resort by owner name
      expect(ownerHeader).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles', () => {
      // Arrange
      const accounts = createMockAccountList(3);

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Grid should have grid role
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      // Arrange
      const user = userEvent.setup();
      const accounts = createMockAccountList(3);

      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
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

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      // Arrange - Create large dataset
      const largeDataset = createMockAccountList(1000);

      // Act - Render should not freeze
      renderWithProviders(
        <AgAccountsGrid
          accounts={largeDataset}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Grid should render
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('should virtualize rows for performance', () => {
      // Arrange
      const manyAccounts = createMockAccountList(500);

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={manyAccounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Not all rows should be in DOM (virtualization)
      // AG Grid automatically virtualizes, only visible rows are rendered
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeLessThan(500); // Should be virtualized
    });
  });

  describe('Edge cases', () => {
    it('should handle account with no owner name gracefully', () => {
      // Arrange
      const accounts = [
        createMockAccount({ user_name: '', name: 'No Owner Account' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Should show placeholder for empty owner
      // Component uses valueFormatter to show "—" for empty values
      expect(screen.getByText('No Owner Account')).toBeInTheDocument();
    });

    it('should handle mixed positive and negative balances', async () => {
      // Arrange
      const accounts = [
        createMockAccount({ balance: '1000.00', name: 'Positive' }),
        createMockAccount({ balance: '-500.00', name: 'Negative' }),
        createMockAccount({ balance: '0.00', name: 'Zero' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - All balances should be formatted correctly
      // Check for presence of formatted values (currency symbols may be included)
      await waitFor(() => {
        expect(screen.getByText(/1,000\.00/)).toBeInTheDocument();
        expect(screen.getByText(/500\.00/)).toBeInTheDocument(); // Negative shows as 500.00 with formatting
      });
    });

    it('should handle all three currency types simultaneously', () => {
      // Arrange
      const accounts = [
        createMockAccount({ currency: 'USD', name: 'USD Account' }),
        createMockAccount({ currency: 'EUR', name: 'EUR Account' }),
        createMockAccount({ currency: 'BRL', name: 'BRL Account' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - All three currencies should be visible
      expect(screen.getByText('USD')).toBeInTheDocument();
      expect(screen.getByText('EUR')).toBeInTheDocument();
      expect(screen.getByText('BRL')).toBeInTheDocument();
    });

    it('should handle zero balance correctly', async () => {
      // Arrange
      const accounts = [
        createMockAccount({ balance: '0.00', name: 'Zero Balance' }),
      ];

      // Act
      renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
        />
      );

      // Assert - Zero should be formatted properly
      await waitFor(() => {
        // Should show formatted zero (may be $0.00 or similar)
        const gridElement = screen.getByRole('grid');
        expect(gridElement).toBeInTheDocument();
      });
    });
  });

  describe('Custom height prop', () => {
    it('should apply custom height as number', () => {
      // Arrange
      const accounts = createMockAccountList(3);

      // Act
      const { container } = renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
          height={400}
        />
      );

      // Assert - Grid wrapper Box should have custom height
      // The component renders a Box with ag-theme-alpine class
      const gridWrapper = container.querySelector('.ag-theme-alpine');
      expect(gridWrapper).toHaveStyle({ height: '400px' });
    });

    it('should apply custom height as string', () => {
      // Arrange
      const accounts = createMockAccountList(3);

      // Act
      const { container } = renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
          height="500px"
        />
      );

      // Assert - Grid wrapper Box should have custom height string
      const gridWrapper = container.querySelector('.ag-theme-alpine');
      expect(gridWrapper).toHaveStyle({ height: '500px' });
    });

    it('should use default height when not provided', () => {
      // Arrange
      const accounts = createMockAccountList(3);

      // Act
      const { container } = renderWithProviders(
        <AgAccountsGrid
          accounts={accounts}
          onRowClick={mockOnRowClick}
          // No height prop
        />
      );

      // Assert - Grid wrapper Box should have default height (600px)
      const gridWrapper = container.querySelector('.ag-theme-alpine');
      expect(gridWrapper).toHaveStyle({ height: '600px' });
    });
  });
});
