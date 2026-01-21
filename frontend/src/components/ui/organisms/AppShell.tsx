// src/components/ui/organisms/AppShell.tsx
// Main application shell layout with TopNav, SideNav, and content area

import React from 'react';
import { Box, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import SideNav from './SideNav';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * AppShell Component
 *
 * Main layout container for the authenticated application
 * Structure:
 * - TopNav: Fixed app bar at top with branding, family switcher, user menu
 * - SideNav: Permanent sidebar with navigation links
 * - Main Content: Scrollable content area (renders nested routes via Outlet)
 *
 * This is the container for all family-scoped routes at /app/:familyId/*
 * Wrapped by FamilyGuard and FamilyProvider in router configuration
 */
export default function AppShell() {
  const { user } = useAuth();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Top Navigation Bar */}
      <TopNav user={user ?? undefined} />

      {/* Side Navigation Drawer */}
      <SideNav />

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
