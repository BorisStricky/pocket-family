// src/components/ui/organisms/SideNav.tsx
// Side navigation drawer with menu links

import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Toolbar,
  Divider,
  Box,
} from '@mui/material';
import {
  Home,
  Receipt,
  AccountBalance,
  Assessment,
  BarChart,
  Settings,
} from '@mui/icons-material';
import { Link, useLocation, useParams } from 'react-router-dom';

const DRAWER_WIDTH = 240;

/**
 * SideNav Component
 *
 * Permanent sidebar navigation with menu links
 * Reads familyId from URL params to construct family-scoped routes
 * Highlights the active route based on current location
 *
 * Menu items:
 * - Welcome
 * - Transactions
 * - Accounts
 * - Budgets
 * - Reports
 * - Settings
 */
export default function SideNav() {
  const location = useLocation();
  const { familyId } = useParams<{ familyId: string }>();

  // Menu items with family-scoped paths and icons
  const menuItems = [
    { label: 'Welcome', path: `/app/${familyId}/welcome`, icon: Home },
    { label: 'Transactions', path: `/app/${familyId}/transactions`, icon: Receipt },
    { label: 'Accounts', path: `/app/${familyId}/accounts`, icon: AccountBalance },
    { label: 'Budgets', path: `/app/${familyId}/budgets`, icon: Assessment },
    { label: 'Reports', path: `/app/${familyId}/reports`, icon: BarChart },
    { label: 'Settings', path: `/app/${familyId}/settings`, icon: Settings },
  ];

  return (
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
      role="navigation"
    >
      {/* Offset for TopNav AppBar */}
      <Toolbar />

      <Divider />

      {/* Navigation Menu */}
      <List>
        {menuItems.map((item) => {
          // Check if this route is active
          const isActive = location.pathname === item.path;
          // Extract icon component from menu item
          const IconComponent = item.icon;

          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={isActive}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.main',
                    },
                  },
                }}
              >
                {/* Icon with color based on active state */}
                <ListItemIcon
                  sx={{
                    color: isActive ? 'primary.main' : 'text.secondary',
                  }}
                >
                  <IconComponent />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />
    </Drawer>
  );
}
