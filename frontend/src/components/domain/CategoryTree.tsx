// src/components/domain/CategoryTree.tsx
// Hierarchical tree view component for displaying and managing categories
// Supports collapsible nodes and inline actions (add child, edit, delete)

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  IconButton,
  Typography,
  Chip,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  FolderPlus,
} from 'lucide-react';
import type { CategoryRead, CategoryKind } from '@/types/category';
import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/Icon';

/**
 * CategoryTreeNode - Represents a category with its children in tree structure
 */
export interface CategoryTreeNode extends CategoryRead {
  children: CategoryTreeNode[];
}

/**
 * Props for CategoryTree component
 */
export interface CategoryTreeProps {
  /** Array of categories to display - will be organized into tree structure */
  categories: CategoryRead[];
  /** Callback when add child category is clicked */
  onAddChild?: (parentCategory: CategoryRead) => void;
  /** Callback when edit category is clicked */
  onEdit?: (category: CategoryRead) => void;
  /** Callback when delete category is clicked */
  onDelete?: (category: CategoryRead) => void;
  /** Callback when add root category is clicked */
  onAddRoot?: (kind: CategoryKind) => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Build hierarchical tree structure from flat array of categories
 * Organizes categories by parent-child relationships using parent_id field
 *
 * @param categories - Flat array of category objects
 * @returns Array of root-level categories with nested children
 */
function buildCategoryTree(categories: CategoryRead[]): CategoryTreeNode[] {
  // Create a map for quick lookup by category ID
  const categoryMap = new Map<string, CategoryTreeNode>();
  const rootCategories: CategoryTreeNode[] = [];

  // Initialize all categories as tree nodes with empty children arrays
  categories.forEach((category) => {
    categoryMap.set(category.id, { ...category, children: [] });
  });

  // Build parent-child relationships by iterating through all categories
  categories.forEach((category) => {
    const node = categoryMap.get(category.id)!;

    if (category.parent_id === null) {
      // Category has no parent - add to root level
      rootCategories.push(node);
    } else {
      // Category has parent - add to parent's children array
      const parent = categoryMap.get(category.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found in current category list - treat as orphan and add to root
        rootCategories.push(node);
      }
    }
  });

  return rootCategories;
}

/**
 * CategoryTreeItem - Renders a single category node with expand/collapse and actions
 * Recursively renders child categories when expanded
 */
interface CategoryTreeItemProps {
  category: CategoryTreeNode;
  level: number;
  onAddChild?: (category: CategoryRead) => void;
  onEdit?: (category: CategoryRead) => void;
  onDelete?: (category: CategoryRead) => void;
}

function CategoryTreeItem({
  category,
  level,
  onAddChild,
  onEdit,
  onDelete,
}: CategoryTreeItemProps) {
  const { t } = useTranslation();

  // Track expanded/collapsed state for this node
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = category.children.length > 0;

  // Calculate left padding based on tree depth level
  const paddingLeft = level * 24;

  return (
    <Box>
      {/* Category Row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: `${paddingLeft}px`,
          paddingY: 1,
          paddingRight: 2,
          '&:hover': {
            backgroundColor: 'action.hover',
            '& .action-buttons': {
              opacity: 1,
            },
          },
        }}
      >
        {/* Expand/Collapse Icon */}
        <Box sx={{ width: 24, height: 24, marginRight: 1 }}>
          {hasChildren && (
            <IconButton
              size="small"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </IconButton>
          )}
        </Box>

        {/* Category Name and Kind Badge */}
        <Stack direction="row" spacing={1} sx={{ flex: 1, alignItems: 'center' }}>
          {/* Show color circle with optional icon when at least one is set */}
          {(category.icon || category.color) && (
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: category.color ?? 'transparent',
                border: category.color ? 'none' : '1px dashed',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {category.icon && (
                <Icon
                  name={category.icon as IconName}
                  size={11}
                  style={{ color: category.color ? '#fff' : 'inherit' }}
                />
              )}
            </Box>
          )}
          <Typography variant="body1">{category.name}</Typography>
          <Chip
            label={t(`enums.transactionType.${category.kind}`)}
            size="small"
            color={category.kind === 'expense' ? 'error' : 'success'}
            sx={{ height: 20, fontSize: '0.75rem' }}
          />
        </Stack>

        {/* Action Buttons - Hidden by default, shown on hover */}
        <Stack
          direction="row"
          spacing={0.5}
          className="action-buttons"
          sx={{ opacity: 0, transition: 'opacity 0.2s' }}
        >
          {onAddChild && (
            <Tooltip title="Add subcategory">
              <IconButton
                size="small"
                onClick={() => onAddChild(category)}
                aria-label="Add subcategory"
              >
                <FolderPlus size={16} />
              </IconButton>
            </Tooltip>
          )}
          {onEdit && (
            <Tooltip title="Edit category">
              <IconButton
                size="small"
                onClick={() => onEdit(category)}
                aria-label="Edit category"
              >
                <Edit size={16} />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Delete category">
              <IconButton
                size="small"
                onClick={() => onDelete(category)}
                aria-label="Delete category"
                color="error"
              >
                <Trash2 size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>

      {/* Child Categories - Rendered recursively when expanded */}
      {hasChildren && isExpanded && (
        <Box>
          {category.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              level={level + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * CategoryTree - Main component for displaying hierarchical category structure
 * Organizes flat category list into collapsible tree with inline action buttons
 *
 * @example
 * <CategoryTree
 *   categories={categories}
 *   onAddChild={(parent) => handleAddChild(parent)}
 *   onEdit={(category) => handleEdit(category)}
 *   onDelete={(category) => handleDelete(category)}
 *   onAddRoot={(kind) => handleAddRoot(kind)}
 * />
 */
export function CategoryTree({
  categories,
  onAddChild,
  onEdit,
  onDelete,
  onAddRoot,
  className,
}: CategoryTreeProps) {
  const { t } = useTranslation();

  // Build tree structure from flat category array
  const treeData = buildCategoryTree(categories);

  // Separate expense and income categories for organized display
  const expenseCategories = treeData.filter((cat) => cat.kind === 'expense');
  const incomeCategories = treeData.filter((cat) => cat.kind === 'income');

  // Empty state when no categories exist
  if (categories.length === 0) {
    return (
      <Box
        className={className}
        sx={{
          padding: 4,
          textAlign: 'center',
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {t('categories.noCategoriesYet')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('categories.addFirstCategoryPrompt')}
        </Typography>
        {onAddRoot && (
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ marginTop: 2 }}>
            <IconButton
              onClick={() => onAddRoot('expense')}
              color="primary"
              aria-label="Add expense category"
            >
              <Plus size={20} />
              <Typography variant="body2" sx={{ marginLeft: 1 }}>
                {t('categories.addExpense')}
              </Typography>
            </IconButton>
            <IconButton
              onClick={() => onAddRoot('income')}
              color="primary"
              aria-label="Add income category"
            >
              <Plus size={20} />
              <Typography variant="body2" sx={{ marginLeft: 1 }}>
                {t('categories.addIncome')}
              </Typography>
            </IconButton>
          </Stack>
        )}
      </Box>
    );
  }

  return (
    <Box className={className}>
      {/* Expense Categories Section */}
      <Box sx={{ marginBottom: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 1,
            borderBottom: '2px solid',
            borderColor: 'text.primary',
            marginBottom: 1,
          }}
        >
          <Typography variant="h6">
            {t('categories.expenses')}
          </Typography>
          {onAddRoot && (
            <Tooltip title="Add expense category">
              <IconButton
                size="small"
                onClick={() => onAddRoot('expense')}
                aria-label="Add expense category"
              >
                <Plus size={18} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {expenseCategories.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ paddingY: 2 }}>
            {t('categories.noExpenseCategories')}
          </Typography>
        ) : (
          expenseCategories.map((category) => (
            <CategoryTreeItem
              key={category.id}
              category={category}
              level={0}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </Box>

      {/* Income Categories Section */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 1,
            borderBottom: '2px solid',
            borderColor: 'text.primary',
            marginBottom: 1,
          }}
        >
          <Typography variant="h6">
            {t('categories.income')}
          </Typography>
          {onAddRoot && (
            <Tooltip title="Add income category">
              <IconButton
                size="small"
                onClick={() => onAddRoot('income')}
                aria-label="Add income category"
              >
                <Plus size={18} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {incomeCategories.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ paddingY: 2 }}>
            {t('categories.noIncomeCategories')}
          </Typography>
        ) : (
          incomeCategories.map((category) => (
            <CategoryTreeItem
              key={category.id}
              category={category}
              level={0}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </Box>
    </Box>
  );
}

export default CategoryTree;
