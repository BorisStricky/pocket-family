// src/components/ui/organisms/TopNav.tsx
// Top navigation bar with app branding, family switcher, and user menu

import React, { useState, useContext } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Chip,
} from '@mui/material';
import { AccountCircle, ArrowBack, Menu as MenuIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { FamilyContext } from '@/features/family/context/FamilyContext';
import FamilySwitcherMini from '@/components/ui/molecules/FamilySwitcherMini';
import type { User } from '@/types';

interface TopNavProps {
  user?: User;
  /**
   * If true, shows "Global" badge and back button instead of family switcher
   * Used for global account views at /app/accounts/*
   */
  globalMode?: boolean;
  /** Callback to toggle the side navigation drawer open/closed */
  onMenuClick?: () => void;
}

/**
 * TopNav Component
 *
 * Displays at the top of the AppShell
 * Contains:
 * - App logo/name
 * - Family switcher dropdown (family mode) OR "Global" badge + back button (global mode)
 * - User menu with avatar and logout option
 *
 * Props:
 * - user: Current authenticated user
 * - globalMode: If true, shows global badge instead of family switcher
 */
export default function TopNav({ user, globalMode = false, onMenuClick }: TopNavProps) {
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Safely access family context - will be undefined in global mode
  // Use optional context access to avoid errors when FamilyProvider is not available
  const familyContext = useContext(FamilyContext);
  const currentFamily = familyContext?.currentFamily;
  const families = familyContext?.families;
  const switchFamily = familyContext?.switchFamily;
  const isLoading = familyContext?.isLoading ?? false;

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
        // Shift down by the demo banner height (set dynamically via CSS var by DemoBanner.tsx).
        // Defaults to 0 in non-demo builds where the var is never written.
        top: 'var(--demo-banner-height, 0px)',
        bgcolor: 'white',
        color: 'text.primary',
        boxShadow: 1,
      }}
      role="banner"
    >
      <Toolbar sx={{ flexWrap: 'nowrap' }}>
        {/* Hamburger menu button to toggle SideNav */}
        {onMenuClick && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="toggle navigation menu"
            onClick={onMenuClick}
            sx={{ mr: 1 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Back button (global mode only) */}
        {globalMode && (
          <IconButton
            color="inherit"
            aria-label="back to family picker"
            onClick={() => navigate('/app/families')}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
        )}

        {/* App Logo/Name — hidden on mobile to save horizontal space */}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 'bold',
            color: 'primary.main',
            display: { xs: 'none', md: 'block' },
          }}
        >
          Pocket Family
        </Typography>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Family Switcher (family mode) OR Global badge (global mode) */}
        <Box sx={{ mr: 2, minWidth: 0 }}>
          {globalMode ? (
            <Chip
              label="Global"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 'medium' }}
            />
          ) : (
            <FamilySwitcherMini
              currentFamily={currentFamily}
              families={families}
              onSwitch={switchFamily}
              isLoading={isLoading}
            />
          )}
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
          <MenuItem
            onClick={() => {
              handleMenuClose();
              navigate('/app/accounts');
            }}
          >
            See All Accounts
          </MenuItem>
          <MenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
            {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
