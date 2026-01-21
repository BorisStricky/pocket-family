// src/features/family/components/FamilyList.tsx
// Card grid component for displaying and selecting families

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Grid,
  Chip,
} from '@mui/material';
import { Group } from '@mui/icons-material';
import type { TenantRead } from '@/types/family';
import { useSwitchFamily } from '../hooks/useSwitchFamily';

interface FamilyListProps {
  families: TenantRead[];
  onSelect?: (familyId: string) => void;
}

/**
 * FamilyList Component
 *
 * Displays families as a card grid
 * Each card is clickable and switches to that family via tenant switch API
 *
 * Props:
 * - families: List of families to display
 * - onSelect: Optional callback when family is selected (defaults to tenant switch)
 */
export default function FamilyList({ families, onSelect }: FamilyListProps) {
  const { mutate: switchToFamily } = useSwitchFamily();

  const handleFamilyClick = (familyId: string) => {
    if (onSelect) {
      onSelect(familyId);
    } else {
      // Default behavior: switch tenant context via API (which also navigates)
      switchToFamily(familyId);
    }
  };

  if (families.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Families Found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You don't belong to any families yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {families.map((family) => (
        <Grid item xs={12} sm={6} md={4} key={family.id}>
          <Card
            sx={{
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 4,
              },
            }}
          >
            <CardActionArea
              onClick={() => handleFamilyClick(family.id)}
              sx={{ height: '100%' }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Group sx={{ mr: 1, color: 'primary.main', fontSize: 32 }} />
                  <Typography variant="h6" component="div">
                    {family.name}
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Created: {new Date(family.created_at).toLocaleDateString()}
                </Typography>

                <Box sx={{ mt: 2 }}>
                  <Chip
                    label="Active"
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
