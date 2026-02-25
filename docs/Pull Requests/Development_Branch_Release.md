# Production Docker Deployment - Summary

**Branch:** `development` → `master`
**Commits:** 2 (`57f6a75`, `8fe6bf8`)
**Last Updated:** 2026-02-24

## Overview

This release hardens the existing Docker configuration for local-network production deployments. The changes remove development-only shortcuts (hardcoded secrets, volume-mounted source code), introduce environment-variable-driven configuration for secrets and CORS, and add a PostgreSQL healthcheck to ensure the backend only starts once the database is ready to accept connections.

## Goals Achieved

- ✅ **Production-safe secrets**: Database password and JWT secret are now injected via `.env.production` — never hardcoded
- ✅ **Environment-driven CORS**: `CORS_ORIGINS` environment variable replaces the hardcoded list in `main.py`, letting the same image work in dev and production
- ✅ **Vite build-time API URL**: `VITE_API_URL` is passed as a Docker build argument so the React bundle connects to the correct backend without rebuilding per environment
- ✅ **Self-contained images**: Dev volume mount (`./backend/api/:/app`) removed so the production image is truly self-contained
- ✅ **Database readiness**: PostgreSQL healthcheck + `condition: service_healthy` prevents backend startup race conditions
- ✅ **Env example file**: `.env.production.example` added as a safe-to-commit template with clear instructions

---

## Architecture & Tech Stack Changes

> [!info] Related Concepts
> For background on technologies used in this release:
> - [[../knowledge/glossary/development-workflow|Docker Compose]] - Orchestrating multi-container production setup
> - [[../knowledge/glossary/frontend-build-configuration|Vite & VITE_* Env Vars]] - Build-time environment variable injection
> - [[../knowledge/glossary/authentication-security|CORS & JWT]] - Security configuration patterns
> - [[../knowledge/glossary/api-communication|API Client (apiFetch)]] - How the frontend resolves the API URL

### CORS Origins via Environment Variable

Previously, allowed CORS origins were a hardcoded list in `main.py`. This was fine for development but made it impossible to use the same Docker image in multiple environments without rebuilding. The new pattern reads a comma-separated `CORS_ORIGINS` environment variable:

```python
# Before (main.py) — hardcoded list
allow_origins=["http://localhost:5173", "http://192.168.1.101:5173"]

# After — environment-driven
_cors_origins_raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173,...")
cors_origins = [origin.strip() for origin in _cors_origins_raw.split(",")]
```

See [[../knowledge/glossary/authentication-security|Authentication & Security]] for CORS concepts.

### Vite Build-Argument Pattern

Vite bakes `VITE_*` variables into the JS bundle at build time — they cannot be injected at runtime via Docker `environment:` because nginx only serves static files. The Dockerfile now accepts `VITE_API_URL` as a build `ARG`, and `docker-compose.yaml` passes it via `build.args`:

```yaml
frontend:
  build:
    args:
      VITE_API_URL: "http://192.168.1.101:8000"
```

```dockerfile
ARG VITE_API_URL=http://192.168.1.101:8000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
```

See [[../knowledge/glossary/frontend-build-configuration|Frontend Build & Configuration]] for Vite environment variable concepts.

### PostgreSQL Healthcheck

A healthcheck was added to the `db` service so that the backend's `depends_on` can use `condition: service_healthy` instead of `condition: service_started`. This prevents connection errors that occurred when the backend tried to connect before Postgres finished initialising.

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 10s
  timeout: 5s
  retries: 5
```

---

## Directory Structure

```
pocket-family/
  🆕 .env.production.example          # Safe-to-commit template for production secrets
  ✏️ backend/api/Dockerfile            # Fixed COPY paths; added explanatory comments
  ✏️ backend/api/app/main.py           # CORS origins now read from CORS_ORIGINS env var
  ✏️ docker-compose.yaml               # Full production config rewrite
  ✏️ frontend/Dockerfile               # Accept VITE_API_URL build arg; bake into bundle
  ✏️ docs/Pull Requests/Development_Branch_Release.md  # This document
```

---

## Files Changed — Detailed Breakdown

### Secrets & Configuration

**`.env.production.example`** — 🆕 NEW

- **Purpose**: A committed template that shows operators exactly which secrets must be supplied before running `docker-compose --env-file .env.production up --build`. The actual `.env.production` file is gitignored.
- **Key Contents**: `DB_PASSWORD` and `JWT_SECRET` placeholders with generation instructions (`openssl rand -hex 32`).
- **Impact**: Removes the "where do I put secrets?" ambiguity for anyone deploying the project.

---

### Backend

**`backend/api/Dockerfile`** — ✏️ MODIFIED

- **Key Changes**:
  - Fixed `COPY` paths to match the build context (`./backend`): `requirements.txt` is at the context root, and `api/` directory contents are copied into `/app/`.
  - Removed the commented-out `COPY api /app/api` line that was causing confusion.
  - Added explanatory comments describing why `COPY api/ .` (trailing slash) copies directory *contents* rather than the directory itself.
- **Impact**: Backend image now builds correctly from the production `docker-compose.yaml` context.

**`backend/api/app/main.py`** — ✏️ MODIFIED

- **Key Changes**: Replaced the hardcoded `allow_origins` list with a dynamic parse of the `CORS_ORIGINS` environment variable. Falls back to dev localhost origins when the variable is not set.
- **Impact**: The same Docker image can serve both dev and production without code changes. See [[../knowledge/glossary/authentication-security|Authentication & Security]].

**`docker-compose.yaml`** — ✏️ MODIFIED

- **Key Changes**:
  - Added file-level header comment explaining purpose, required secrets, and usage command.
  - `db` service: replaced hardcoded `POSTGRES_PASSWORD: postgres` with `${DB_PASSWORD}`; added `healthcheck`.
  - `backend` service: switched from `env_file: - .env` to explicit `environment:` block; added `condition: service_healthy` for `depends_on`; **removed** `volumes: - ./backend/api/:/app` (was overwriting the built image at runtime).
  - `frontend` service: added `build.args.VITE_API_URL`; **removed** `environment: VITE_API_BASE` (that variable does nothing at runtime for a static nginx image).
- **Impact**: Full production-ready orchestration. See [[../knowledge/glossary/development-workflow|Development Workflow]].

---

### Frontend

**`frontend/Dockerfile`** — ✏️ MODIFIED

- **Key Changes**: Added `ARG VITE_API_URL` and `ENV VITE_API_URL=$VITE_API_URL` before the `npm run build` step, so the build argument value is available to Vite during compilation.
- **Impact**: The React bundle's API base URL is configurable per-deployment without source code changes. See [[../knowledge/glossary/frontend-build-configuration|Frontend Build & Configuration]].

---

## Migration Notes

### Upgrading from Previous docker-compose.yaml

The old `docker-compose.yaml` used `env_file: - .env`. That file is no longer referenced.

**Required steps before running the production stack:**

1. Copy the example file:
   ```bash
   cp .env.production.example .env.production
   ```
2. Fill in real values:
   ```bash
   # Generate a strong JWT secret
   openssl rand -hex 32
   ```
3. Update `CORS_ORIGINS` in `docker-compose.yaml` and `VITE_API_URL` in `build.args` to match your server's local network IP.
4. Run the stack:
   ```bash
   docker-compose --env-file .env.production up --build
   ```

### Breaking Change: Volume Mount Removed

The dev setup relied on `./backend/api/:/app` to hot-reload backend code. This volume mount is **not present** in the production compose file. Any code changes require a rebuild (`--build`).

---

## Performance Impact

- **No frontend bundle size change** — only the injected API URL string differs.
- **Startup reliability improved** — healthcheck eliminates backend crash-loops on slow Postgres initialisation.

---

## Next Steps / Follow-up Work

- **Dynamic runtime config**: For truly environment-agnostic frontend images, investigate a startup script that rewrites the API URL in `index.html` at container start (avoids rebuild-per-environment).
- **Secrets manager integration**: Replace `.env.production` with Docker Secrets or a vault solution for team deployments.
- **CI/CD pipeline**: Add a GitHub Actions workflow that builds and pushes images on merge to `master`.
- **HTTPS**: Add nginx TLS termination or a reverse proxy (Caddy/Traefik) for production-grade security.

---

## Related Documentation

- [SystemArchitecture.md](../SystemArchitecture.md) - Overall system design
- [north_star.md](../north_star.md) - Product invariants including multi-tenant security requirements

### Technical Glossary

> [!info] Learning Resources
> New to the project? These glossary entries cover the core concepts in this release:
> - [[../knowledge/glossary/development-workflow|Development Workflow & Docker]] - Docker Compose, environment files, migrations
> - [[../knowledge/glossary/frontend-build-configuration|Frontend Build & Configuration]] - Vite, VITE_* env vars, build tooling
> - [[../knowledge/glossary/authentication-security|Authentication & Security]] - CORS, JWT, HttpOnly cookies
> - [[../knowledge/glossary/api-communication|API Communication]] - How apiFetch resolves API endpoints
