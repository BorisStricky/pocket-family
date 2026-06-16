# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Getting Started

**IMPORTANT**: When starting work in this repository, ALWAYS read:
1. [.claude/instructions.md](.claude/instructions.md) - Detailed workflow and coding standards
2. [docs/north_star.md](docs/north_star.md) - Product vision and domain model invariants
3. [docs/SystemArchitecture.md](docs/SystemArchitecture.md) - Detailed system architecture

These files contain critical context about the project's goals, design decisions, and coding standards.

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
# Install dependencies (uses uv for package management)
cd backend
uv sync                         # Install production deps
uv sync --all-extras            # Install production + dev deps

# Run development server (with hot reload)
cd backend/api
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
uv run pytest                          # Run all tests
uv run pytest tests/test_auth_endpoints.py  # Run specific test file
uv run pytest -v                       # Verbose output
uv run pytest --cov=app               # Run with coverage

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
  deps.py              # Dependency injection (get_active_context, get_current_user, require_role)
  services/            # Framework-agnostic domain logic (DB queries, business rules)
  routers/
    auth.py            # /auth endpoints (signup, login, refresh, logout)
    tenants.py         # /tenants endpoints (CRUD, switch)
    accounts.py        # /accounts endpoints
    categories.py      # /categories endpoints
    transactions.py    # /transactions endpoints
```

**Key Backend Patterns** (the authoritative, detailed version lives in [backend/CLAUDE.md](backend/CLAUDE.md) — defer to it):
- **Dependency Injection**: routes resolve auth/tenant context through a dependency — `Depends(get_active_context)` returns `ActiveContext` (`active_user`, `active_tenant`, `active_membership`); `require_owner`/`require_writer` add a role gate; `get_current_user` is for user-scoped routes
- **Service layer**: DB queries and business rules live in `app/services/`, not in routers; handlers stay thin (routing + orchestration)
- **Tenant Filtering**: All tenant-scoped queries include `.where(Model.tenant_id == tenant_id)` to enforce isolation
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

- **Every domain model** must include a `tenant_id` column (exception: `Account` is user-scoped — see [backend/CLAUDE.md](backend/CLAUDE.md))
- **All tenant-scoped routes** must resolve context via a dependency (`Depends(get_active_context)`, or `require_owner`/`require_writer` for role-gated writes) — never re-implement auth inline
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

### Backend Dependency & Service Pattern

Routers stay thin: resolve context via a dependency, then delegate DB work to a service in `app/services/`. The canonical, copy-pasteable example (read vs. role-gated write, where the tenant filter lives, the atomicity rule) is maintained in **[backend/CLAUDE.md](backend/CLAUDE.md)** under *Multi-tenant safety* and *Service layer & authorization conventions*. That module doc is the source of truth; this section intentionally does not duplicate it to avoid drift.

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

## Development Workflow

1. **Write code**: Follow naming conventions, add inline comments explaining "why"
2. **Run tests**: Verify changes with `pytest` (backend) or `npm test` (frontend)
3. **Commit with context**: Use descriptive commit messages

## Testing Philosophy & Requirements

### Test-First Development

All new features require tests BEFORE implementation:
- Frontend: Write integration tests using Vitest + React Testing Library
- Backend: Write tests using pytest

### Test Conventions Live in Module CLAUDE.md (CRITICAL RULE)

Test conventions are defined in the **module-level `CLAUDE.md`** files, which auto-load when you work in that folder. Follow them exactly when writing or updating tests:

- **Frontend tests** → [frontend/CLAUDE.md](frontend/CLAUDE.md)
  - Tests go in `src/__tests__/` (NOT co-located with source)
  - Integration-first approach (full page renders, user workflows)
  - Semantic queries only (`getByRole`, `getByText`, NOT `getByTestId`)
  - MSW for API mocking with in-memory stores

- **Backend tests** → [backend/CLAUDE.md](backend/CLAUDE.md)
  - Tests go in `backend/api/tests/`
  - Use pytest fixtures for test isolation; `TEST_MODE=1`
  - Mandatory multi-tenant data isolation tests

### When Tests Must Be Written or Updated

Write or update tests (following the relevant module `CLAUDE.md`) when:
- Writing tests for a new feature (tests first)
- Updating tests after behavior changes
- Fixing failing tests
- Rewriting tests to follow project conventions

**Exception**: Trivial assertion updates (e.g., changing expected text from "Welcome" to "Dashboard") may be done inline, but must still follow the module's test conventions.

### Holistic Code Review

Code review is **holistic** — it covers the whole implementation including infrastructure (Terraform, docker-compose, deploy scripts, env templates, Dockerfiles), not just application code, and uses the `code-review`, `security-review`, and `review` skills. See [.claude/agents/code-reviewer.md](.claude/agents/code-reviewer.md).

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
- Breaking plans into **test → implementation → review → documentation** phases
- Running the implement → independent-review → iterate (≤3) loop as a saved **Dynamic Workflow** command, `/orchestrate-loop` in `.claude/workflows/` (Claude Code v2.1.154+), with the **human gate** and **PR** kept as separate stages in the skill (a Dynamic Workflow can't take mid-run input); falls back to an in-session loop where workflows are unavailable
- Delegating backend/frontend implementation and test work to general-purpose agents that follow the relevant module `CLAUDE.md` ([backend/CLAUDE.md](backend/CLAUDE.md), [frontend/CLAUDE.md](frontend/CLAUDE.md))
- Delegating review to `code-reviewer`, refactors to `refactor`, and docs to `documentation-writer`
- Reporting progress and stopping at the human gate before any PR is opened

See [.claude/skills/orchestrate/SKILL.md](.claude/skills/orchestrate/SKILL.md) for detailed orchestration rules, agent mappings, and validation criteria.

## Key Differences from Typical Projects

1. **Learning Mode**: All code requires inline comments explaining high-level "why"
2. **No Abbreviations**: Strict full variable naming policy (enforced in reviews)
3. **Hybrid Structure**: Atomic design for shared UI, flat structure for feature code
4. **Multi-Tenant First**: Every feature must respect tenant isolation from the start


## Agentic QE v3

This project uses **Agentic QE v3** - a Domain-Driven Quality Engineering platform with 13 bounded contexts, ReasoningBank learning, HNSW vector search, and Agent Teams coordination (ADR-064).

---

### CRITICAL POLICIES

#### Integrity Rule (ABSOLUTE)
- NO shortcuts, fake data, or false claims
- ALWAYS implement properly, verify before claiming success
- ALWAYS use real database queries for integration tests
- ALWAYS run actual tests, not assume they pass

**We value the quality we deliver to our users.**

#### Test Execution
- NEVER run `npm test` without `--run` flag (watch mode risk)
- Use: `npm test -- --run`, `npm run test:unit`, `npm run test:integration` when available

#### Data Protection
- NEVER run `rm -f` on `.agentic-qe/` or `*.db` files without confirmation
- ALWAYS backup before database operations

#### Git Operations
- NEVER auto-commit/push without explicit user request
- ALWAYS wait for user confirmation before git operations

---

### Quick Reference

```bash
# Run tests
npm test -- --run

# Check quality
aqe quality assess

# Generate tests
aqe test generate <file>

# Coverage analysis
aqe coverage <path>
```

### Using AQE MCP Tools

AQE exposes tools via MCP with the `mcp__agentic-qe__` prefix. You MUST call `fleet_init` before any other tool.

#### 1. Initialize the Fleet (required first step)

```typescript
mcp__agentic-qe__fleet_init({
  topology: "hierarchical",
  maxAgents: 15,
  memoryBackend: "hybrid"
})
```

#### 2. Generate Tests

```typescript
mcp__agentic-qe__test_generate_enhanced({
  targetPath: "src/services/auth.ts",
  framework: "vitest",
  strategy: "boundary-value"
})
```

#### 3. Analyze Coverage

```typescript
mcp__agentic-qe__coverage_analyze_sublinear({
  paths: ["src/"],
  threshold: 80
})
```

#### 4. Assess Quality

```typescript
mcp__agentic-qe__quality_assess({
  scope: "full",
  includeMetrics: true
})
```

#### 5. Store and Query Patterns (with learning persistence)

```typescript
// Store a learned pattern
mcp__agentic-qe__memory_store({
  key: "patterns/coverage-gap/{timestamp}",
  namespace: "learning",
  value: {
    pattern: "...",
    confidence: 0.95,
    type: "coverage-gap",
    metadata: { /* domain-specific */ }
  },
  persist: true
})

// Query stored patterns
mcp__agentic-qe__memory_query({
  pattern: "patterns/*",
  namespace: "learning",
  limit: 10
})
```

#### 6. Orchestrate Multi-Agent Tasks

```typescript
mcp__agentic-qe__task_orchestrate({
  task: "Full quality assessment of auth module",
  domains: ["test-generation", "coverage-analysis", "security-compliance"],
  parallel: true
})
```

### MCP Tool Reference

| Tool | Description |
|------|-------------|
| `fleet_init` | Initialize QE fleet (MUST call first) |
| `fleet_status` | Get fleet health and agent status |
| `agent_spawn` | Spawn specialized QE agent |
| `test_generate_enhanced` | AI-powered test generation |
| `test_execute_parallel` | Parallel test execution with retry |
| `task_orchestrate` | Orchestrate multi-agent QE tasks |
| `coverage_analyze_sublinear` | O(log n) coverage analysis |
| `quality_assess` | Quality gate evaluation |
| `memory_store` | Store patterns with namespace + persist |
| `memory_query` | Query patterns by namespace/pattern |
| `security_scan_comprehensive` | SAST/DAST scanning |

### Configuration

- **Enabled Domains**: test-generation, test-execution, coverage-analysis, quality-assessment, defect-intelligence, requirements-validation (+6 more)
- **Learning**: Enabled (transformer embeddings)
- **Max Concurrent Agents**: 15
- **Background Workers**: pattern-consolidator, routing-accuracy-monitor, coverage-gap-scanner, flaky-test-detector

### V3 QE Agents

QE agents are in `.claude/agents/v3/`. Use with Task tool:

```javascript
Task({ prompt: "Generate tests", subagent_type: "qe-test-architect", run_in_background: true })
Task({ prompt: "Find coverage gaps", subagent_type: "qe-coverage-specialist", run_in_background: true })
Task({ prompt: "Security audit", subagent_type: "qe-security-scanner", run_in_background: true })
```

### Data Storage

- **Memory Backend**: `.agentic-qe/memory.db` (SQLite)
- **Configuration**: `.agentic-qe/config.yaml`

---
*Generated by AQE v3 init - 2026-06-10T11:35:52.069Z*
