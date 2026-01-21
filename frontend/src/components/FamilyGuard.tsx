// src/components/FamilyGuard.tsx
// Guard component to validate family membership before rendering protected content

import React, { ReactNode, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Alert } from '@mui/material';
import { useFamilyById } from '@/features/family/hooks/useFamilyById';
import { useFamilies } from '@/features/family/hooks/useFamilies';
import { useSwitchFamily } from '@/features/family/hooks/useSwitchFamily';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';

interface FamilyGuardProps {
  children: ReactNode;
}

/**
 * FamilyGuard Component
 *
 * Validates that the user is an ACTIVE member of the family specified in the URL
 * Shows loading state while validating
 * Shows error with family switcher if validation fails (403/404)
 * Renders children only if user has valid access to the family
 *
 * Usage:
 * ```tsx
 * <Route path="/app/:familyId/*" element={
 *   <FamilyGuard>
 *     <AppShell />
 *   </FamilyGuard>
 * } />
 * ```
 */
export default function FamilyGuard({ children }: FamilyGuardProps) {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const { clearAuth } = useAuth();
  const { data: family, isLoading, error } = useFamilyById(familyId);
  const { data: allFamilies = [], error: familiesError } = useFamilies();
  const { mutate: switchToFamily, isPending, error: switchError } = useSwitchFamily();

  // Handle 401 errors (expired token) by clearing auth and redirecting to login
  useEffect(() => {
    const errors = [error, familiesError, switchError];
    for (const err of errors) {
      if (err instanceof ApiError && err.status === 401) {
        clearAuth();
        navigate('/login', { replace: true });
        return;
      }
    }
  }, [error, familiesError, switchError, clearAuth, navigate]);

  // Handle family switching via tenant switch API
  const handleFamilySwitch = (familyId: string) => {
    switchToFamily(familyId);
  };

  // Show loading spinner while validating family access
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
          Validating family access...
        </Typography>
      </Box>
    );
  }

  // Show error if family validation failed
  if (error || !family) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 3,
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body2">
            You are not a member of this family or the family does not exist.
          </Typography>
        </Alert>

        {/* Show list of families user can access */}
        {allFamilies.length > 0 && (
          <Box sx={{ textAlign: 'center', maxWidth: 500 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Switch to one of your families:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
              {allFamilies.map((availableFamily) => (
                <Button
                  key={availableFamily.id}
                  onClick={() => handleFamilySwitch(availableFamily.id)}
                  variant="outlined"
                  fullWidth
                  disabled={isPending}
                >
                  {availableFamily.name}
                </Button>
              ))}
            </Box>
          </Box>
        )}

        {/* Link to family selector page */}
        <Button
          component={Link}
          to="/app/families"
          variant="contained"
        >
          View All Families
        </Button>
      </Box>
    );
  }

  // Render children if validation successful
  return <>{children}</>;
}
