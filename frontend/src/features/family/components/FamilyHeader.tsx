// src/features/family/components/FamilyHeader.tsx
// Header component for the Family management page
// Shows family name, member count, and provides context for the current family

import { Box, Typography, Chip, Stack } from '@mui/material';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TenantRead } from '@/types/family';

/**
 * Props for FamilyHeader component
 */
interface FamilyHeaderProps {
  /** The family/tenant data to display */
  family: TenantRead;
  /** Number of active members in this family */
  memberCount?: number;
}

/**
 * FamilyHeader - displays the family name and member count at the top of the Family page
 *
 * Provides visual context for which family the user is currently viewing.
 * The member count chip helps owners understand family size at a glance.
 */
export function FamilyHeader({ family, memberCount }: FamilyHeaderProps) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h4" component="h1">
          {family.name}
        </Typography>
        {memberCount !== undefined && (
          <Chip
            icon={<Users size={16} />}
            label={t('family.memberCount', { count: memberCount })}
            variant="outlined"
            size="small"
          />
        )}
      </Stack>
    </Box>
  );
}
