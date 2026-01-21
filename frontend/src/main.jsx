// frontend/src/main.jsx
// Application entrypoint for local development / testing.

import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/context/AuthContext';
import AppRouter from './router';
import './index.css'; // make sure Tailwind is configured and this file exists
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

// Register AG Grid community modules once for Storybook
ModuleRegistry.registerModules([AllCommunityModule]);

// Create a QueryClient instance for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Mount the app
const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element not found. Add <div id="root"></div> to your index.html');
}

createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
