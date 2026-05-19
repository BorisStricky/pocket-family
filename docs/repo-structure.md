# Repository structure — Personal Finance (repo overview)

This document describes the layout of this repository, key files, and where to look when working on the project.

## Short description

This repository implements a multi-tenant SaaS personal finance application. The backend is a FastAPI service (Python) with Alembic migrations; background processing is planned/handled via typical background-worker patterns (e.g., Celery + Redis as documented). Object storage is S3/MinIO in deployments. The repo includes developer scripts, OpenAPI spec, and architecture diagrams in the `docs/` folder.

## Top-level tree (important entries)

.
- .gitignore
- Dockerfile.dev
- docker-compose.yaml
- pytest.ini
- backend/
  - docker-compose.yml
  - requirements.txt
  - api/
    - Dockerfile
    - alembic/
      - env.py
    - app/
      - main.py               # FastAPI application entrypoint
      - db.py                 # DB session and engine setup
      - models.py             # SQLModel / SQLAlchemy models
      - schemas.py            # Pydantic/SQLModel request/response schemas
      - deps.py               # Dependency helpers (auth, tenancy, DB deps)
      - auth.py               # Auth helper functions (JWT handling)
      - routers/
        - __init__.py
        - accounts.py         # Accounts endpoints
        - auth.py             # Auth-related endpoints
        - categories.py       # Category endpoints
        - tenants.py          # Tenant management endpoints
        - transactions.py     # Transaction endpoints
  - scripts/
    - recreate_db.py          # Developer script to reset / recreate DB
- docs/
  - Diagram.plantuml
  - ERD.plantuml
  - SystemArchitecture.md
  - north_star.md
  - openAPI_spec.json
  - repo-structure.md
  - requirements.md
  - requirements.yaml
  - Pull Requests/            # release notes for each sprint/milestone
- frontend/
  - Dockerfile
  - nginx.conf
  - index.html
  - package.json
  - src/
    - main.jsx
    - index.css
    - router/
      - index.tsx              # React Router configuration
    - components/
      - ui/                   # Atomic design: shared UI components
        - atoms/
        - molecules/
        - organisms/
      - domain/               # Business-logic components (AG Grid wrappers, etc.)
    - features/               # Feature modules (flat structure)
      - app/                 # App shell and main layout
      - auth/                # Authentication (login, signup, logout)
      - accounts/            # Account management
      - transactions/        # Transaction CRUD
      - category/            # Category management (split from family)
        - api/               # API functions
        - hooks/             # React Query hooks
        - components/        # Feature-specific components
      - family/              # Family/tenant management
        - components/        # Family-specific components
      - settings/            # Settings pages (categories, family management)
    - lib/
      - apiClient.ts         # Centralized API fetch wrapper
      - jwtUtils.ts         # JWT utilities
      - constants.ts         # API endpoints, storage keys
    - __tests__/             # Frontend tests
      - components/
      - features/
      - lib/
- personal/                   # Personal notes / non-critical artifacts
- tests/
  - conftest.py
  - helpers.py
  - test_account_crud.py
  - test_account_share_crud.py
  - test_auth_endpoints.py
  - test_category_crud.py
  - test_membership_crud.py
  - test_tenant_crud.py
  - test_transaction_crud.py

## Per-folder notes

### `backend/`
The main backend project. Contains service Dockerfiles, a docker-compose configuration for local development, Python requirements, Alembic migration config, and the FastAPI app under `backend/api/app/`. Use the compose file in this folder for running a local development stack focused on API + DB dependencies.

Key items:
- `backend/docker-compose.yml` — compose stack for local development (API, DB, other services).
- `backend/requirements.txt` — Python dependencies for the backend services.
- `backend/scripts/` — helper scripts (e.g., `recreate_db.py`).

### `backend/api/`
The API service.

Key files:
- `backend/api/app/main.py`: FastAPI app startup and mount points.
- `backend/api/app/models.py`: Database models and table definitions.
- `backend/api/app/schemas.py`: Request/response schemas.
- `backend/api/app/deps.py`: Dependency injection helpers such as tenant and DB session dependencies.
- `backend/api/app/auth.py`: JWT handling and auth helpers.
- `backend/api/app/routers/`: Route modules:
  - `accounts.py` — account CRUD and related operations.
  - `auth.py` — authentication endpoints.
  - `categories.py` — category CRUD.
  - `tenants.py` — tenant CRUD and management.
  - `transactions.py` — transaction CRUD and related operations.

### `backend/api/alembic/`
Alembic configuration and env (migration environment). Use this for database migrations.
- `backend/api/alembic/env.py` — Alembic environment configuration.

### `backend/scripts/`
Developer helper scripts such as:
- `recreate_db.py` — quickly reinitializes the local database during development.

### `frontend/`
React single-page app (SPA) for the personal finance dashboard. Built with TypeScript, Material-UI, React Query, and AG Grid.

Key files:
- `frontend/Dockerfile` — image build for production.
- `frontend/nginx.conf` — nginx config used in containerized deployments.
- `frontend/index.html` — SPA HTML entry point.
- `frontend/package.json` — frontend dependencies & scripts (React, MUI, React Query, Vitest).

#### `frontend/src/`

**Structure Overview** (Hybrid Atomic + Feature-based):
- `router/index.tsx` — React Router v6 configuration with protected routes and nested layouts.
- `components/ui/` — Atomic design components shared across features (Button, Input, Modal, Dialog, etc.).
- `components/domain/` — Business-logic components reused across features (AG Grid wrappers, CategoryTree).
- `features/` — Feature modules with flat internal structure (no subdirectories within components/).
- `lib/` — Shared utilities (API client, JWT decoding, constants).
- `__tests__/` — Frontend tests using Vitest + React Testing Library + MSW (Mock Service Worker).

**Features Structure**:
- `features/auth/` — Authentication (login, signup, logout, token management).
- `features/accounts/` — Account CRUD and management.
- `features/transactions/` — Transaction creation, editing, listing with filtering.
- `features/category/` — **Category management (split from family in recent refactor)**
  - `api/categoriesApi.ts` — API calls for category CRUD.
  - `hooks/` — React Query hooks (useCategories, useCreateCategory, useUpdateCategory, etc.).
  - `components/` — Modals and dialogs (AddCategoryModal, EditCategoryModal, DeleteCategoryConfirm).
- `features/family/` — Family/tenant membership and settings.
- `features/settings/` — Composed settings page with tabs (Categories, Family management).
- `features/app/` — App shell and main layout.

**Key Architectural Patterns**:
- **API Integration**: All calls use `apiFetch()` from `lib/apiClient.ts` (centralized auth headers).
- **State Management**: TanStack React Query for server state, React Context for auth/tenant context.
- **Forms**: React Hook Form + Material-UI components with validation.
- **Tables**: AG Grid Community with custom wrappers in `components/domain/ag/`.
- **Testing**: Vitest with setupAuthenticatedUser utility and MSW handlers for API mocking.

### `docs/`
Architecture and documentation:
- `Diagram.plantuml`, `ERD.plantuml` — diagrams.
- `SystemArchitecture.md` — consolidated architecture reference.
- `north_star.md` — product vision.
- `openAPI_spec.json` — API specification.
- `repo-structure.md` — this document.
- `requirements.md` / `requirements.yaml` — requirements documentation.
- `docs/frontend/` — frontend design/spec documents.

### `tests/`
Automated tests for the backend:
- `conftest.py` — pytest configuration and fixtures.
- `helpers.py` — shared helper functions for tests.
- `test_*.py` — individual test modules covering:
  - account CRUD and sharing
  - auth endpoints
  - category CRUD
  - membership CRUD
  - tenant CRUD
  - transaction CRUD

Run with `pytest` from the repository root (uses `pytest.ini` and the `tests/` directory).

### `personal/`
Personal notes and content not part of the main application code. Contains scratch files or experiments.

## How to run locally (development)

### Docker Compose (recommended for development)
- API-focused dev stack:
  From repo root:
  ```bash
  docker compose -f backend/docker-compose.yml up --build
  ```
  This runs the backend API, DB and other supporting services as defined in `backend/docker-compose.yml`.

- Full-stack (if `docker-compose.yaml` at repo root is configured for combined services):
  From repo root:
  ```bash
  docker compose up --build
  ```
  (Check the root `docker-compose.yaml` to confirm service definitions.)

### Running backend directly with Python / venv
1. Create and activate a virtual environment (Python 3.11).
2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Ensure Postgres/Redis and other required services are available (via Docker or local instances) and configured via environment variables.
4. Run API with Uvicorn:
   ```bash
   uvicorn backend.api.app.main:app --reload
   ```

### Running frontend locally
- From `frontend/`:
  ```bash
  cd frontend
  npm install
  npm run dev    # or the appropriate script in package.json
  ```

### Running tests
From the repo root:
```bash
pytest
```

## Key files to inspect when working on features
- `backend/api/app/main.py`
- `backend/api/app/models.py`
- `backend/api/app/deps.py`
- `backend/api/app/routers/*.py`
- `backend/api/alembic/env.py`
- `frontend/src/` (router, pages, main)

## Useful notes
- Tenancy model and tenant-aware dependencies are implemented in backend models and deps.
- Background processing details and execution environment are described in architecture docs; Celery + Redis is a documented approach where relevant.
- Configuration and secrets are environment-driven. For production use a secrets manager.
- See `docs/` for architecture diagrams and API specs.

## References
- `docs/Diagram.plantuml`
- `docs/ERD.plantuml`
- `docs/SystemArchitecture.md`
- `docs/north_star.md`
- `docs/openAPI_spec.json`
- `backend/` and `frontend/` folders
