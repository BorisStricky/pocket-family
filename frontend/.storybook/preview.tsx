 // frontend/.storybook/preview.tsx
import React from "react";
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { themeBalham } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
// Register AG Grid community modules once for Storybook
ModuleRegistry.registerModules([AllCommunityModule]);
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import type { Preview } from "@storybook/react";
import '../src/ag-theme-overrides.css';

const theme = createTheme({
  palette: {
    primary: { main: "#0066FF" },
    secondary: { main: "#6B7280" },
  },
});

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{ padding: 20 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],

  tags: ["autodocs"]
};

export default preview;
