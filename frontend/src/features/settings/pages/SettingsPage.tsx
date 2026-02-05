// src/features/settings/pages/SettingsPage.tsx
// Settings page with tabbed interface for family management and preferences
// Currently includes Family tab with category management (Phase 1)
// Future tabs: Profile, Notifications, Preferences (Phase 2)

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
  Tabs,
  Tab,
} from '@mui/material';
import { Plus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { CategoryTree } from '@/components/domain/CategoryTree';
import { AddCategoryModal } from '@/features/family/components/AddCategoryModal';
import { EditCategoryModal } from '@/features/family/components/EditCategoryModal';
import { DeleteCategoryConfirm } from '@/features/family/components/DeleteCategoryConfirm';
import { useCategories } from '@/features/family/hooks/useCategories';
import { useCreateCategory } from '@/features/family/hooks/useCreateCategory';
import { useUpdateCategory } from '@/features/family/hooks/useUpdateCategory';
import { useDeleteCategory } from '@/features/family/hooks/useDeleteCategory';
import type { CategoryRead, CategoryCreate, CategoryUpdate, CategoryKind } from '@/types/category';

/**
 * SettingsPage - Main settings page with tabbed interface
 *
 * Tabs:
 * - Family: Category management with hierarchical tree view and CRUD operations
 * - Profile: (Future) User profile settings
 * - Notifications: (Future) Notification preferences
 * - Preferences: (Future) App preferences and display options
 *
 * The Family tab contains all category management functionality previously in FamilyPage.
 * This provides a better information architecture with related settings grouped together.
 */
export function SettingsPage() {
  const { familyId } = useParams<{ familyId: string }>();

  // Tab state management - start with family tab
  const [activeTab, setActiveTab] = useState<string>('family');

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
   * Handle tab changes in settings navigation
   */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
  };

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
            Settings
          </Typography>
          {/* Show Add Category button only when on Family tab */}
          {activeTab === 'family' && (
            <Button
              variant="contained"
              startIcon={<Plus size={20} />}
              onClick={() => handleOpenAddModal()}
            >
              Add Category
            </Button>
          )}
        </Box>

        {/* Error Alert */}
        {fetchError && (
          <Alert severity="error">
            Failed to load categories: {fetchError.message}
          </Alert>
        )}

        {/* Tabs Navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="settings tabs">
            <Tab label="Family" value="family" />
            {/* Future tabs will be added here */}
            {/* <Tab label="Profile" value="profile" /> */}
            {/* <Tab label="Notifications" value="notifications" /> */}
            {/* <Tab label="Preferences" value="preferences" /> */}
          </Tabs>
        </Box>

        {/* Family Tab Panel */}
        {activeTab === 'family' && (
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
        )}

        {/* Future tab panels will be added here */}
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

export default SettingsPage;
