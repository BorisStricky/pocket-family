// src/components/ui/organisms/SideNav.tsx
// Responsive side navigation drawer — persistent on desktop, full-screen temporary on mobile

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
  IconButton,
} from '@mui/material';
import {
  Dashboard,
  Receipt,
  AccountBalance,
  Assessment,
  BarChart,
  Settings,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Link, useLocation, useParams } from 'react-router-dom';
import { LAYOUT } from '@/lib/constants';

interface SideNavProps {
  /** Whether the drawer is currently open */
  open: boolean;
  /** Callback to close the drawer (used on mobile after item click) */
  onClose: () => void;
  /** Whether the viewport is below the mobile breakpoint */
  isMobileViewport: boolean;
}

/**
 * SideNav Component
 *
 * Responsive sidebar navigation that adapts to viewport size:
 * - Desktop: persistent drawer that slides in/out and pushes main content
 * - Mobile: temporary full-screen overlay with close button and backdrop
 *
 * Reads familyId from URL params to construct family-scoped routes
 * Highlights the active route based on current location
 */
export default function SideNav({ open, onClose, isMobileViewport }: SideNavProps) {
  const location = useLocation();
  const { familyId } = useParams<{ familyId: string }>();

  // Menu items with family-scoped paths and icons — Dashboard is the primary landing page
  const menuItems = [
    { label: 'Dashboard', path: `/app/${familyId}/dashboard`, icon: Dashboard },
    { label: 'Transactions', path: `/app/${familyId}/transactions`, icon: Receipt },
    { label: 'Accounts', path: `/app/${familyId}/accounts`, icon: AccountBalance },
    { label: 'Budgets', path: `/app/${familyId}/budgets`, icon: Assessment },
    { label: 'Reports', path: `/app/${familyId}/reports`, icon: BarChart },
    { label: 'Settings', path: `/app/${familyId}/settings`, icon: Settings },
  ];

  return (
    <Drawer
      variant={isMobileViewport ? 'temporary' : 'persistent'}
      open={open}
      onClose={onClose}
      sx={{
        // Only reserve space in document flow on desktop when the drawer is open
        width: isMobileViewport ? 0 : (open ? LAYOUT.DRAWER_WIDTH : 0),
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          // Full viewport width on mobile for full-screen overlay effect
          // Fixed width on desktop for standard sidebar behavior
          width: isMobileViewport ? '100vw' : LAYOUT.DRAWER_WIDTH,
          boxSizing: 'border-box',
        },
      }}
      // keepMounted improves mobile performance by avoiding re-mounting drawer DOM on each toggle
      ModalProps={{ keepMounted: true }}
      role="navigation"
    >
      {/* Toolbar area: spacer on desktop, close button on mobile */}
      <Toolbar
        sx={{
          ...(isMobileViewport && {
            display: 'flex',
            justifyContent: 'flex-end',
          }),
        }}
      >
        {isMobileViewport && (
          <IconButton onClick={onClose} aria-label="close navigation menu">
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>

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
                onClick={() => {
                  // Close the drawer after navigation on mobile
                  // so the full-screen overlay does not persist over the new page
                  if (isMobileViewport) {
                    onClose();
                  }
                }}
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

      {/* Spacer pushes content to top */}
      <Box sx={{ flexGrow: 1 }} />
    </Drawer>
  );
}
