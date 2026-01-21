// src/pages/login_page.tsx
// Login page with AuthForm

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Paper } from '@mui/material';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getErrorMessage } from '@/lib/errorUtils';

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
