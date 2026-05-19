import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Injects a noindex/nofollow meta tag and adjusts the title when this build
// targets the public demo (VITE_DEMO_MODE=true). Search engines that respect
// robots meta will then exclude the demo from their indexes, so it doesn't
// compete with the real marketing site.
function demoHtmlMeta(): Plugin {
  return {
    name: 'pocket-family-demo-html-meta',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const isDemo = process.env.VITE_DEMO_MODE === 'true'
        if (!isDemo) return html
        const noindex = '<meta name="robots" content="noindex,nofollow" />'
        return html
          .replace('</head>', `  ${noindex}\n  </head>`)
          .replace('<title>Pocket Family</title>', '<title>Pocket Family — Demo</title>')
      },
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  envDir: path.resolve(__dirname, '..'),
  plugins: [react(), demoHtmlMeta()],
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
        target: process.env.BACKEND_URL || 'http://localhost:8080',
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
