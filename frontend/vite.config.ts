import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    host: true, // Allow external connections in Docker
    // Proxy /api requests to the backend so that the browser makes same-origin
    // requests. This ensures HttpOnly cookies (refresh_token with SameSite=lax)
    // are always sent, regardless of whether the user accesses the app via
    // localhost or a LAN IP address.
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
        // Strip the /api prefix before forwarding — the backend routes
        // don't include /api (e.g. /api/auth/login → /auth/login)
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
