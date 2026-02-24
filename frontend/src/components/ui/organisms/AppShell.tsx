// src/components/ui/organisms/AppShell.tsx
// Main application shell layout with TopNav, responsive SideNav, and content area

import React, { useState, useEffect } from 'react';
import { Box, Toolbar, useMediaQuery, useTheme } from '@mui/material';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import SideNav from './SideNav';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LAYOUT } from '@/lib/constants';

interface AppShellProps {
  /**
   * If true, renders in global mode:
   * - TopNav shows "Global" instead of family switcher
   * - SideNav is hidden (global pages have their own navigation)
   * - Back button navigates to family picker
   */
  globalMode?: boolean;
}

/**
 * AppShell Component
 *
 * Main layout container for the authenticated application.
 * Manages responsive sidebar state:
 * - Desktop (>=900px): sidebar open by default, persistent drawer pushes content
 * - Mobile (<900px): sidebar closed by default, temporary full-screen overlay
 *
 * Supports two modes:
 * - Family mode (default): Shows family switcher, hamburger button, and sidebar
 * - Global mode: Shows "Global" badge and back button, no sidebar
 */
export default function AppShell({ globalMode = false }: AppShellProps) {
  const { user } = useAuth();
  const theme = useTheme();

  // Detect mobile viewport: below MUI "md" breakpoint (900px)
  // Used to determine default SideNav state and drawer variant
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('md'));

  // SideNav open state: open by default on desktop, closed on mobile
  const [sideNavigationOpen, setSideNavigationOpen] = useState(!isMobileViewport);

  // Auto-close sidebar when viewport shrinks below mobile breakpoint
  // to prevent the persistent drawer from blocking content unexpectedly
  useEffect(() => {
    if (isMobileViewport) {
      setSideNavigationOpen(false);
    }
  }, [isMobileViewport]);

  // Toggle function passed to TopNav hamburger button
  const handleToggleSideNavigation = () => {
    setSideNavigationOpen((previousState) => !previousState);
  };

  // Close function passed to SideNav for mobile "close on item click" behavior
  const handleCloseSideNavigation = () => {
    setSideNavigationOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Top Navigation Bar — only pass toggle handler when SideNav exists */}
      <TopNav
        user={user ?? undefined}
        globalMode={globalMode}
        onMenuClick={globalMode ? undefined : handleToggleSideNavigation}
      />

      {/* Side Navigation Drawer — only show in family mode */}
      {!globalMode && (
        <SideNav
          open={sideNavigationOpen}
          onClose={handleCloseSideNavigation}
          isMobileViewport={isMobileViewport}
        />
      )}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          bgcolor: '#f5f5f5',
          overflow: 'auto',
          minHeight: '100vh',
          // On desktop, shift content right when the persistent drawer is open
          // On mobile, no margin needed because the temporary drawer overlays content
          ml: !globalMode && !isMobileViewport && sideNavigationOpen
            ? `${LAYOUT.DRAWER_WIDTH}px`
            : 0,
          // Smooth transition when the drawer slides in/out on desktop
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: sideNavigationOpen
              ? theme.transitions.duration.enteringScreen
              : theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {/* Offset for fixed TopNav */}
        <Toolbar />

        {/* Render nested routes */}
        <Outlet />
      </Box>
    </Box>
  );
}
