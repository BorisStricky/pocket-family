// src/features/app/pages/WelcomePage.tsx
// Welcome page with quick actions and placeholders for future features

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  AddCircleOutline,
  AccountBalance,
  Assessment,
  Settings,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useFamily } from '@/features/family/hooks/useFamily';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * WelcomePage Component
 *
 * Landing page after login or when accessing /app/:familyId/welcome
 * Shows welcome message, quick stats (placeholder), and quick action buttons
 *
 * Route: /app/:familyId/welcome
 */
export default function WelcomePage() {
  const { currentFamily, isLoading } = useFamily();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
          Welcome to {currentFamily?.name || 'Your Family'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your family's finances all in one place
        </Typography>
      </Box>

      {/* Quick Stats Placeholders */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Balance
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                $--,---
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Coming soon
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                This Month
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                $--,---
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Coming soon
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Transactions
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                --
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Coming soon
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Accounts
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                --
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Coming soon
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              component={Link}
              to={`/app/${currentFamily?.id}/transactions`}
              variant="outlined"
              fullWidth
              startIcon={<AddCircleOutline />}
              sx={{ py: 2, justifyContent: 'flex-start' }}
            >
              Add Transaction
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              component={Link}
              to={`/app/${currentFamily?.id}/accounts`}
              variant="outlined"
              fullWidth
              startIcon={<AccountBalance />}
              sx={{ py: 2, justifyContent: 'flex-start' }}
            >
              View Accounts
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              component={Link}
              to={`/app/${currentFamily?.id}/reports`}
              variant="outlined"
              fullWidth
              startIcon={<Assessment />}
              sx={{ py: 2, justifyContent: 'flex-start' }}
            >
              View Reports
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              component={Link}
              to={`/app/${currentFamily?.id}/settings`}
              variant="outlined"
              fullWidth
              startIcon={<Settings />}
              sx={{ py: 2, justifyContent: 'flex-start' }}
            >
              Settings
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Recent Activity Placeholder */}
      <Box>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Recent Activity
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              Recent transactions will appear here once you start adding them
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
