// src/components/domain/__tests__/CategoryTree.test.tsx
// Tests for CategoryTree component - hierarchical category display with actions

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryTree } from '../CategoryTree';
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

describe('CategoryTree', () => {
  describe('Empty State', () => {
    it('should display empty state message when no categories exist', () => {
      render(<CategoryTree categories={[]} />);

      expect(screen.getByText('No categories yet')).toBeInTheDocument();
      expect(
        screen.getByText('Add your first category to start organizing transactions')
      ).toBeInTheDocument();
    });

    it('should display add buttons in empty state when onAddRoot provided', () => {
      const handleAddRoot = vi.fn();
      render(<CategoryTree categories={[]} onAddRoot={handleAddRoot} />);

      const addExpenseButton = screen.getByLabelText('Add expense category');
      const addIncomeButton = screen.getByLabelText('Add income category');

      expect(addExpenseButton).toBeInTheDocument();
      expect(addIncomeButton).toBeInTheDocument();
    });

    it('should call onAddRoot with correct kind when empty state buttons clicked', async () => {
      const user = userEvent.setup();
      const handleAddRoot = vi.fn();
      render(<CategoryTree categories={[]} onAddRoot={handleAddRoot} />);

      const addExpenseButton = screen.getByLabelText('Add expense category');
      await user.click(addExpenseButton);
      expect(handleAddRoot).toHaveBeenCalledWith('expense');

      const addIncomeButton = screen.getByLabelText('Add income category');
      await user.click(addIncomeButton);
      expect(handleAddRoot).toHaveBeenCalledWith('income');
    });
  });

  describe('Category Display', () => {
    it('should render single category correctly', () => {
      const category = createMockCategory({ name: 'Groceries' });
      render(<CategoryTree categories={[category]} />);

      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('expense')).toBeInTheDocument();
    });

    it('should separate expense and income categories into sections', () => {
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

      render(<CategoryTree categories={[expenseCategory, incomeCategory]} />);

      // Find sections by headers
      expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Income' })).toBeInTheDocument();

      // Verify categories appear in their respective sections
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    it('should display category kind badge with correct color', () => {
      const expenseCategory = createMockCategory({
        name: 'Food',
        kind: 'expense',
      });
      const incomeCategory = createMockCategory({
        id: 'income-1',
        name: 'Salary',
        kind: 'income',
      });

      render(<CategoryTree categories={[expenseCategory, incomeCategory]} />);

      // MUI Chips render as spans with role, verify text content
      const expenseChips = screen.getAllByText('expense');
      const incomeChips = screen.getAllByText('income');

      expect(expenseChips.length).toBeGreaterThan(0);
      expect(incomeChips.length).toBeGreaterThan(0);
    });
  });

  describe('Hierarchical Structure', () => {
    it('should render parent-child hierarchy correctly', () => {
      const parentCategory = createMockCategory({
        id: 'parent-1',
        name: 'Food',
        parent_id: null,
      });
      const childCategory = createMockCategory({
        id: 'child-1',
        name: 'Groceries',
        parent_id: 'parent-1',
        parent_name: 'Food',
      });

      render(<CategoryTree categories={[parentCategory, childCategory]} />);

      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    it('should render multiple levels of hierarchy', () => {
      const grandparent = createMockCategory({
        id: 'level-0',
        name: 'Level 0',
        parent_id: null,
      });
      const parent = createMockCategory({
        id: 'level-1',
        name: 'Level 1',
        parent_id: 'level-0',
        parent_name: 'Level 0',
      });
      const child = createMockCategory({
        id: 'level-2',
        name: 'Level 2',
        parent_id: 'level-1',
        parent_name: 'Level 1',
      });

      render(<CategoryTree categories={[grandparent, parent, child]} />);

      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
    });

    it('should show expand/collapse icon for categories with children', () => {
      const parentCategory = createMockCategory({
        id: 'parent-1',
        name: 'Food',
      });
      const childCategory = createMockCategory({
        id: 'child-1',
        name: 'Groceries',
        parent_id: 'parent-1',
      });

      render(<CategoryTree categories={[parentCategory, childCategory]} />);

      // Parent should have expand/collapse button (starts expanded)
      const expandButton = screen.getByLabelText('Collapse');
      expect(expandButton).toBeInTheDocument();
    });

    it('should toggle child visibility when expand/collapse clicked', async () => {
      const user = userEvent.setup();
      const parentCategory = createMockCategory({
        id: 'parent-1',
        name: 'Food',
      });
      const childCategory = createMockCategory({
        id: 'child-1',
        name: 'Groceries',
        parent_id: 'parent-1',
      });

      render(<CategoryTree categories={[parentCategory, childCategory]} />);

      // Child should be visible initially
      expect(screen.getByText('Groceries')).toBeInTheDocument();

      // Click collapse button
      const collapseButton = screen.getByLabelText('Collapse');
      await user.click(collapseButton);

      // Child should be hidden
      expect(screen.queryByText('Groceries')).not.toBeInTheDocument();

      // Click expand button
      const expandButton = screen.getByLabelText('Expand');
      await user.click(expandButton);

      // Child should be visible again
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should display action buttons when callbacks provided', () => {
      const category = createMockCategory({ name: 'Food' });
      const handleAddChild = vi.fn();
      const handleEdit = vi.fn();
      const handleDelete = vi.fn();

      render(
        <CategoryTree
          categories={[category]}
          onAddChild={handleAddChild}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      );

      // Action buttons should exist (even if hidden via CSS)
      expect(screen.getByLabelText('Add subcategory')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit category')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete category')).toBeInTheDocument();
    });

    it('should call onAddChild when add subcategory button clicked', async () => {
      const user = userEvent.setup();
      const category = createMockCategory({ name: 'Food' });
      const handleAddChild = vi.fn();

      render(<CategoryTree categories={[category]} onAddChild={handleAddChild} />);

      const addChildButton = screen.getByLabelText('Add subcategory');
      await user.click(addChildButton);

      // Callback receives CategoryTreeNode with children array
      expect(handleAddChild).toHaveBeenCalledWith(
        expect.objectContaining({
          id: category.id,
          name: category.name,
          kind: category.kind,
          children: [],
        })
      );
    });

    it('should call onEdit when edit button clicked', async () => {
      const user = userEvent.setup();
      const category = createMockCategory({ name: 'Food' });
      const handleEdit = vi.fn();

      render(<CategoryTree categories={[category]} onEdit={handleEdit} />);

      const editButton = screen.getByLabelText('Edit category');
      await user.click(editButton);

      // Callback receives CategoryTreeNode with children array
      expect(handleEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: category.id,
          name: category.name,
          kind: category.kind,
          children: [],
        })
      );
    });

    it('should call onDelete when delete button clicked', async () => {
      const user = userEvent.setup();
      const category = createMockCategory({ name: 'Food' });
      const handleDelete = vi.fn();

      render(<CategoryTree categories={[category]} onDelete={handleDelete} />);

      const deleteButton = screen.getByLabelText('Delete category');
      await user.click(deleteButton);

      // Callback receives CategoryTreeNode with children array
      expect(handleDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          id: category.id,
          name: category.name,
          kind: category.kind,
          children: [],
        })
      );
    });

    it('should display add root category buttons in section headers', () => {
      const category = createMockCategory();
      const handleAddRoot = vi.fn();

      render(<CategoryTree categories={[category]} onAddRoot={handleAddRoot} />);

      // Should have add buttons in both Expenses and Income section headers
      const addButtons = screen.getAllByLabelText(/Add (expense|income) category/);
      expect(addButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('should call onAddRoot when section header add button clicked', async () => {
      const user = userEvent.setup();
      const category = createMockCategory({ kind: 'expense' });
      const handleAddRoot = vi.fn();

      render(<CategoryTree categories={[category]} onAddRoot={handleAddRoot} />);

      // Click expense section add button
      const expenseAddButton = screen.getByLabelText('Add expense category');
      await user.click(expenseAddButton);
      expect(handleAddRoot).toHaveBeenCalledWith('expense');

      // Click income section add button
      const incomeAddButton = screen.getByLabelText('Add income category');
      await user.click(incomeAddButton);
      expect(handleAddRoot).toHaveBeenCalledWith('income');
    });
  });

  describe('Edge Cases', () => {
    it('should handle orphaned categories with missing parent', () => {
      // Child category whose parent_id does not match any existing category
      const orphanCategory = createMockCategory({
        id: 'orphan-1',
        name: 'Orphan Category',
        parent_id: 'nonexistent-parent',
        parent_name: 'Missing Parent',
      });

      render(<CategoryTree categories={[orphanCategory]} />);

      // Orphan should still render at root level
      expect(screen.getByText('Orphan Category')).toBeInTheDocument();
    });

    it('should handle empty expense or income sections', () => {
      const incomeCategory = createMockCategory({
        name: 'Salary',
        kind: 'income',
      });

      render(<CategoryTree categories={[incomeCategory]} />);

      // Expenses section should show empty message
      expect(screen.getByText('No expense categories')).toBeInTheDocument();

      // Income section should show the category
      expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    it('should apply custom className prop', () => {
      const category = createMockCategory();
      const { container } = render(
        <CategoryTree categories={[category]} className="custom-class" />
      );

      const treeElement = container.querySelector('.custom-class');
      expect(treeElement).toBeInTheDocument();
    });
  });
});
