// src/features/settings/pages/SettingsPage.tsx
// Settings page with tabbed interface for category management, family members, and preferences
// Categories tab: hierarchical category CRUD
// Family tab: members list, invite, leave/delete family settings

import { useState, useEffect } from 'react';
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
import { Plus, UserPlus } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { CategoryTree } from '@/components/domain/CategoryTree';
import { AddCategoryModal } from '@/features/category/components/AddCategoryModal';
import { EditCategoryModal } from '@/features/category/components/EditCategoryModal';
import { DeleteCategoryConfirm } from '@/features/category/components/DeleteCategoryConfirm';
import { MembersList } from '@/features/family/components/MembersList';
import { InviteMemberModal } from '@/features/family/components/InviteMemberModal';
import { FamilySettings } from '@/features/family/components/FamilySettings';
import { useCategories } from '@/features/category/hooks/useCategories';
import { useCreateCategory } from '@/features/category/hooks/useCreateCategory';
import { useUpdateCategory } from '@/features/category/hooks/useUpdateCategory';
import { useDeleteCategory } from '@/features/category/hooks/useDeleteCategory';
import { useCategoryTransactionCount } from '@/features/category/hooks/useCategoryTransactionCount';
import { useListMembers } from '@/features/family/hooks/useListMembers';
import { useInviteMember } from '@/features/family/hooks/useInviteMember';
import { useRemoveMember } from '@/features/family/hooks/useRemoveMember';
import { useLeaveFamily } from '@/features/family/hooks/useLeaveFamily';
import { useDeleteFamily } from '@/features/family/hooks/useDeleteFamily';
import { useFamilyById } from '@/features/family/hooks/useFamilyById';
import { ROUTES } from '@/lib/constants';
import type { CategoryRead, CategoryCreate, CategoryUpdate, CategoryKind } from '@/types/category';
import type { MembershipRole } from '@/types/family';

/**
 * SettingsPage - Main settings page with tabbed interface
 *
 * Tabs:
 * - Categories: Category management with hierarchical tree view and CRUD operations
 * - Family: Members list, invitations, and family settings (leave/delete)
 * - Profile: (Future) User profile settings
 * - Notifications: (Future) Notification preferences
 */
export function SettingsPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Tab state management - start with categories tab
  const [activeTab, setActiveTab] = useState<string>('categories');

  // Fetch family data for the Family tab header and settings
  const { data: familyData } = useFamilyById(familyId);

  // Fetch categories for this family
  const { data: categories = [], isLoading, error: fetchError } = useCategories(familyId!);

  // Category mutations
  const { mutate: createCategory, isPending: isCreating, error: createError } = useCreateCategory(familyId!);
  const { mutate: updateCategory, isPending: isUpdating, error: updateError } = useUpdateCategory(familyId!);
  const { mutate: deleteCategory, isPending: isDeleting, error: deleteError } = useDeleteCategory(familyId!);

  // === Members hooks ===
  const { data: members = [], isLoading: isLoadingMembers } = useListMembers(familyId!);
  const { mutate: inviteMember, isPending: isInviting, error: inviteError, isSuccess: isInviteSuccess, reset: resetInvite } = useInviteMember(familyId!);
  const { mutate: removeMember, isPending: isRemoving } = useRemoveMember(familyId!);

  // Auto-close invite modal after success so the user sees the confirmation briefly
  useEffect(() => {
    if (isInviteSuccess) {
      const timer = setTimeout(() => {
        setInviteModalOpen(false);
        resetInvite();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isInviteSuccess, resetInvite]);
  const { mutate: leaveFamily, isPending: isLeaving, error: leaveError } = useLeaveFamily(familyId!);
  const { mutate: deleteFamilyMutation, isPending: isDeletingFamily, error: deleteFamilyError } = useDeleteFamily();

  // Modal state management
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Selected category for edit/delete operations
  const [selectedCategory, setSelectedCategory] = useState<CategoryRead | null>(null);

  // Fetch transaction count for selected category (when delete modal is open)
  // Only fetches when a category is selected for deletion
  const { data: transactionCount = 0, isLoading: isLoadingTransactionCount } = useCategoryTransactionCount(
    selectedCategory?.id || null
  );

  // Parent category for adding child (when clicking "Add child" button)
  const [parentCategoryForAdd, setParentCategoryForAdd] = useState<CategoryRead | null>(null);

  // Pre-selected kind for add modal (when clicking section header add button)
  const [kindForAdd, setKindForAdd] = useState<CategoryKind | undefined>(undefined);

  // Determine the current user's membership for permission checks
  // Match by user_id since the JWT sub claim contains the user ID
  const currentUserMembership = members.find(
    (member) => member.user_id === user?.id
  ) || null;

  const isCurrentUserOwner = currentUserMembership?.role === 'owner';
  const activeOwnerCount = members.filter(
    (member) => member.status === 'active' && member.role === 'owner'
  ).length;

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

  // Transaction count is fetched via useCategoryTransactionCount hook above

  // === Members handlers ===
  const handleInviteMember = (email: string, role: MembershipRole) => {
    inviteMember({ user_email: email, role });
  };

  const handleRemoveMember = (membershipId: string) => {
    removeMember({ membershipId });
  };

  const handleLeaveFamily = () => {
    if (!currentUserMembership) return;
    leaveFamily(currentUserMembership.id, {
      onSuccess: () => {
        navigate(ROUTES.FAMILIES);
      },
    });
  };

  const handleDeleteFamily = () => {
    if (!familyId) return;
    deleteFamilyMutation(familyId, {
      onSuccess: () => {
        navigate(ROUTES.FAMILIES);
      },
    });
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
          {/* Show context-appropriate action button based on active tab */}
          {activeTab === 'categories' && (
            <Button
              variant="contained"
              startIcon={<Plus size={20} />}
              onClick={() => handleOpenAddModal()}
            >
              Add Category
            </Button>
          )}
          {activeTab === 'family' && isCurrentUserOwner && (
            <Button
              variant="contained"
              startIcon={<UserPlus size={20} />}
              onClick={() => {
                resetInvite();
                setInviteModalOpen(true);
              }}
            >
              Invite Member
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
            <Tab label="Categories" value="categories" />
            <Tab label="Family" value="family" />
            {/* Future tabs: Profile, Notifications, Preferences */}
          </Tabs>
        </Box>

        {/* Categories Tab Panel */}
        {activeTab === 'categories' && (
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

        {/* Family Tab Panel - Members list, invitations, and family settings */}
        {activeTab === 'family' && (
          <Paper sx={{ padding: 3 }}>
            <Stack spacing={3}>
              {/* Members section header */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Members
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage who has access to this family's financial data.
                </Typography>
              </Box>

              {/* Members list with loading state */}
              {isLoadingMembers ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', paddingY: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <MembersList
                  members={members}
                  currentUserMembership={currentUserMembership}
                  onRemoveMember={handleRemoveMember}
                  isRemoveLoading={isRemoving}
                />
              )}

              {/* Family settings: leave or delete family */}
              {familyData && (
                <FamilySettings
                  family={familyData}
                  currentUserMembership={currentUserMembership}
                  onLeaveFamily={handleLeaveFamily}
                  onDeleteFamily={handleDeleteFamily}
                  isLoading={isLeaving || isDeletingFamily}
                  error={leaveError?.message || deleteFamilyError?.message}
                  activeOwnerCount={activeOwnerCount}
                />
              )}
            </Stack>
          </Paper>
        )}
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
          transactionCount={transactionCount}
          categories={categories}
          isLoading={isDeleting || isLoadingTransactionCount}
          error={deleteError?.message}
        />
      )}
      {/* Invite Member Modal */}
      <InviteMemberModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInvite={handleInviteMember}
        isLoading={isInviting}
        error={inviteError?.message}
        successMessage={isInviteSuccess ? 'Invitation sent successfully!' : undefined}
      />
    </Container>
  );
}

export default SettingsPage;
