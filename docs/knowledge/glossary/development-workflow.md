---
documentation_status: New
overview: Covers development environment setup including Docker containers, Docker Compose, Hot Module Replacement, and npm scripts. Explains how to create consistent development environments and streamline the development workflow.
tags:
  - docker
  - vite
  - npm
  - development
  - devops
---

# Development Workflow

**Dev Container**: Docker container configured for development with all tools installed. Your VS Code runs inside the container for consistent environment across machines.

**Docker Compose**: Tool for defining multi-container applications. Our setup has separate containers for:
- `db`: PostgreSQL database
- `backend`: FastAPI server
- `frontend`: Vite dev server (or your dev container)

**Hot Module Replacement (HMR)**: Vite feature that updates code in browser without full page reload. Preserves component state while you develop.

**npm Scripts**: Commands defined in package.json:
- `npm run dev`: Start Vite dev server
- `npm run build`: Create production build
- `npm run storybook`: Start component library

**Environment**: Development vs Production. Different configs (API URLs, debug settings) for each. Files: `.env.development`, `.env.production`
