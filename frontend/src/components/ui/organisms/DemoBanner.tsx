// Persistent disclaimer banner shown on every page of the public demo
// instance. Renders nothing in non-demo builds, so it can be safely mounted
// at the root of the router without conditional logic at the call site.

import React from 'react';
import { Alert, Box, Link as MuiLink } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { IS_DEMO_MODE, ROUTES } from '@/lib/constants';

export default function DemoBanner() {
  if (!IS_DEMO_MODE) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        // Must exceed TopNav's zIndex (drawer + 1 = 1201) so the banner
        // renders on top of the fixed AppBar instead of behind it.
        zIndex: (theme) => theme.zIndex.drawer + 2,
      }}
    >
      <Alert
        severity="warning"
        variant="filled"
        sx={{
          borderRadius: 0,
          py: 0.5,
          '& .MuiAlert-message': { width: '100%', textAlign: 'center' },
        }}
        icon={false}
      >
        <strong>DEMO INSTANCE</strong> — Do not enter real personal or financial
        data. All data is deleted daily.{' '}
        <MuiLink
          component={RouterLink}
          to={ROUTES.LEGAL}
          sx={{ color: 'inherit', textDecoration: 'underline' }}
        >
          Legal
        </MuiLink>
      </Alert>
    </Box>
  );
}
