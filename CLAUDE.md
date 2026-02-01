# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Getting Started

**IMPORTANT**: When starting work in this repository, ALWAYS read:
1. [.claude/instructions.md](.claude/instructions.md) - Detailed workflow and coding standards
2. [docs/active_context/frontend_roadmap.md](docs/active_context/frontend_roadmap.md) - Current sprint overview
3. Files in `.active_context/sprint_N.md` - Active sprint checklist (where N is the current sprint)

These files contain critical context about the current work state, code quality standards, and task checklists.

## Project Overview

This is a **multi-tenant personal finance SaaS** platform that allows individuals and families to track expenses, manage budgets, and analyze financial data collaboratively. This is a **learning project** requiring detailed inline comments and explanations.

### Tech Stack

**Backend:**
- FastAPI (Python) with SQLModel ORM
- PostgreSQL database (multi-tenant via `tenant_id` filtering)
- JWT authentication (access + refresh tokens)
- Celery + Redis for background jobs (CSV imports, recurring transactions)
- Alembic for database migrations
- pytest for testing

**Frontend:**
- React 18 + TypeScript + Vite
- Material-UI (MUI) component library
- TanStack React Query for server state
- React Router v6 for routing
- AG Grid Community for data tables
- React Hook Form for forms
- Vitest + React Testing Library for testing
- Storybook for component development

## Common Commands

### Backend Development

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run development server (with hot reload)
cd backend/api
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest                          # Run all tests
pytest tests/test_auth_endpoints.py  # Run specific test file
pytest -v                       # Verbose output
pytest --cov=app               # Run with coverage

# Database migrations
cd backend/api
alembic revision --autogenerate -m "Description"  # Create migration
alembic upgrade head                               # Apply migrations
alembic downgrade -1                               # Rollback one migration
```

### Frontend Development

```bash
# Install dependencies
cd frontend
npm install

# Development server (Vite on port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Testing
npm test                        # Run tests in watch mode
npm run test:run               # Run tests once (CI mode)
npm run test:ui                # Open Vitest UI
npm run test:coverage          # Generate coverage report

# Storybook
npm run storybook              # Start Storybook on port 6006
npm run build-storybook        # Build static Storybook
```

### Docker Development

```bash
# Start all services (backend, frontend, database, redis)
docker-compose -f docker-compose.dev.yml up

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Rebuild containers
docker-compose -f docker-compose.dev.yml up --build
```

## Architecture Overview

### Multi-Tenant Design

- **Tenant Model**: Single database with shared schema using `tenant_id` column filtering
- **Isolation**: All queries automatically filter by `tenant_id` to prevent data leaks
- **Memberships**: Users can belong to multiple tenants (families) with different roles (owner, member, viewer)
- **Preferred Tenant**: Users have a `preferred_tenant_id` set on login for default context

### Authentication Flow

1. **Signup/Login**: POST to `/auth/signup` or `/auth/login` returns `TokenOut` with access + refresh tokens
2. **Token Storage**:
   - Access token stored in localStorage at `pf_access_token`
   - Refresh token stored as HttpOnly cookie (in production) or returned in response (TEST_MODE)
3. **Protected Requests**: All API calls include `Authorization: Bearer {access_token}` header via centralized `apiFetch()` function
4. **Token Payload**: JWT contains `sub` (user_id), `tenant_id`, `email` - decoded client-side for state management
5. **Tenant Switching**: POST to `/tenants/{tenant_id}/switch` returns new token with updated `tenant_id`

### Frontend Architecture (Hybrid Approach)

```
src/
  components/
    ui/                    # Shared atomic design components
      atoms/              # Button, Input, Icon, Avatar, Chip
      molecules/          # SearchInput, FormField, DateRangePicker
      organisms/          # TopNav, SideNav, AppShell
    domain/               # Business-specific reusable components
      ag/                # AG Grid wrappers (AgTransactionsGrid, etc.)
  features/               # Feature modules (flat structure)
    auth/
      api/               # API functions (login, signup, logout)
      hooks/             # React Query hooks (useLogin, useSignup)
      context/           # Auth context provider
      components/        # Feature-specific components (AuthForm)
      pages/            # Pages (LoginPage, SignupPage)
    transactions/
      [same structure]
  lib/
    apiClient.ts         # Centralized fetch wrapper with auth headers
    constants.ts         # STORAGE_KEYS, API_ENDPOINTS, ROUTES
    jwtUtils.ts         # JWT decoding utilities
  router/
    index.tsx           # React Router configuration
```

**Placement Rules**:
- `components/ui/*` → Pure UI components used across multiple features
- `components/domain/*` → Business logic components reused across features (AG Grid wrappers, CategoryTree)
- `features/*/components/` → Feature-specific components (keep flat, no subdirectories)

### Backend Architecture

```
backend/api/app/
  main.py              # FastAPI app entry, CORS, startup
  models.py            # SQLModel database models
  schemas.py           # Pydantic request/response schemas
  auth.py              # JWT utilities, password hashing
  db.py                # Database connection and init
  deps.py              # Dependency injection (get_current_user_context)
  routers/
    auth.py            # /auth endpoints (signup, login, refresh, logout)
    tenants.py         # /tenants endpoints (CRUD, switch)
    accounts.py        # /accounts endpoints
    categories.py      # /categories endpoints
    transactions.py    # /transactions endpoints
```

**Key Backend Patterns**:
- **Dependency Injection**: `Depends(get_current_user_context)` returns `ActiveContext` with user, tenant, and membership
- **Tenant Filtering**: All queries include `.where(Model.tenant_id == tenant_id)` to enforce isolation
- **Models vs Schemas**: SQLModel classes for DB, Pydantic schemas for API contracts
- **TEST_MODE**: Environment variable enables returning raw refresh tokens in responses for testing

### API Endpoint Structure

All authenticated routes include tenant context validation:

```
/auth/                 → signup, login, logout, refresh
/tenants/              → list, get, create, update, delete, switch
/accounts/             → CRUD operations (filtered by tenant_id)
/categories/           → hierarchical category management
/transactions/         → transaction CRUD with filtering
/ping                  → health check
```

### State Management Strategy

- **Server State**: TanStack React Query (for all API data)
  - Query keys namespaced: `['transactions', familyId, filters]`
  - Mutations invalidate related queries automatically
- **Auth State**: React Context (`AuthContext`) provides `user`, `isAuthenticated`, `setTokens`, `clearAuth`
- **Family Context**: React Context (`FamilyContext`) provides `currentFamily`, `families`, `switchFamily`
- **UI State**: Local `useState` for forms, modals, toggles

## Critical Coding Standards

### Variable Naming (STRICT)

❌ **NEVER abbreviate**:
- `tx`, `q`, `acc`, `cat`, `temp`, `res`, `req`

✅ **ALWAYS use full descriptive names**:
- `transaction`, `query`, `account`, `category`, `temporary`, `response`, `request`
- `userTransactions` (not `data`), `isLoadingCategories` (not `loading`)

### TypeScript Requirements

- All frontend files use `.tsx` or `.ts` extensions
- NO `any` types - use proper interfaces/types
- Props interfaces required for all components
- API types should match backend Pydantic schemas

### Inline Comments (Required)

Explain the **"why"** at high level for all files:

```typescript
// Prefetch family data on mount to validate user membership
// before rendering protected content
useEffect(() => {
  if (familyId) {
    prefetchFamily(familyId);
  }
}, [familyId]);
```

### API Integration Pattern

All API calls use centralized client:

```typescript
import { apiFetch } from '@/lib/apiClient';

// In hooks:
const { data: transactions } = useQuery({
  queryKey: ['transactions', familyId, filters],
  queryFn: () => apiFetch(`/transactions?tenant_id=${familyId}`),
});
```

**Always include**:
- Authorization header (automatically via `apiFetch`)
- `tenant_id` query param or in request body
- Error handling (401 → logout, 403 → show error)

### Backend Testing with TEST_MODE

Tests require `TEST_MODE=1` environment variable to receive raw refresh tokens:

```python
# In tests
response = client.post("/auth/login", json={"email": "...", "password": "..."})
assert "refresh_token" in response.json()  # Only works in TEST_MODE
```

## Important Architectural Rules

### Multi-Tenant Safety

- **Every domain model** must include `tenant_id` column
- **All tenant-scoped routes** must use `Depends(get_current_user_context)`
- **All queries** must filter by `tenant_id` to prevent cross-tenant data leaks
- **JWT tokens** include both `sub` (user_id) and `tenant_id` claims

### Authentication & Security

- Passwords hashed with Argon2 (via passlib)
- Refresh tokens stored as SHA-256 hashes in database
- Access tokens short-lived (15 minutes default)
- Refresh tokens long-lived (30 days default)
- HttpOnly cookies for refresh tokens in production

### Database Migrations

- **Every model change** requires Alembic migration
- Test migrations work both upgrade and downgrade
- Never edit migrations after they're committed

### Testing Requirements

- Backend: pytest with TestClient, SQLite test database
- Frontend: Vitest + React Testing Library
- All new features require tests
- Tests must validate tenant isolation

## Common Patterns & Utilities

### Protected Routes (Frontend)

```typescript
<Route path="/app/:familyId/*" element={
  <ProtectedRoute>
    <FamilyGuard>
      <AppShell>
        {/* nested routes */}
      </AppShell>
    </FamilyGuard>
  </ProtectedRoute>
} />
```

- `ProtectedRoute`: Validates authentication, redirects to `/login` if not authenticated
- `FamilyGuard`: Validates family membership, shows error if 403/404

### React Query Mutations Pattern

```typescript
const { mutate: createTransaction } = useMutation({
  mutationFn: (data: TransactionCreate) =>
    apiFetch('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
    toast.success('Transaction created');
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

### Backend Dependency Pattern

```python
from .deps import get_current_user_context, ActiveContext

@router.get("/transactions")
async def list_transactions(
    context: ActiveContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    # context.user - User object
    # context.tenant - Tenant object
    # context.membership - Membership object with role

    result = await db.execute(
        select(Transaction)
        .where(Transaction.tenant_id == context.tenant.id)
    )
    return result.scalars().all()
```

## Domain Model (Key Entities)

- **User**: Application users with email/password authentication
- **Tenant**: Represents a family/group (for multi-tenant isolation)
- **Membership**: Links users to tenants with roles (owner, member, viewer) and status (pending, active, revoked)
- **Account**: Financial accounts (cash, debit, credit) with balance tracking
- **Category**: Hierarchical expense/income categories scoped to tenant (parent_id for nesting)
- **Transaction**: Financial records with amount, date, account_id, category_id, transaction_type (expense/income)
- **RefreshToken**: Hashed tokens for session management
- **Invite**: Pending invitations to join tenants
- **AccountShare**: Cross-tenant account visibility control

## Environment Variables

### Backend

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/dbname
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
TEST_MODE=0  # Set to 1 in tests to return refresh tokens
```

### Frontend

```bash
VITE_API_URL=http://localhost:8000  # Backend API base URL
```

## Troubleshooting

### Backend Issues

**Database connection errors**:
- Ensure PostgreSQL is running (`docker-compose up db` or local postgres service)
- Check `DATABASE_URL` in environment or `.env` file
- Run migrations: `alembic upgrade head`

**CORS errors**:
- Verify frontend origin in [main.py](backend/api/app/main.py) `allow_origins` list
- Default: `http://localhost:5173` (Vite) and `http://localhost:3000`

**Test failures with refresh tokens**:
- Set `TEST_MODE=1` environment variable before running tests
- Tests use `set_test_mode_env` fixture in conftest.py

### Frontend Issues

**API connection errors**:
- Verify backend is running on correct port (default: 8000)
- Check `VITE_API_URL` in [.env.development](frontend/.env.development)
- Ensure CORS configured on backend

**Authentication redirects**:
- Check if access token exists: `localStorage.getItem('pf_access_token')`
- Verify token not expired using JWT decoder
- Check AuthContext loading state

**Build errors**:
- Clear node_modules: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run build` shows all type issues

## Documentation Files

For deeper understanding, refer to:

- [docs/north_star.md](docs/north_star.md) - Product vision and domain model invariants
- [docs/SystemArchitecture.md](docs/SystemArchitecture.md) - Detailed system architecture
- [docs/repo-structure.md](docs/repo-structure.md) - Repository organization conventions
- [docs/openAPI_spec.json](docs/openAPI_spec.json) - Complete API specification
- [docs/spec_2_pages_inventory_and_sitemap.md](docs/spec_2_pages_inventory_and_sitemap.md) - Frontend pages and routing
- [docs/spec_3_component_inventory.md](docs/spec_3_component_inventory.md) - UI component catalog
- [docs/glossary.md](docs/glossary.md) - Domain terminology and concepts

## Development Workflow

1. **Read active context**: Check `.active_context/sprint_N.md` for current tasks
2. **Update checklist**: Mark tasks as in progress or complete
3. **Write code**: Follow naming conventions, add inline comments explaining "why"
4. **Update memory bank**: Track new components in `.memory_bank/components_used.md`
5. **Update glossary**: Add new domain concepts to `docs/glossary.md`
6. **Run tests**: Verify changes with `pytest` (backend) or `npm test` (frontend)
7. **Commit with context**: Use descriptive commit messages

## Orchestration with the `/orchestrate` Command

For complex implementation work involving multiple milestones and specialized agents, use the `/orchestrate` command.

**Usage**:
```bash
# Orchestrate from a plan file
/orchestrate path/to/plan.md

# Continue a paused orchestration
/orchestrate continue
```

This command manages milestone-based workflows by:
- Breaking plans into test → implementation → review → documentation phases
- Delegating to specialized agents (frontend-dev, backend-test, code-reviewer, etc.)
- Auto-retrying failures up to 3 times before escalating
- Reporting progress after each milestone and waiting for user confirmation

See [.claude/commands/orchestrate.md](.claude/commands/orchestrate.md) for detailed orchestration rules, agent mappings, and validation criteria.

## Key Differences from Typical Projects

1. **Learning Mode**: All code requires inline comments explaining high-level "why"
2. **No Abbreviations**: Strict full variable naming policy (enforced in reviews)
3. **Hybrid Structure**: Atomic design for shared UI, flat structure for feature code
4. **Multi-Tenant First**: Every feature must respect tenant isolation from the start
5. **Context Tracking**: Active context files (.active_context/) track sprint progress
6. **Memory Bank**: Component usage tracked manually in .memory_bank/ for reuse visibility
