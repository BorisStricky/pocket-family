// src/features/family/pages/FamiliesPage.tsx
// Full-page family selector with card grid

import React from 'react';
import { Box, Typography, CircularProgress, Container } from '@mui/material';
import { useFamilies } from '../hooks/useFamilies';
import FamilyList from '../components/FamilyList';

/**
 * FamiliesPage Component
 *
 * Full-page family selector
 * Displays all families user belongs to in a card grid
 * Used when user has no tenant_id in token or wants to switch families
 *
 * Route: /app/families
 */
export default function FamiliesPage() {
  const { data: families = [], isLoading } = useFamilies();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
          Your Families
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Select a family to access its financial data
        </Typography>
      </Box>

      <FamilyList families={families} />
    </Container>
  );
}
