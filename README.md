# Pocket Family - Multi-Tenant Personal Finance SaaS

A collaborative personal finance platform that enables individuals and families to track expenses, manage budgets, and analyze financial data together. Built as a learning project with comprehensive inline documentation and modern full-stack architecture.

## Key Features

- **Multi-Tenant Architecture**: Secure family/group isolation with role-based access control
- **Real-Time Collaboration**: Multiple users can manage shared finances within the same tenant
- **Comprehensive Tracking**: Accounts, categories, transactions, and budgets
- **Hierarchical Categories**: Organize expenses and income with nested category structures
- **JWT Authentication**: Secure access with refresh token rotation
- **Responsive UI**: Modern Material-UI interface optimized for desktop and mobile
- **Background Processing**: Celery workers for CSV imports and recurring transactions
- **Database Migrations**: Version-controlled schema changes with Alembic

## Tech Stack

### Backend
- **FastAPI** - High-performance async Python web framework
- **PostgreSQL** - Robust relational database with multi-tenant support
- **SQLModel** - Type-safe ORM combining SQLAlchemy and Pydantic
- **Celery + Redis** - Distributed task queue for background jobs
- **Alembic** - Database migration management
- **pytest** - Comprehensive test suite with TestClient

### Frontend
- **React 18** - Modern component-based UI library
- **TypeScript** - Type-safe JavaScript for robust development
- **Material-UI (MUI)** - Production-ready component library
- **TanStack React Query** - Powerful server state management
- **React Router v6** - Client-side routing
- **AG Grid Community** - High-performance data tables
- **React Hook Form** - Efficient form validation
- **Vitest + React Testing Library** - Fast unit and integration tests
- **Storybook** - Component development and documentation

### DevOps
- **Docker + Docker Compose** - Containerized development environment
- **Vite** - Lightning-fast frontend build tool

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Git installed

### Run with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/BorisStricky/pocket-family.git
cd pocket-family

# Start all services (backend, frontend, database, redis)
docker-compose -f docker-compose.dev.yml up

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Local Development Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
cd api
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Run Tests:**
```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## Project Structure

```
pocket-family/
├── backend/              # FastAPI backend application
│   ├── api/
│   │   ├── app/
│   │   │   ├── routers/    # API endpoint routers
│   │   │   ├── models.py   # SQLModel database models
│   │   │   ├── schemas.py  # Pydantic request/response schemas
│   │   │   ├── auth.py     # JWT utilities
│   │   │   └── main.py     # FastAPI app entry
│   │   └── alembic/        # Database migrations
│   └── requirements.txt
├── frontend/             # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── features/       # Feature modules (auth, transactions, etc.)
│   │   ├── lib/            # Utilities (API client, JWT helpers)
│   │   └── router/         # React Router configuration
│   └── package.json
├── docs/                 # Comprehensive documentation
│   ├── SystemArchitecture.md
│   ├── openAPI_spec.json
│   ├── glossary.md
│   └── north_star.md
├── .claude/              # AI assistant instructions
│   └── instructions.md
├── .active_context/      # Sprint tracking and roadmap
├── docker-compose.dev.yml
└── CLAUDE.md             # Project overview and coding standards
```

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[CLAUDE.md](CLAUDE.md)** - Getting started guide, common commands, architecture overview
- **[docs/SystemArchitecture.md](docs/SystemArchitecture.md)** - Detailed system design and patterns
- **[docs/openAPI_spec.json](docs/openAPI_spec.json)** - Complete API specification (OpenAPI 3.0)
- **[docs/glossary.md](docs/glossary.md)** - Domain terminology and concepts
- **[docs/north_star.md](docs/north_star.md)** - Product vision and invariants
- **[.claude/instructions.md](.claude/instructions.md)** - Development workflow and coding standards

## Architecture Highlights

### Multi-Tenant Design
- Single database with shared schema using `tenant_id` column filtering
- Automatic tenant isolation via dependency injection (`get_current_user_context`)
- Users can belong to multiple tenants with different roles (owner, member, viewer)

### Authentication Flow
- JWT access tokens (short-lived, 15 minutes) stored in localStorage
- Refresh tokens (long-lived, 30 days) stored as HttpOnly cookies
- Automatic token refresh via centralized API client
- Tenant switching via dedicated endpoint that issues new tokens

### Frontend State Management
- **Server State**: TanStack React Query for all API data with automatic caching
- **Auth State**: React Context for user authentication and tenant management
- **UI State**: Local React state for forms, modals, and toggles

## Development Commands

See [CLAUDE.md](CLAUDE.md) for comprehensive command reference including:
- Database migrations with Alembic
- Running tests with coverage
- Docker commands for multi-service orchestration
- Storybook for component development

## Project Philosophy

This is a **learning project** designed to demonstrate:
- Modern full-stack development practices
- Multi-tenant SaaS architecture patterns
- Type-safe development with TypeScript and Pydantic
- Comprehensive testing strategies
- Clean code with detailed inline comments explaining "why" not just "what"

All code follows strict naming conventions (no abbreviations) and includes explanatory comments to aid understanding.

## Contributing

This is a personal learning project, but feedback and suggestions are welcome! Please feel free to:
- Open issues for bugs or feature requests
- Submit pull requests with improvements
- Share feedback on architecture decisions

## License

MIT License - See LICENSE file for details

## Project Status

🚧 **Active Development** - This project is under active development as a learning exercise in building production-quality SaaS applications.

Current focus areas:
- Frontend component library expansion
- Advanced data visualization features
- Comprehensive test coverage
- Performance optimization

---

Built with ❤️ as a learning project to master modern full-stack development
