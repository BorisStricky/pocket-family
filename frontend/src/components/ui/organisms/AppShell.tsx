// src/components/ui/organisms/AppShell.tsx
// Main application shell layout with TopNav, SideNav, and content area

import React from 'react';
import { Box, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import SideNav from './SideNav';
import { useAuth } from '@/features/auth/hooks/useAuth';

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
 * Main layout container for the authenticated application
 * Structure:
 * - TopNav: Fixed app bar at top with branding, family switcher (or "Global" in global mode), user menu
 * - SideNav: Permanent sidebar with navigation links (hidden in global mode)
 * - Main Content: Scrollable content area (renders nested routes via Outlet)
 *
 * Supports two modes:
 * - Family mode (default): Shows family switcher and sidebar for /app/:familyId/* routes
 * - Global mode: Shows "Global" badge and back button for /app/accounts routes
 */
export default function AppShell({ globalMode = false }: AppShellProps) {
  const { user } = useAuth();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Top Navigation Bar */}
      <TopNav user={user ?? undefined} globalMode={globalMode} />

      {/* Side Navigation Drawer - only show in family mode */}
      {!globalMode && <SideNav />}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          bgcolor: '#f5f5f5',
          overflow: 'auto',
          minHeight: '100vh',
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
