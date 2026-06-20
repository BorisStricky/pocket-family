// src/features/family/pages/FamiliesPage.tsx
// Full-page family selector with card grid and create family action
// Users see this page to pick which family to work with or create a new one

import { useState } from 'react';
import { Box, Typography, CircularProgress, Container, Button, Stack } from '@mui/material';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFamilies } from '../hooks/useFamilies';
import { useCreateFamily } from '../hooks/useCreateFamily';
import { useSwitchFamily } from '../hooks/useSwitchFamily';
import FamilyList from '../components/FamilyList';
import { CreateFamilyModal } from '../components/CreateFamilyModal';

/**
 * FamiliesPage Component
 *
 * Full-page family selector with the ability to create new families.
 * Displays all families user belongs to in a card grid.
 * When a new family is created, automatically switches to it.
 *
 * Route: /app/families
 */
export default function FamiliesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: families = [], isLoading } = useFamilies();
  const { mutate: createFamily, isPending: isCreating, error: createError } = useCreateFamily();
  const switchFamilyMutation = useSwitchFamily();

  // Modal state for creating a new family
  const [createModalOpen, setCreateModalOpen] = useState(false);

  /**
   * Handle family creation
   * After creating, switch to the new family and navigate to its welcome page
   */
  const handleCreateFamily = (name: string) => {
    createFamily({ name }, {
      onSuccess: (newFamily) => {
        setCreateModalOpen(false);
        // Switch to the newly created family and navigate to it
        switchFamilyMutation.mutate(newFamily.id);
      },
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Stack spacing={4}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
            {t('family.yourFamilies')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('family.subtitle')}
          </Typography>
        </Box>

        {/* Create Family button */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<Plus size={20} />}
            onClick={() => setCreateModalOpen(true)}
            size="large"
          >
            {t('family.createNewFamily')}
          </Button>
        </Box>

        <FamilyList families={families} />
      </Stack>

      {/* Create Family Modal */}
      <CreateFamilyModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateFamily}
        isLoading={isCreating}
        error={createError?.message}
      />
    </Container>
  );
}
