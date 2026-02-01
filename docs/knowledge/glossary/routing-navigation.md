---
documentation_status: New
overview: Covers React Router v6 concepts including BrowserRouter, nested routes, protected routes, and navigation patterns. Explains how client-side routing works and how to implement authentication-aware navigation in React applications.
tags:
  - react
  - react-router
  - typescript
  - navigation
---

# Routing & Navigation

**React Router**: Library for client-side routing in React apps. Allows navigation between pages without full page reload. We use v6 with nested routes. Main config: [router/index.jsx](../frontend/src/router/index.jsx)

**BrowserRouter**: Router component that uses HTML5 history API for clean URLs (no `#` hash). Wraps entire app to enable routing.

**Routes & Route**: Components that define which component to render for each URL path. Example: `<Route path="/login" element={<LoginPage />} />`

**Nested Routes**: Routes defined inside other routes. We use this for the app shell - `/app/*` wraps all authenticated pages with sidebar/navigation. Child routes like `/app/transactions` render inside the parent's `<Outlet />`.

**Navigate Component**: Programmatic redirect in React Router. Example: `<Navigate to="/login" replace />` redirects user to login page.

**useNavigate Hook**: Hook that returns a function to programmatically navigate. Example: `navigate('/app')` after successful login.

**Protected Routes**: Custom wrapper component that checks if user is authenticated before rendering. If not authenticated, redirects to login. Implementation: [ProtectedRoute.tsx](../frontend/src/components/ProtectedRoute.tsx)
