// src/components/ui/organisms/UnderConstruction.tsx
// Reusable full-width placeholder shown on pages that are still being built.
// Bleeds to the AppShell edges (negates p:3) so the image fills the content area.

import React from 'react';
import { Box, Alert, Typography } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';

interface UnderConstructionProps {
  // Human-readable name of the page shown in the banner subtitle
  pageName?: string;
}

export function UnderConstruction({ pageName }: UnderConstructionProps) {
  return (
    // Negative margin undoes AppShell's p:3 on all sides so the block is flush
    <Box sx={{ mx: -3, mt: -3 }}>

      {/* Warning banner */}
      <Alert
        severity="warning"
        icon={<ConstructionIcon />}
        sx={{
          borderRadius: 0,
          py: 1.5,
          px: 3,
          alignItems: 'center',
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold" component="span">
          Under Construction
        </Typography>
        {pageName && (
          <Typography variant="body2" component="span" sx={{ ml: 1 }}>
            — The {pageName} page is being built. Check back soon!
          </Typography>
        )}
      </Alert>

      {/* Full-width illustration — fills the remaining content-area width */}
      <Box
        component="img"
        src="/d8956940-a4cb-4613-a1b0-0e6d59f1e492.jpg"
        alt="Under construction illustration showing app screens surrounded by construction cranes"
        sx={{
          display: 'block',
          width: '100%',
          objectFit: 'cover',
        }}
      />
    </Box>
  );
}
