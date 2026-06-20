// IconPicker.tsx
// A grid of curated lucide-react icons for selecting a visual identity for categories,
// accounts, and budgets. The user can also clear the selection by choosing "None".

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { Icon } from '@/components/atoms/Icon';
import type { IconName } from '@/components/atoms/Icon';

// Curated set of icons relevant to personal finance and household categories.
// Using lucide-react names that map directly to the Icon atom.
export const PICKER_ICONS: IconName[] = [
  'ShoppingCart',
  'ShoppingBag',
  'Utensils',
  'Coffee',
  'Car',
  'Fuel',
  'Home',
  'Zap',
  'Wifi',
  'Smartphone',
  'Heart',
  'Pill',
  'GraduationCap',
  'Book',
  'Plane',
  'TrendingUp',
  'Briefcase',
  'DollarSign',
  'CreditCard',
  'PiggyBank',
  'Gift',
  'Music',
  'Dumbbell',
  'Baby',
  'PawPrint',
];

interface IconPickerProps {
  value: string | null;
  onChange: (icon: string | null) => void;
  disabled?: boolean;
}

export const IconPicker: React.FC<IconPickerProps> = ({ value, onChange, disabled = false }) => {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {t('categories.iconLabel')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          // 6 columns to keep the grid compact in modal dialogs
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 0.25,
        }}
      >
        {/* "None" option clears the selection */}
        <Tooltip title="No icon">
          <IconButton
            size="small"
            disabled={disabled}
            onClick={() => onChange(null)}
            sx={{
              border: '1px dashed',
              borderColor: value === null ? 'primary.main' : 'divider',
              borderRadius: 1,
              width: 32,
              height: 32,
              color: value === null ? 'primary.main' : 'text.disabled',
              fontSize: '0.6rem',
              // Highlight when "none" is selected
              bgcolor: value === null ? 'primary.50' : 'transparent',
            }}
          >
            —
          </IconButton>
        </Tooltip>

        {PICKER_ICONS.map((iconName) => (
          <Tooltip key={iconName} title={iconName}>
            <IconButton
              size="small"
              disabled={disabled}
              onClick={() => onChange(iconName)}
              sx={{
                border: '1px solid',
                borderColor: value === iconName ? 'primary.main' : 'transparent',
                borderRadius: 1,
                width: 32,
                height: 32,
                color: value === iconName ? 'primary.main' : 'text.secondary',
                bgcolor: value === iconName ? 'primary.50' : 'transparent',
                '&:hover': {
                  borderColor: 'primary.light',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Icon name={iconName} size={14} />
            </IconButton>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
};

export default IconPicker;
