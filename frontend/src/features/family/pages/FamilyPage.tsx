// src/features/family/pages/FamilyPage.tsx
// Family management page with tabbed layout for Categories and Members
// Phase 2: Enhanced with Members tab, invitations, and family settings

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
  Tab,
  Tabs,
} from '@mui/material';
import { Plus, UserPlus } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { CategoryTree } from '@/components/domain/CategoryTree';
import { AddCategoryModal } from '../components/AddCategoryModal';
import { EditCategoryModal } from '../components/EditCategoryModal';
import { DeleteCategoryConfirm } from '../components/DeleteCategoryConfirm';
import { FamilyHeader } from '../components/FamilyHeader';
import { MembersList } from '../components/MembersList';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { FamilySettings } from '../components/FamilySettings';
import { useCategories } from '../hooks/useCategories';
import { useCreateCategory } from '../hooks/useCreateCategory';
import { useUpdateCategory } from '../hooks/useUpdateCategory';
import { useDeleteCategory } from '../hooks/useDeleteCategory';
import { useListMembers } from '../hooks/useListMembers';
import { useInviteMember } from '../hooks/useInviteMember';
import { useRemoveMember } from '../hooks/useRemoveMember';
import { useLeaveFamily } from '../hooks/useLeaveFamily';
import { useDeleteFamily } from '../hooks/useDeleteFamily';
import { useFamilyById } from '../hooks/useFamilyById';
import { ROUTES } from '@/lib/constants';
import type { CategoryRead, CategoryCreate, CategoryUpdate, CategoryKind } from '@/types/category';
import type { MembershipRole } from '@/types/family';

/**
 * Tab panel component to conditionally show/hide tab content
 * Only renders children when the tab is active, which prevents
 * unnecessary data fetching for inactive tabs
 */
interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ paddingTop: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * FamilyPage - Main page for family management with Categories and Members tabs
 *
 * Tab 1 (Categories): Displays category tree with CRUD operations through modals
 * Tab 2 (Members): Shows member list, invite functionality, and family settings
 *
 * Phase 1: Categories management
 * Phase 2: Members management and family settings (current implementation)
 */
export function FamilyPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Tab state - 0 = Categories, 1 = Members
  const [activeTab, setActiveTab] = useState(0);

  // Fetch family data for the header
  const { data: familyData } = useFamilyById(familyId);

  // === Categories hooks ===
  const { data: categories = [], isLoading: isLoadingCategories, error: fetchCategoriesError } = useCategories(familyId!);
  const { mutate: createCategory, isPending: isCreating, error: createCategoryError } = useCreateCategory(familyId!);
  const { mutate: updateCategory, isPending: isUpdating, error: updateCategoryError } = useUpdateCategory(familyId!);
  const { mutate: deleteCategory, isPending: isDeleting, error: deleteCategoryError } = useDeleteCategory(familyId!);

  // === Members hooks ===
  const { data: members = [], isLoading: isLoadingMembers } = useListMembers(familyId!);
  const { mutate: inviteMember, isPending: isInviting, error: inviteError, isSuccess: isInviteSuccess, reset: resetInvite } = useInviteMember(familyId!);
  const { mutate: removeMember, isPending: isRemoving } = useRemoveMember(familyId!);
  const { mutate: leaveFamily, isPending: isLeaving, error: leaveError } = useLeaveFamily(familyId!);
  const { mutate: deleteFamilyMutation, isPending: isDeletingFamily, error: deleteFamilyError } = useDeleteFamily();

  // === Category modal state ===
  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
  const [editCategoryModalOpen, setEditCategoryModalOpen] = useState(false);
  const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryRead | null>(null);
  const [parentCategoryForAdd, setParentCategoryForAdd] = useState<CategoryRead | null>(null);
  const [kindForAdd, setKindForAdd] = useState<CategoryKind | undefined>(undefined);

  // === Members modal state ===
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Determine the current user's membership for permission checks
  // Match by user_id since the JWT sub claim contains the user ID
  const currentUserMembership = members.find(
    (member) => member.user_id === user?.id
  ) || null;

  const isCurrentUserOwner = currentUserMembership?.role === 'owner';

  // Count active members for the header badge
  const activeMemberCount = members.filter(
    (member) => member.status === 'active'
  ).length;
  const activeOwnerCount = members.filter(
    (member) => member.status === 'active' && member.role === 'owner'
  ).length;

  // === Category handlers ===
  const handleOpenAddCategoryModal = (parent?: CategoryRead, kind?: CategoryKind) => {
    setParentCategoryForAdd(parent || null);
    setKindForAdd(kind);
    setAddCategoryModalOpen(true);
  };

  const handleCreateCategory = (data: CategoryCreate) => {
    createCategory(data, {
      onSuccess: () => {
        setAddCategoryModalOpen(false);
        setParentCategoryForAdd(null);
        setKindForAdd(undefined);
      },
    });
  };

  const handleOpenEditCategoryModal = (category: CategoryRead) => {
    setSelectedCategory(category);
    setEditCategoryModalOpen(true);
  };

  const handleUpdateCategory = (data: CategoryUpdate) => {
    if (!selectedCategory) return;
    updateCategory(
      { categoryId: selectedCategory.id, data },
      {
        onSuccess: () => {
          setEditCategoryModalOpen(false);
          setSelectedCategory(null);
        },
      }
    );
  };

  const handleOpenDeleteCategoryModal = (category: CategoryRead) => {
    setSelectedCategory(category);
    setDeleteCategoryModalOpen(true);
  };

  const handleDeleteCategory = (reassignToCategoryId?: string | null) => {
    if (!selectedCategory) return;
    deleteCategory(
      { categoryId: selectedCategory.id, reassignTo: reassignToCategoryId },
      {
        onSuccess: () => {
          setDeleteCategoryModalOpen(false);
          setSelectedCategory(null);
        },
      }
    );
  };

  const getTransactionCount = (_category: CategoryRead): number => {
    // Placeholder - will be implemented when transaction endpoints support category filtering
    return 0;
  };

  // === Members handlers ===
  const handleInviteMember = (email: string, role: MembershipRole) => {
    inviteMember({ user_email: email, role }, {
      onSuccess: () => {
        // Keep the modal open to show success message
        // User can close it manually or invite another member
      },
    });
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
  if (isLoadingCategories && isLoadingMembers) {
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
        {/* Family Header with name and member count */}
        {familyData && (
          <FamilyHeader family={familyData} memberCount={activeMemberCount} />
        )}

        {/* Error alerts */}
        {fetchCategoriesError && (
          <Alert severity="error">
            Failed to load categories: {fetchCategoriesError.message}
          </Alert>
        )}

        {/* Tabbed navigation */}
        <Paper sx={{ padding: 0 }}>
          <Tabs
            value={activeTab}
            onChange={(_event, newValue) => setActiveTab(newValue)}
            aria-label="Family management tabs"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Categories" id="family-tab-categories" aria-controls="family-tabpanel-categories" />
            <Tab label="Members" id="family-tab-members" aria-controls="family-tabpanel-members" />
          </Tabs>

          {/* === Categories Tab === */}
          <TabPanel value={activeTab} index={0}>
            <Box sx={{ padding: 3, paddingTop: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Categories
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Organize your transactions with custom categories. Create parent categories and
                    subcategories to build a hierarchy that works for your family.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<Plus size={20} />}
                  onClick={() => handleOpenAddCategoryModal()}
                >
                  Add Category
                </Button>
              </Box>

              <CategoryTree
                categories={categories}
                onAddChild={(parent) => handleOpenAddCategoryModal(parent, parent.kind)}
                onEdit={handleOpenEditCategoryModal}
                onDelete={handleOpenDeleteCategoryModal}
                onAddRoot={(kind) => handleOpenAddCategoryModal(undefined, kind)}
              />
            </Box>
          </TabPanel>

          {/* === Members Tab === */}
          <TabPanel value={activeTab} index={1}>
            <Box sx={{ padding: 3, paddingTop: 0 }}>
              <Stack spacing={3}>
                {/* Members header with invite button */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Members
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage who has access to this family's financial data.
                    </Typography>
                  </Box>
                  {/* Only owners can invite new members */}
                  {isCurrentUserOwner && (
                    <Button
                      variant="contained"
                      startIcon={<UserPlus size={20} />}
                      onClick={() => {
                        resetInvite(); // Clear any previous invite success/error state
                        setInviteModalOpen(true);
                      }}
                    >
                      Invite Member
                    </Button>
                  )}
                </Box>

                {/* Members loading state */}
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

                {/* Family Settings section */}
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
            </Box>
          </TabPanel>
        </Paper>
      </Stack>

      {/* === Category Modals === */}
      <AddCategoryModal
        open={addCategoryModalOpen}
        onClose={() => {
          setAddCategoryModalOpen(false);
          setParentCategoryForAdd(null);
          setKindForAdd(undefined);
        }}
        onCreate={handleCreateCategory}
        parentId={parentCategoryForAdd?.id}
        kind={kindForAdd}
        categories={categories}
        isLoading={isCreating}
        error={createCategoryError?.message}
      />

      {selectedCategory && (
        <EditCategoryModal
          open={editCategoryModalOpen}
          onClose={() => {
            setEditCategoryModalOpen(false);
            setSelectedCategory(null);
          }}
          onUpdate={handleUpdateCategory}
          category={selectedCategory}
          categories={categories}
          isLoading={isUpdating}
          error={updateCategoryError?.message}
        />
      )}

      {selectedCategory && (
        <DeleteCategoryConfirm
          open={deleteCategoryModalOpen}
          onClose={() => {
            setDeleteCategoryModalOpen(false);
            setSelectedCategory(null);
          }}
          onConfirm={handleDeleteCategory}
          category={selectedCategory}
          transactionCount={getTransactionCount(selectedCategory)}
          categories={categories}
          isLoading={isDeleting}
          error={deleteCategoryError?.message}
        />
      )}

      {/* === Invite Member Modal === */}
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

export default FamilyPage;
