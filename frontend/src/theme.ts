// src/theme.ts
// Centralized MUI theme using the Obsidian-inspired green palette.
// All brand colors are defined here so components can reference
// theme tokens instead of hardcoding hex values.

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#044218',         // Deep forest green — brand color
      contrastText: '#E7FEEE', // Light mint — text on dark green backgrounds
    },
    text: {
      primary: '#011A08',      // Near-black green for body copy
    },
    background: {
      default: '#f8fafc',      // Neutral light background
      paper: '#ffffff',
    },
  },
});

export default theme;
