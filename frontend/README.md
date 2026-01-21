# Personal Finance - Frontend

Modern web application for personal finance management built with React, TypeScript, and Tailwind CSS.

## Features (Sprint 0)

- **Authentication System**: JWT-based auth with login, signup, and logout
- **Protected Routes**: Route guards for authenticated content
- **Responsive Design**: Mobile-first UI with Tailwind CSS
- **Type Safety**: Full TypeScript coverage
- **Tested**: 80+ automated tests with Vitest
- **Component Library**: Storybook catalog with 13+ components

## Tech Stack

- **Framework**: React 18.3.1
- **Build Tool**: Vite 5.1.4
- **Language**: TypeScript 5.2.2
- **Styling**: Tailwind CSS 3.4.1
- **Routing**: React Router DOM 6.22.0
- **State Management**: React Query 5.28.0
- **UI Components**: Material-UI 5.15.0 (selective)
- **Icons**: Lucide React
- **Testing**: Vitest 1.6.1 + Testing Library
- **Documentation**: Storybook

## Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Backend API**: Running on `http://localhost:8000` (see backend README)

## Getting Started

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the `frontend/` directory:

```bash
# API Base URL (backend server)
VITE_API_URL=http://localhost:8000
```

**Environment Variables**:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000` | Yes |

**Notes**:
- Variables must be prefixed with `VITE_` to be exposed to the client
- `.env.local` is gitignored (never commit this file)
- For production, set `VITE_API_URL` to your production API URL

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at **http://localhost:5173**

**Hot Module Replacement (HMR)**: Changes to React components will update instantly without page refresh.

### 4. Verify Backend Connection

Ensure the backend API is running:

```bash
# In backend directory
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Test the connection:
- Navigate to http://localhost:5173
- Click "Sign Up" and create an account
- If successful, you're connected to the backend

## Available Scripts

### Development

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Production build (outputs to dist/)
npm run preview      # Preview production build locally
```

### Testing

```bash
npm run test              # Run tests in watch mode
npm run test:run          # Run tests once (CI mode)
npm run test:ui           # Open Vitest UI (visual test runner)
npm run test:coverage     # Generate coverage report
```

### Storybook (Component Catalog)

```bash
npm run storybook         # Start Storybook (http://localhost:6006)
npm run build-storybook   # Build static Storybook for deployment
```

## Project Structure

```
frontend/
├── public/                 # Static assets (favicon, logos)
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── atoms/          # Basic components (Button, Input, etc.)
│   │   ├── molecules/      # Composite components
│   │   ├── organisms/      # Complex feature components
│   │   └── modals/         # Modal dialogs
│   ├── features/           # Feature-based modules
│   │   └── auth/           # Authentication feature
│   │       ├── api/        # API functions
│   │       ├── components/ # Auth-specific components
│   │       ├── context/    # Auth state management
│   │       └── hooks/      # Custom hooks
│   ├── lib/                # Utilities and helpers
│   ├── pages/              # Top-level page components
│   ├── test/               # Test utilities and setup
│   ├── types/              # TypeScript type definitions
│   └── main.tsx            # Application entry point
├── .storybook/             # Storybook configuration
├── vitest.config.ts        # Vitest test configuration
├── vite.config.ts          # Vite build configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── package.json            # Dependencies and scripts
```

## CORS Configuration

The frontend requires the backend to be configured for CORS (Cross-Origin Resource Sharing) to allow API requests from the Vite dev server.

### Backend CORS Setup (FastAPI)

The backend must include the following CORS middleware:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5173",  # Alternative localhost
        # Add production frontend URL here
    ],
    allow_credentials=True,  # Required for HttpOnly cookies
    allow_methods=["*"],     # Allow all HTTP methods
    allow_headers=["*"],     # Allow all headers
)
```

### Why `allow_credentials=True`?

The authentication system uses **HttpOnly cookies** for security:
- Backend sets cookies via `Set-Cookie` header
- Frontend sends cookies automatically with `credentials: 'include'`
- This prevents XSS attacks (JavaScript cannot access HttpOnly cookies)

### Troubleshooting CORS

**Error**: `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solution**: Verify backend CORS middleware is configured with the correct origin.

**Error**: `The value of the 'Access-Control-Allow-Credentials' header is '' which must be 'true'`

**Solution**: Ensure `allow_credentials=True` in backend CORS config.

## Authentication Flow

### How It Works

1. **Signup/Login**: User submits credentials → Backend returns JWT tokens
2. **Token Storage**: Access token stored in localStorage (`pf_access_token`)
3. **API Requests**: All requests include `Authorization: Bearer <token>` header
4. **Session Restoration**: On page reload, token is read from localStorage and user is restored
5. **Logout**: Clears tokens from localStorage and calls backend `/auth/logout`

### JWT Token Structure

Tokens contain user information in the payload:

```json
{
  "sub": "user-123",           // User ID
  "email": "user@example.com", // Email
  "tenant_id": "tenant-456",   // Tenant/organization ID
  "roles": ["owner"],          // User roles
  "exp": 1234567890            // Expiration timestamp
}
```

The frontend decodes the JWT client-side to extract user info (no backend call needed).

## Docker Build

### Build Docker Image

```bash
# From frontend directory
docker build -t personal-finance-frontend .
```

### Dockerfile

Create a `Dockerfile` in the `frontend/` directory:

```dockerfile
# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Set environment variable for API URL (override at runtime)
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Build app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config (if you have custom config)
# COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Run Docker Container

```bash
docker run -p 8080:80 \
  -e VITE_API_URL=http://your-api-url:8000 \
  personal-finance-frontend
```

Access the app at **http://localhost:8080**

### Docker Compose (Full Stack)

Example `docker-compose.yml` for running frontend + backend:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/pfdb
      - SECRET_KEY=your-secret-key
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "8080:80"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - backend

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=pfdb
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Testing

### Running Tests

```bash
# Watch mode (reruns on file changes)
npm run test

# Run once (for CI/CD)
npm run test:run

# With coverage report
npm run test:coverage
```

### Test Coverage

Current coverage (Sprint 0):
- **80 tests** across 7 test suites
- **90%+ coverage** on critical auth flows
- Test files located in `src/**/*.test.ts(x)`

### Writing Tests

Tests use Vitest + Testing Library:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils';
import { Button } from './Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

See [docs/frontend/sprint_0_summary.md](../../docs/frontend/sprint_0_summary.md) for detailed testing strategy.

## Component Development (Storybook)

### View Component Catalog

```bash
npm run storybook
```

Open **http://localhost:6006** to browse components.

### Creating Stories

Stories are located in `src/stories/*.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/atoms/Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Click me',
  },
};
```

## Deployment

### Building for Production

```bash
npm run build
```

Output will be in `dist/` directory. This contains static files ready to deploy to any web server.

### Deployment Targets

- **Nginx/Apache**: Serve files from `dist/` directory
- **Netlify/Vercel**: Connect GitHub repo, auto-deploy on push
- **AWS S3 + CloudFront**: Upload `dist/` to S3, serve via CDN
- **Docker**: Use provided Dockerfile with nginx

### Environment Variables in Production

Set `VITE_API_URL` before building:

```bash
# Build with production API URL
VITE_API_URL=https://api.production.com npm run build
```

**Important**: Environment variables are **baked into the build**. You must rebuild if the API URL changes.

## Troubleshooting

### Issue: "Cannot connect to backend"

**Symptoms**: Network errors, 404s on API calls

**Solutions**:
1. Verify backend is running on port 8000
2. Check `VITE_API_URL` in `.env.local`
3. Verify CORS is configured in backend
4. Open browser DevTools → Network tab to inspect failed requests

### Issue: "Redirected to /login immediately after signup"

**Symptoms**: User gets logged out after successful signup

**Solutions**:
1. Check browser console for JWT decode errors
2. Verify backend is returning valid JWT tokens
3. Check localStorage (DevTools → Application → Local Storage) for `pf_access_token`

### Issue: Tests failing with "ReferenceError: window is not defined"

**Solution**: Tests are configured with jsdom environment. If you see this error:
1. Check `vitest.config.ts` has `environment: 'jsdom'`
2. Ensure test imports from `@/test/utils` (not `@testing-library/react` directly)

### Issue: Build fails with TypeScript errors

**Solutions**:
1. Run `npm run build` to see full error output
2. Fix type errors (common: missing return types, any usage)
3. Check `tsconfig.json` for correct configuration

## Code Quality

### TypeScript

- **Strict Mode**: Enabled in `tsconfig.json`
- **Path Aliases**: `@/` maps to `src/`
- **No Implicit Any**: All variables must have explicit types

### Linting (Future)

ESLint configuration not yet added. Recommended setup:

```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### Formatting (Future)

Prettier configuration not yet added. Recommended setup:

```bash
npm install -D prettier
```

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes with tests
3. Run tests: `npm run test:run`
4. Build: `npm run build`
5. Commit: `git commit -m "feat: your feature"`
6. Push and create PR

### Code Style

- Use functional components (no class components)
- Custom hooks for reusable logic
- Feature-based file organization
- Test critical user flows

## Resources

- **Vite Docs**: https://vitejs.dev
- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com
- **React Query**: https://tanstack.com/query
- **Vitest**: https://vitest.dev
- **Testing Library**: https://testing-library.com

## License

[Your License Here]

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Contact the development team
- See [docs/glossary.md](../../docs/glossary.md) for term definitions

---

**Status**: Sprint 0 Complete ✅
**Version**: 0.1.0
**Last Updated**: [Current Date]
