// src/pages/signup_page.tsx
// Signup page with AuthForm

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Paper } from '@mui/material';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { useSignup } from '@/features/auth/hooks/useSignup';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getErrorMessage } from '@/lib/errorUtils';

export default function SignupPage() {
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
          <AuthForm
            mode="signup"
            onSubmit={handleSignup}
            isLoading={signupMutation.isPending}
            error={signupMutation.error ? getErrorMessage(signupMutation.error) : null}
          />
        </Paper>
      </Container>
    </Box>
  );
}
