// src/test/setup.ts
// Global test setup with MSW for API mocking
// This file runs before all tests to configure the test environment

import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

// Register AG Grid modules for tests that use AG Grid components
// This prevents "No AG Grid modules are registered" errors
ModuleRegistry.registerModules([AllCommunityModule]);

// Mock window.matchMedia for MUI components that check media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Use the shared server instance from ./mocks/server
// This ensures tests that import 'server' get the same instance

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset handlers and cleanup after each test
afterEach(() => {
  server.resetHandlers();  // Reset to default handlers
  cleanup();               // Unmount React components
  localStorage.clear();    // Clear all localStorage
  vi.clearAllMocks();      // Clear mock call history
});

// Stop server after all tests
afterAll(() => {
  server.close();
});
