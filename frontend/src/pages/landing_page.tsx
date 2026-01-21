// src/pages/landing_page.tsx
// Landing page with call-to-action buttons

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Stack } from '@mui/material';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/app');
    } else {
      navigate('/signup');
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Hero Section */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
          py: 8,
        }}
      >
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Personal Finance Tracker
            </Typography>
            <Typography variant="h5" component="p" sx={{ mb: 4, opacity: 0.9 }}>
              Take control of your finances. Track expenses, manage budgets, and achieve your financial goals.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
            >
              <Button
                variant="contained"
                size="large"
                onClick={handleGetStarted}
                sx={{
                  bgcolor: 'white',
                  color: '#1976d2',
                  '&:hover': { bgcolor: '#f5f5f5' },
                  px: 4,
                  py: 1.5,
                }}
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
              </Button>
              {!isAuthenticated && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleLogin}
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    '&:hover': { borderColor: '#f5f5f5', bgcolor: 'rgba(255, 255, 255, 0.1)' },
                    px: 4,
                    py: 1.5,
                  }}
                >
                  Log In
                </Button>
              )}
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 8, bgcolor: '#f5f5f5' }}>
        <Container maxWidth="lg">
          <Typography variant="h3" component="h2" gutterBottom sx={{ textAlign: 'center', mb: 6 }}>
            Features
          </Typography>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={4}
            justifyContent="center"
          >
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography variant="h5" gutterBottom>
                📊 Track Expenses
              </Typography>
              <Typography color="text.secondary">
                Monitor your spending across multiple accounts and categories
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography variant="h5" gutterBottom>
                💰 Budget Management
              </Typography>
              <Typography color="text.secondary">
                Set budgets and get insights into your spending habits
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography variant="h5" gutterBottom>
                📈 Financial Reports
              </Typography>
              <Typography color="text.secondary">
                Generate detailed reports to understand your financial health
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          bgcolor: '#333',
          color: 'white',
          textAlign: 'center',
        }}
      >
        <Typography variant="body2">
          © 2025 Personal Finance Tracker. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}
