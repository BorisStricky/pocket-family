// src/features/family/pages/FamilyPage.tsx
// Family management page with categories management
// Shows category tree with CRUD operations

import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Plus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { CategoryTree } from '@/components/domain/CategoryTree';
import { AddCategoryModal } from '../components/AddCategoryModal';
import { EditCategoryModal } from '../components/EditCategoryModal';
import { DeleteCategoryConfirm } from '../components/DeleteCategoryConfirm';
import { useCategories } from '../hooks/useCategories';
import { useCreateCategory } from '../hooks/useCreateCategory';
import { useUpdateCategory } from '../hooks/useUpdateCategory';
import { useDeleteCategory } from '../hooks/useDeleteCategory';
import type { CategoryRead, CategoryCreate, CategoryUpdate, CategoryKind } from '@/types/category';

/**
 * FamilyPage - Main page for family management with categories
 * Displays category tree and provides CRUD operations through modals
 *
 * Phase 1: Categories management (current implementation)
 * Phase 2: Will add Members tab and family settings
 */
export function FamilyPage() {
  const { familyId } = useParams<{ familyId: string }>();

  // Fetch categories for this family
  const { data: categories = [], isLoading, error: fetchError } = useCategories(familyId!);

  // Category mutations
  const { mutate: createCategory, isPending: isCreating, error: createError } = useCreateCategory(familyId!);
  const { mutate: updateCategory, isPending: isUpdating, error: updateError } = useUpdateCategory(familyId!);
  const { mutate: deleteCategory, isPending: isDeleting, error: deleteError } = useDeleteCategory(familyId!);

  // Modal state management
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Selected category for edit/delete operations
  const [selectedCategory, setSelectedCategory] = useState<CategoryRead | null>(null);

  // Parent category for adding child (when clicking "Add child" button)
  const [parentCategoryForAdd, setParentCategoryForAdd] = useState<CategoryRead | null>(null);

  // Pre-selected kind for add modal (when clicking section header add button)
  const [kindForAdd, setKindForAdd] = useState<CategoryKind | undefined>(undefined);

  /**
   * Handle opening add modal with optional parent and kind pre-selection
   */
  const handleOpenAddModal = (parent?: CategoryRead, kind?: CategoryKind) => {
    setParentCategoryForAdd(parent || null);
    setKindForAdd(kind);
    setAddModalOpen(true);
  };

  /**
   * Handle creating new category
   */
  const handleCreateCategory = (data: CategoryCreate) => {
    createCategory(data, {
      onSuccess: () => {
        setAddModalOpen(false);
        setParentCategoryForAdd(null);
        setKindForAdd(undefined);
      },
    });
  };

  /**
   * Handle opening edit modal for a category
   */
  const handleOpenEditModal = (category: CategoryRead) => {
    setSelectedCategory(category);
    setEditModalOpen(true);
  };

  /**
   * Handle updating category
   */
  const handleUpdateCategory = (data: CategoryUpdate) => {
    if (!selectedCategory) return;

    updateCategory(
      { categoryId: selectedCategory.id, data },
      {
        onSuccess: () => {
          setEditModalOpen(false);
          setSelectedCategory(null);
        },
      }
    );
  };

  /**
   * Handle opening delete confirmation modal
   */
  const handleOpenDeleteModal = (category: CategoryRead) => {
    setSelectedCategory(category);
    setDeleteModalOpen(true);
  };

  /**
   * Handle deleting category with optional transaction reassignment
   */
  const handleDeleteCategory = (reassignToCategoryId?: string | null) => {
    if (!selectedCategory) return;

    deleteCategory(
      { categoryId: selectedCategory.id, reassignTo: reassignToCategoryId },
      {
        onSuccess: () => {
          setDeleteModalOpen(false);
          setSelectedCategory(null);
        },
      }
    );
  };

  /**
   * Calculate transaction count for a category
   * TODO: Implement when transaction API supports filtering by category
   * For now, return 0 (safe delete scenario)
   */
  const getTransactionCount = (_category: CategoryRead): number => {
    // Placeholder - will be implemented when transaction endpoints support category filtering
    return 0;
  };

  // Loading state
  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ paddingY: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ paddingY: 4 }}>
      <Stack spacing={3}>
        {/* Page Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" component="h1">
            Family Settings
          </Typography>
          <Button
            variant="contained"
            startIcon={<Plus size={20} />}
            onClick={() => handleOpenAddModal()}
          >
            Add Category
          </Button>
        </Box>

        {/* Error Alert */}
        {fetchError && (
          <Alert severity="error">
            Failed to load categories: {fetchError.message}
          </Alert>
        )}

        {/* Categories Section */}
        <Paper sx={{ padding: 3 }}>
          <Typography variant="h6" gutterBottom>
            Categories
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Organize your transactions with custom categories. Create parent categories and
            subcategories to build a hierarchy that works for your family.
          </Typography>

          {/* Category Tree */}
          <CategoryTree
            categories={categories}
            onAddChild={(parent) => handleOpenAddModal(parent, parent.kind)}
            onEdit={handleOpenEditModal}
            onDelete={handleOpenDeleteModal}
            onAddRoot={(kind) => handleOpenAddModal(undefined, kind)}
          />
        </Paper>

        {/* Future: Members Section (Phase 2) */}
        {/* Future: Family Settings Section (Phase 2) */}
      </Stack>

      {/* Add Category Modal */}
      <AddCategoryModal
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setParentCategoryForAdd(null);
          setKindForAdd(undefined);
        }}
        onCreate={handleCreateCategory}
        parentId={parentCategoryForAdd?.id}
        kind={kindForAdd}
        categories={categories}
        isLoading={isCreating}
        error={createError?.message}
      />

      {/* Edit Category Modal */}
      {selectedCategory && (
        <EditCategoryModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedCategory(null);
          }}
          onUpdate={handleUpdateCategory}
          category={selectedCategory}
          categories={categories}
          isLoading={isUpdating}
          error={updateError?.message}
        />
      )}

      {/* Delete Category Confirmation */}
      {selectedCategory && (
        <DeleteCategoryConfirm
          open={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedCategory(null);
          }}
          onConfirm={handleDeleteCategory}
          category={selectedCategory}
          transactionCount={getTransactionCount(selectedCategory)}
          categories={categories}
          isLoading={isDeleting}
          error={deleteError?.message}
        />
      )}
    </Container>
  );
}

export default FamilyPage;
