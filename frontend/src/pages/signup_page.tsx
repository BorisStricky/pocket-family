// src/pages/signup_page.tsx
// Signup page with AuthForm. On the demo instance the form is replaced with
// an informational panel so visitors cannot type anything into a disabled
// signup flow — the backend also returns 403 here.

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Button, Container, Paper, Typography } from '@mui/material';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { useSignup } from '@/features/auth/hooks/useSignup';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getErrorMessage } from '@/lib/errorUtils';
import { IS_DEMO_MODE, ROUTES } from '@/lib/constants';

export default function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const signupMutation = useSignup();

  // Redirect to app if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app');
    }
  }, [isAuthenticated, navigate]);

  const handleSignup = (data: { email: string; password: string; name?: string }) => {
    signupMutation.mutate(data, {
      onSuccess: () => {
        navigate('/app');
      },
    });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f5f5f5',
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4 }}>
          {IS_DEMO_MODE ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
              <Typography variant="h4" component="h1">
                {t('auth.signupDisabledTitle')}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {t('auth.signupDisabledMessage')}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate(ROUTES.LOGIN)}
                sx={{ mt: 2 }}
              >
                {t('auth.goToLogin')}
              </Button>
            </Box>
          ) : (
            <AuthForm
              mode="signup"
              onSubmit={handleSignup}
              isLoading={signupMutation.isPending}
              error={signupMutation.error ? getErrorMessage(signupMutation.error) : null}
            />
          )}
        </Paper>
      </Container>
    </Box>
  );
}
