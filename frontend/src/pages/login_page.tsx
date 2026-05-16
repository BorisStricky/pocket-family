// src/pages/login_page.tsx
// Login page with AuthForm. On the demo instance an extra one-click button
// auto-submits the shared demo credentials so showcase visitors don't have
// to type anything to get into the app.

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Divider, Paper, Typography } from '@mui/material';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getErrorMessage } from '@/lib/errorUtils';
import { DEMO_CREDENTIALS, IS_DEMO_MODE } from '@/lib/constants';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const loginMutation = useLogin();

  // Redirect to app if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = (data: { email: string; password: string }) => {
    loginMutation.mutate(data, {
      onSuccess: () => {
        navigate('/app');
      },
    });
  };

  // One-click demo login — fires the same mutation as the normal form but
  // with the shared demo credentials. Disabled while a request is in flight.
  const handleTryDemo = () => {
    handleLogin({
      email: DEMO_CREDENTIALS.EMAIL,
      password: DEMO_CREDENTIALS.PASSWORD,
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
          {IS_DEMO_MODE && (
            <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleTryDemo}
                disabled={loginMutation.isPending}
                fullWidth
              >
                Try the Demo
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                Signs you in as the shared demo account. Data resets daily.
              </Typography>
              <Divider sx={{ my: 2 }}>or sign in</Divider>
            </Box>
          )}

          <AuthForm
            mode="login"
            onSubmit={handleLogin}
            isLoading={loginMutation.isPending}
            error={loginMutation.error ? getErrorMessage(loginMutation.error) : null}
          />
        </Paper>
      </Container>
    </Box>
  );
}
