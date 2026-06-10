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
  ListItemIcon,
  ListItemText,
  Avatar,
  Chip,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  AccountCircle,
  ArrowBack,
  Menu as MenuIcon,
  Language as LanguageIcon,
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useLanguage } from '@/features/settings/hooks/useLanguage';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { FamilyContext } from '@/features/family/context/FamilyContext';
import FamilySwitcherMini from '@/components/ui/molecules/FamilySwitcherMini';
import type { User, LanguageCode } from '@/types';

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
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, didUpdateFail, dismissUpdateError } = useLanguage();
  const logoutMutation = useLogout();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // Separate anchor for the nested Language submenu so it can position itself
  // relative to its own "Language" menu item rather than the avatar button.
  const [languageAnchorEl, setLanguageAnchorEl] = useState<null | HTMLElement>(null);

  // Display labels for each supported language code, looked up from the active
  // translation so the names themselves are localized where appropriate.
  const languageLabels: Record<LanguageCode, string> = {
    en: t('language.english'),
    'pt-BR': t('language.portuguese'),
  };

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
    // Closing the user menu must also dismiss the nested language submenu so it
    // never lingers as a detached popup.
    setLanguageAnchorEl(null);
  };

  const handleLanguageMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLanguageAnchorEl(event.currentTarget);
  };

  // Apply the chosen language and close both menus so the user sees the change
  // take effect immediately.
  const handleSelectLanguage = (language: LanguageCode) => {
    changeLanguage(language);
    handleMenuClose();
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
    <>
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
            {t('userMenu.seeAllAccounts')}
          </MenuItem>

          {/* Language submenu trigger — opens a nested Menu anchored to itself */}
          <MenuItem
            id="language-menu-trigger"
            onClick={handleLanguageMenuOpen}
            aria-haspopup="menu"
            aria-expanded={Boolean(languageAnchorEl)}
            aria-controls="language-menu"
          >
            <ListItemIcon>
              <LanguageIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('userMenu.language')}</ListItemText>
            <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />
          </MenuItem>

          <MenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
            {logoutMutation.isPending ? t('userMenu.loggingOut') : t('userMenu.logout')}
          </MenuItem>
        </Menu>

        {/* Nested Language submenu: lists supported languages with a check on
            the active one. Anchored to the "Language" item via languageAnchorEl.

            This must portal to <body> (the MUI default) so it stacks ABOVE the
            outer user Menu's modal layer. If it renders inline instead (e.g. via
            slotProps.root.disablePortal), the outer Menu's full-screen backdrop
            sits on top of these items: a click then lands on that backdrop and
            closes the menu instead of selecting a language. */}
        <Menu
          id="language-menu"
          anchorEl={languageAnchorEl}
          open={Boolean(languageAnchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          MenuListProps={{
            'aria-labelledby': 'language-menu-trigger',
          }}
        >
          {SUPPORTED_LANGUAGES.map((language) => (
            <MenuItem
              key={language}
              role="menuitemradio"
              aria-checked={language === currentLanguage}
              selected={language === currentLanguage}
              onClick={() => handleSelectLanguage(language)}
            >
              <ListItemIcon>
                {language === currentLanguage && <CheckIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText>{languageLabels[language]}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </Toolbar>
    </AppBar>

    {/* Surface a failed language sync. The new language already applied locally
        (optimistic), but the PATCH /users/me did not persist it, so without this
        the choice would silently revert on the next load. The banner lets the
        user know it was not saved; picking a language again retries and clears it. */}
    <Snackbar
      open={didUpdateFail}
      autoHideDuration={6000}
      onClose={dismissUpdateError}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={dismissUpdateError} severity="error" variant="filled" sx={{ width: '100%' }}>
        {t('userMenu.languageUpdateFailed')}
      </Alert>
    </Snackbar>
    </>
  );
}
