import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vitest configuration for frontend test suite
// Uses MSW for API mocking and jsdom for browser environment simulation
export default defineConfig({
  plugins: [react()],
  // Define environment variables for tests
  // This ensures VITE_API_URL is available without needing .env files
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:8000'),
  },
  test: {
    globals: true,           // Use global test, expect, describe, it
    environment: 'jsdom',    // Browser-like environment
    setupFiles: './src/test/setup.ts',  // Global test setup with MSW
    css: true,               // Process CSS imports
    // Timeout settings to prevent hanging tests
    testTimeout: 30000,      // 30 seconds per test (AG Grid + MUI dialog tests need extra time under load)
    hookTimeout: 30000,      // 30 seconds for beforeEach/afterEach hooks
    // Cap parallel test-file workers. The heaviest integration tests (nested MUI
    // dialogs + Autocomplete, e.g. the inline category-create flow) take ~14s on
    // their own. With unbounded parallelism those workers starve each other for
    // CPU and exceed testTimeout, even though every file passes in isolation.
    // Capping at 3 removes the contention while keeping most of the parallel speed.
    maxWorkers: 3,
    minWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
