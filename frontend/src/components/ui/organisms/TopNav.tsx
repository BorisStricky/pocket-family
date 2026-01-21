// src/components/ui/organisms/TopNav.tsx
// Top navigation bar with app branding, family switcher, and user menu

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
} from '@mui/material';
import { AccountCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useFamily } from '@/features/family/hooks/useFamily';
import FamilySwitcherMini from '@/components/ui/molecules/FamilySwitcherMini';
import type { User } from '@/types';

interface TopNavProps {
  user?: User;
}

/**
 * TopNav Component
 *
 * Displays at the top of the AppShell
 * Contains:
 * - App logo/name
 * - Family switcher dropdown (placeholder for now, will be FamilySwitcherMini in Step 5)
 * - User menu with avatar and logout option
 *
 * Props:
 * - user: Current authenticated user
 */
export default function TopNav({ user }: TopNavProps) {
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const { currentFamily, families, switchFamily, isLoading } = useFamily();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate('/login');
      },
    });
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: 'white',
        color: 'text.primary',
        boxShadow: 1,
      }}
      role="banner"
    >
      <Toolbar>
        {/* App Logo/Name */}
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
          Personal Finance
        </Typography>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Family Switcher Dropdown */}
        <Box sx={{ mr: 2 }}>
          <FamilySwitcherMini
            currentFamily={currentFamily}
            families={families}
            onSwitch={switchFamily}
            isLoading={isLoading}
          />
        </Box>

        {/* User Menu */}
        <IconButton
          size="large"
          edge="end"
          aria-label="account of current user"
          aria-controls="user-menu"
          aria-haspopup="true"
          onClick={handleMenuOpen}
          color="inherit"
        >
          <AccountCircle />
        </IconButton>
        <Menu
          id="user-menu"
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {user?.email || 'User'}
            </Typography>
          </MenuItem>
          <MenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
            {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
