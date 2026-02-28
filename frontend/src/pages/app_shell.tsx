// src/pages/app_shell.tsx
// Main application shell with sidebar and navigation

import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemText, Typography, Button, Divider } from '@mui/material';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLogout } from '@/features/auth/hooks/useLogout';

const DRAWER_WIDTH = 240;

export default function AppShell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate('/login');
      },
    });
  };

  const menuItems = [
    { label: 'Dashboard', path: '/app' },
    { label: 'Transactions', path: '/app/transactions' },
    { label: 'Accounts', path: '/app/accounts' },
    { label: 'Budgets', path: '/app/budgets' },
    { label: 'Reports', path: '/app/reports' },
    { label: 'Settings', path: '/app/settings' },
  ];

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Pocket Family
          </Typography>
        </Box>

        <Divider />

        <List>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton component={Link} to={item.path}>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ flexGrow: 1 }} />

        <Divider />

        {/* User Info */}
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
            Logged in as:
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
            ID: {user?.id?.slice(0, 8)}...
          </Typography>
          {user?.tenant_id && (
            <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
              Family: {user.tenant_id.slice(0, 8)}...
            </Typography>
          )}
          {user?.roles && (
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              Role: {user.roles.join(', ')}
            </Typography>
          )}
          <Button
            variant="outlined"
            size="small"
            fullWidth
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
          </Button>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          bgcolor: 'background.default',
          overflow: 'auto',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
