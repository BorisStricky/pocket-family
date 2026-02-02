---
documentation_status: New
overview: Covers modern frontend build tools and configuration including Vite, Tailwind CSS, PostCSS, and environment variables. Explains how these tools work together to create an optimized development and production build pipeline.
tags:
  - vite
  - tailwind
  - postcss
  - typescript
  - build-tools
---

# Frontend Build & Configuration

**Vite**: Modern frontend build tool that provides fast development server with hot module replacement (HMR) and optimized production builds. We use it as our bundler instead of Create React App or Webpack. Configuration: [vite.config.ts](../frontend/vite.config.ts)

**Tailwind CSS**: Utility-first CSS framework that generates CSS based on classes used in your components. Requires configuration to scan files for class names. Configuration: [tailwind.config.js](../frontend/tailwind.config.js)

**PostCSS**: CSS preprocessor that transforms CSS with plugins. We use it to process Tailwind directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`) into actual CSS. Configuration: [postcss.config.js](../frontend/postcss.config.js)

**Path Alias (@/)**: TypeScript/Vite feature that maps `@/` to `src/` directory, allowing imports like `import { Button } from '@/components/ui/Button'` instead of relative paths like `../../components/ui/Button`. Configured in vite.config.ts and tsconfig.json.

**Environment Variables (VITE_*)**: Configuration values that change between environments (development/production). In Vite, env vars must be prefixed with `VITE_` to be exposed to frontend code. Access via `import.meta.env.VITE_API_URL`. Files: `.env.development`, `.env.production`
