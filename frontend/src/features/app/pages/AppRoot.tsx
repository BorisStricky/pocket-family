// src/features/app/pages/AppRoot.tsx
// Root redirect component for /app route — sends user to their family's dashboard

import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * AppRoot Component
 *
 * Handles redirect from /app to /app/:familyId/dashboard
 * Extracts tenant_id from JWT token to determine default family
 * Falls back to /app/families if no tenant_id in token
 *
 * Flow:
 * 1. Check user's tenant_id from JWT token
 * 2. Redirect to /app/:tenant_id/dashboard if tenant_id exists
 * 3. Redirect to /app/families if no tenant_id (let user choose)
 */
export default function AppRoot() {
  const { user, isLoading } = useAuth();

  // Show loading while auth is initializing
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  // Redirect to user's current family from JWT token
  if (user?.tenant_id) {
    return <Navigate to={`/app/${user.tenant_id}/dashboard`} replace />;
  }

  // No tenant_id in token - redirect to family selector
  return <Navigate to="/app/families" replace />;
}
