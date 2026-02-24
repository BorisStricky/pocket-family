// src/components/ui/molecules/FamilySwitcherMini.tsx
// Compact family switcher dropdown for TopNav

import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemText,
  Divider,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { KeyboardArrowDown, Group } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import type { TenantRead } from '@/types/family';

interface FamilySwitcherMiniProps {
  currentFamily: TenantRead | null;
  families: TenantRead[];
  onSwitch: (familyId: string) => void;
  isLoading?: boolean;
}

/**
 * FamilySwitcherMini Component
 *
 * Compact dropdown in TopNav showing current family
 * Allows quick switching between families
 * Links to full family management page
 *
 * Flow:
 * 1. Shows current family name in button
 * 2. Click opens dropdown with all families
 * 3. Selecting family calls onSwitch (which calls POST /tenants/{id}/switch)
 * 4. "Manage Families" link goes to /app/families page
 *
 * Props:
 * - currentFamily: Currently active family from context
 * - families: List of all families user belongs to
 * - onSwitch: Callback to switch family (calls useSwitchFamily mutation)
 * - isLoading: Loading state for family data
 */
export default function FamilySwitcherMini({
  currentFamily,
  families,
  onSwitch,
  isLoading = false,
}: FamilySwitcherMiniProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSwitchFamily = (familyId: string) => {
    handleClose();
    // Call the switch mutation which uses POST /tenants/{tenant_id}/switch
    onSwitch(familyId);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Button
        variant="outlined"
        endIcon={<KeyboardArrowDown />}
        startIcon={<Group />}
        onClick={handleClick}
        sx={{
          textTransform: 'none',
          borderColor: 'divider',
          color: 'text.primary',
          // Truncate long family names so the button doesn't overflow the toolbar
          maxWidth: { xs: 200, sm: 280 },
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
        aria-controls={open ? 'family-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        {currentFamily?.name || 'Select Family'}
      </Button>
      <Menu
        id="family-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'family-button',
        }}
        PaperProps={{
          sx: {
            minWidth: 200,
            maxHeight: 400,
          },
        }}
      >
        {/* Current family (disabled) */}
        {currentFamily && (
          <>
            <MenuItem disabled>
              <ListItemText
                primary={currentFamily.name}
                secondary="Current family"
              />
            </MenuItem>
            <Divider />
          </>
        )}

        {/* Other families */}
        {families
          .filter((family) => family.id !== currentFamily?.id)
          .map((family) => (
            <MenuItem
              key={family.id}
              onClick={() => handleSwitchFamily(family.id)}
            >
              <ListItemText primary={family.name} />
            </MenuItem>
          ))}

        {/* No other families available */}
        {families.length === 1 && currentFamily && (
          <MenuItem disabled>
            <ListItemText
              secondary="No other families"
              sx={{ fontStyle: 'italic' }}
            />
          </MenuItem>
        )}

        <Divider />

        {/* Link to manage families page */}
        <MenuItem component={Link} to="/app/families" onClick={handleClose}>
          <ListItemText primary="Manage Families" />
        </MenuItem>
      </Menu>
    </>
  );
}
