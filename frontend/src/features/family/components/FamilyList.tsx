// src/features/family/components/FamilyList.tsx
// Card grid component for displaying and selecting families

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
} from '@mui/material';
import { Group } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { TenantRead } from '@/types/family';
import { formatDisplayDate } from '@/lib/dateUtils';
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
  const { t } = useTranslation();
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
          {t('family.noFamiliesFound')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('family.noFamiliesYet')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      {families.map((family) => (
        <Box
          key={family.id}
          sx={{
            // All cards get exactly the same width regardless of screen size
            // On very small screens, maxWidth ensures the card shrinks to fit
            width: 340,
            maxWidth: '100%',
          }}
        >
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
                  {t('family.created')} {formatDisplayDate(family.created_at)}
                </Typography>

                <Box sx={{ mt: 2 }}>
                  <Chip
                    label={t('family.activeStatus')}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        </Box>
      ))}
    </Box>
  );
}
