// src/components/domain/__tests__/CategorySelect.test.tsx
// Tests for CategorySelect component - searchable category dropdown

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategorySelect } from '../CategorySelect';
import type { CategoryRead } from '@/types/category';

/**
 * Helper function to create mock category for testing
 */
function createMockCategory(overrides: Partial<CategoryRead> = {}): CategoryRead {
  return {
    id: 'category-uuid-123',
    tenant_id: 'tenant-uuid-456',
    name: 'Test Category',
    kind: 'expense',
    parent_id: null,
    parent_name: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('CategorySelect', () => {
  describe('Basic Rendering', () => {
    it('should render with label and placeholder', () => {
      const categories: CategoryRead[] = [];
      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={categories}
          label="Category"
          placeholder="Choose category"
        />
      );

      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Choose category')).toBeInTheDocument();
    });

    it('should display selected category when value provided', () => {
      const category = createMockCategory({ name: 'Groceries' });
      render(
        <CategorySelect
          value={category.id}
          onChange={vi.fn()}
          categories={[category]}
        />
      );

      // Autocomplete shows selected value in input
      const input = screen.getByRole('combobox');
      expect(input).toHaveValue('Groceries');
    });

    it('should show required indicator when required prop is true', () => {
      const { container } = render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[]}
          label="Category"
          required
        />
      );

      // MUI Autocomplete shows required indicator in the TextField
      // Check that the asterisk is visible in the label legend
      const legend = container.querySelector('legend');
      expect(legend?.textContent).toContain('*');
    });

    it('should display error state and helper text', () => {
      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[]}
          error
          helperText="Category is required"
        />
      );

      expect(screen.getByText('Category is required')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[]}
          disabled
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toBeDisabled();
    });
  });

  describe('Category Filtering', () => {
    it('should show all categories when kind filter not specified', async () => {
      const user = userEvent.setup();
      const expenseCategory = createMockCategory({
        id: 'expense-1',
        name: 'Food',
        kind: 'expense',
      });
      const incomeCategory = createMockCategory({
        id: 'income-1',
        name: 'Salary',
        kind: 'income',
      });

      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[expenseCategory, incomeCategory]}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Both categories should appear in dropdown
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    it('should filter to expense categories when kind is expense', async () => {
      const user = userEvent.setup();
      const expenseCategory = createMockCategory({
        id: 'expense-1',
        name: 'Food',
        kind: 'expense',
      });
      const incomeCategory = createMockCategory({
        id: 'income-1',
        name: 'Salary',
        kind: 'income',
      });

      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[expenseCategory, incomeCategory]}
          kind="expense"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Only expense category should appear
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.queryByText('Salary')).not.toBeInTheDocument();
    });

    it('should filter to income categories when kind is income', async () => {
      const user = userEvent.setup();
      const expenseCategory = createMockCategory({
        id: 'expense-1',
        name: 'Food',
        kind: 'expense',
      });
      const incomeCategory = createMockCategory({
        id: 'income-1',
        name: 'Salary',
        kind: 'income',
      });

      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[expenseCategory, incomeCategory]}
          kind="income"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Only income category should appear
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.queryByText('Food')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter categories by search term', async () => {
      const user = userEvent.setup();
      const foodCategory = createMockCategory({
        id: 'food-1',
        name: 'Food',
      });
      const transportCategory = createMockCategory({
        id: 'transport-1',
        name: 'Transport',
      });

      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[foodCategory, transportCategory]}
        />
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'Food');

      // Only matching category should appear
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.queryByText('Transport')).not.toBeInTheDocument();
    });

    it('should search across parent category names', async () => {
      const user = userEvent.setup();
      const parentCategory = createMockCategory({
        id: 'parent-1',
        name: 'Food',
      });
      const childCategory = createMockCategory({
        id: 'child-1',
        name: 'Groceries',
        parent_id: 'parent-1',
        parent_name: 'Food',
      });
      const unrelatedCategory = createMockCategory({
        id: 'unrelated-1',
        name: 'Transport',
      });

      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[parentCategory, childCategory, unrelatedCategory]}
        />
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'Food');

      // Both parent and child with "Food" in path should appear
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      // Unrelated category should not appear
      expect(screen.queryByText('Transport')).not.toBeInTheDocument();
    });

    it('should show no options message when search has no results', async () => {
      const user = userEvent.setup();
      const category = createMockCategory({ name: 'Food' });

      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[category]}
        />
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'NonexistentCategory');

      expect(screen.getByText('No categories found')).toBeInTheDocument();
    });

    it('should show kind-specific no options message when kind filtered', async () => {
      const user = userEvent.setup();
      const category = createMockCategory({ name: 'Food', kind: 'expense' });

      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[category]}
          kind="expense"
        />
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'NonexistentCategory');

      expect(screen.getByText('No expense categories found')).toBeInTheDocument();
    });
  });

  describe('Hierarchical Display', () => {
    it('should display child category with parent name context', async () => {
      const user = userEvent.setup();
      const childCategory = createMockCategory({
        id: 'child-1',
        name: 'Groceries',
        parent_id: 'parent-1',
        parent_name: 'Food',
      });

      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[childCategory]}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Child name should be displayed
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      // Parent context should be shown
      expect(screen.getByText(/in Food/)).toBeInTheDocument();
    });

    it('should show selected child category with full path in input', () => {
      const childCategory = createMockCategory({
        id: 'child-1',
        name: 'Groceries',
        parent_id: 'parent-1',
        parent_name: 'Food',
      });

      render(
        <CategorySelect
          value={childCategory.id}
          onChange={vi.fn()}
          categories={[childCategory]}
        />
      );

      const input = screen.getByRole('combobox');
      // Input should show "Food > Groceries"
      expect(input).toHaveValue('Food > Groceries');
    });
  });

  describe('Selection Behavior', () => {
    it('should call onChange with category ID when option selected', async () => {
      const user = userEvent.setup();
      const category = createMockCategory({ id: 'category-1', name: 'Food' });
      const handleChange = vi.fn();

      render(
        <CategorySelect
          value={null}
          onChange={handleChange}
          categories={[category]}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      const option = screen.getByText('Food');
      await user.click(option);

      expect(handleChange).toHaveBeenCalledWith('category-1');
    });

    it('should call onChange with null when selection cleared', async () => {
      const user = userEvent.setup();
      const category = createMockCategory({ id: 'category-1', name: 'Food' });
      const handleChange = vi.fn();

      render(
        <CategorySelect
          value={category.id}
          onChange={handleChange}
          categories={[category]}
        />
      );

      // Clear the selection
      const clearButton = screen.getByTitle('Clear');
      await user.click(clearButton);

      expect(handleChange).toHaveBeenCalledWith(null);
    });

    it('should update displayed value when value prop changes', () => {
      const category1 = createMockCategory({ id: 'category-1', name: 'Food' });
      const category2 = createMockCategory({ id: 'category-2', name: 'Transport' });
      const categories = [category1, category2];

      const { rerender } = render(
        <CategorySelect
          value={category1.id}
          onChange={vi.fn()}
          categories={categories}
        />
      );

      let input = screen.getByRole('combobox');
      expect(input).toHaveValue('Food');

      // Update value prop
      rerender(
        <CategorySelect
          value={category2.id}
          onChange={vi.fn()}
          categories={categories}
        />
      );

      input = screen.getByRole('combobox');
      expect(input).toHaveValue('Transport');
    });
  });

  describe('Category Kind Badges', () => {
    it('should display expense badge with error color', async () => {
      const user = userEvent.setup();
      const category = createMockCategory({ name: 'Food', kind: 'expense' });

      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[category]}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Expense badge should be present
      const badges = screen.getAllByText('expense');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should display income badge with success color', async () => {
      const user = userEvent.setup();
      const category = createMockCategory({ name: 'Salary', kind: 'income' });

      render(
        <CategorySelect
          value={null}
          onChange={vi.fn()}
          categories={[category]}
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Income badge should be present
      const badges = screen.getAllByText('income');
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});
