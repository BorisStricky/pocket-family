---
title: "Network Architecture: Proxy, CORS & Cookie Strategy"
date: 2026-02-26
tags:
  - network
  - cors
  - cookies
  - authentication
  - proxy
  - devops
---

# Network Architecture: Proxy, CORS & Cookie Strategy

## Overview

This document explains how the frontend communicates with the backend API, why a reverse proxy is used instead of direct cross-origin requests, and how that decision protects the [[../glossary/authentication-security|HttpOnly refresh token cookie]] that keeps users logged in.

---

## The Problem: Cross-Origin Cookies and [[../glossary/authentication-security|SameSite]]

### What is SameSite?

`SameSite` is a browser cookie attribute that controls when a cookie is sent with a request. The backend sets the refresh token cookie like this:

```python
response.set_cookie(
    key="refresh_token",
    value=raw_refresh_token,
    httponly=True,       # JavaScript cannot read this cookie
    secure=False,        # OK for HTTP in development
    samesite="lax",      # The attribute that caused the bug
)
```

`SameSite=lax` means:
- **Same-site requests** (same domain/IP) → cookie is always sent ✅
- **Cross-site top-level navigation** (clicking a link) → cookie is sent (GET only) ✅
- **Cross-site subrequests** (JavaScript `fetch`, `XMLHttpRequest`) → cookie is **NOT sent** ❌

### Why This Caused the Logout Bug

The frontend and backend run on different origins:

| Environment | Frontend | Backend | Same-site? |
|-------------|----------|---------|------------|
| Dev (local) | `localhost:5173` | `192.168.1.101:8000` | ❌ Different host |
| Dev (LAN) | `192.168.1.101:5173` | `192.168.1.101:8000` | ✅ Same host |
| Production | `192.168.1.101:3000` | `192.168.1.101:8000` | ✅ Same host, but direct calls were cross-origin |

When a user accessed the app from `localhost`, the browser saw every API call as a **cross-site subrequest**. After 15 minutes the access token expired. The frontend called `POST /auth/refresh` with [[../glossary/api-communication|`credentials: 'include'`]], but the browser silently dropped the `refresh_token` cookie because `SameSite=lax` forbids it. The backend received a request with no cookie and returned `401 "Refresh token missing"`, logging the user out.

---

## The Solution: Same-Origin Reverse Proxy

Instead of the browser calling the backend directly (cross-origin), all API requests are routed through the **same server that serves the frontend**. From the browser's perspective, every request is same-origin — the `refresh_token` cookie is always included.

```
BEFORE (cross-origin — cookie blocked):

  Browser (localhost:5173)
       │
       ├─ GET  /app/dashboard     → localhost:5173  ✅
       │
       └─ POST /auth/refresh  ──► 192.168.1.101:8000  ❌ cookie dropped

AFTER (same-origin via proxy — cookie always sent):

  Browser (localhost:5173)
       │
       ├─ GET  /app/dashboard     → localhost:5173  ✅
       │
       └─ POST /api/auth/refresh → localhost:5173  ✅ cookie included
                                        │
                               Proxy forwards to
                                        │
                               192.168.1.101:8000
```

The `/api` prefix is stripped by the proxy before the request reaches the backend, so the backend routes are unchanged.

---

## Implementation

### Development: [[../glossary/frontend-build-configuration|Vite Proxy]]

[[../glossary/frontend-build-configuration|Vite]]'s built-in dev server can proxy requests to another host. Added in [vite.config.ts](../../frontend/vite.config.ts):

```typescript
server: {
  proxy: {
    '/api': {
      target: process.env.BACKEND_URL || 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
},
```

- All requests to `localhost:5173/api/*` are forwarded to `localhost:8000/*`
- The `/api` prefix is stripped (`/api/auth/login` → `/auth/login`)
- `BACKEND_URL` environment variable overrides the default if the backend runs elsewhere

### Production: nginx Proxy

The production frontend is served by nginx inside Docker. Added to [nginx.conf](../../frontend/nginx.conf):

```nginx
location /api/ {
    proxy_pass http://backend:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Cookie $http_cookie;
}
```

- `http://backend:8000` resolves via Docker's internal DNS on the `pfin-net` network
- The trailing slash on `proxy_pass` causes nginx to strip the `/api` prefix before forwarding
- `Cookie` header is explicitly forwarded (required for the HttpOnly cookie to reach FastAPI)

### Frontend: API Base URL

Both the dev server and the build use `VITE_API_URL` as the base for all API calls (via `apiFetch()` in [apiClient.ts](../../frontend/src/lib/apiClient.ts)).

Changed from the direct backend URL to the `/api` path prefix:

| Config file | Old value | New value |
|-------------|-----------|-----------|
| `.env.development` | `http://192.168.1.101:8000` | `/api` |
| `docker-compose.yaml` (build arg) | `http://192.168.1.101:8000` | `/api` |
| `docker-compose.dev.yml` (env) | `http://192.168.1.101:8000` | `/api` |

With `VITE_API_URL=/api`, a call like `apiFetch('/auth/login')` constructs the URL `/api/auth/login` — a relative, same-origin request that the proxy intercepts.

---

## CORS: Still Configured, Now Optional for the Web Frontend

CORS (Cross-Origin Resource Sharing) is a browser mechanism that allows servers to explicitly permit cross-origin requests. It is configured in the backend via FastAPI's `CORSMiddleware` and controlled by the `CORS_ORIGINS` environment variable.

With the proxy in place, the **browser never makes a cross-origin request** to the backend. CORS headers are therefore irrelevant for the web frontend — the browser has no reason to enforce them.

However, CORS is kept configured for:
- **Direct API access**: Postman, curl, mobile apps, or other clients that call the backend directly
- **Future clients**: Any client that is not routed through the proxy
- **Correctness**: It's harmless and good practice to keep it configured

If the backend `CORS_ORIGINS` list does not include the frontend's origin, direct-API clients will still work from the backend's side (the backend doesn't enforce CORS — browsers do), but browser-based clients that bypass the proxy will have their requests blocked by the browser.

---

## Security Properties

### HttpOnly Cookie Security is Preserved

The entire motivation for the proxy is to **keep the refresh token in an HttpOnly cookie** rather than moving it to localStorage. Here is why that matters:

| Storage | XSS accessible? | Lifetime | Risk if stolen |
|---------|-----------------|----------|----------------|
| `localStorage` (access token) | ✅ Yes | 15 minutes | Low — expires quickly |
| `localStorage` (refresh token) | ✅ Yes | 30 days | **High** — full session takeover |
| HttpOnly cookie (refresh token) | ❌ No | 30 days | Safe from XSS |

Moving the refresh token to localStorage would have made it readable by any JavaScript running on the page (e.g., from a compromised third-party script). The proxy approach solves the cookie delivery problem without sacrificing this protection.

### Port 8000 Can Be Restricted in Production

Because all browser traffic now flows through nginx on port 3000, the backend port 8000 does not need to be publicly exposed. It only needs to be reachable from within the Docker network (`pfin-net`). Removing the `ports: - "8000:8000"` entry from `docker-compose.yaml` would close this attack surface entirely.

---

## Flow Diagram: Token Lifecycle After This Change

```
1. LOGIN
   Browser → POST /api/auth/login
                 │
            nginx/Vite proxy → POST /auth/login → FastAPI
                                                       │
                                      Response: { access_token }
                                      Set-Cookie: refresh_token (HttpOnly)
                 │
           Browser stores access_token in localStorage
           Browser stores refresh_token cookie (auto-managed)

2. AUTHENTICATED REQUEST (token still valid)
   Browser → GET /api/transactions
                 │
            nginx/Vite proxy → GET /transactions
                                Authorization: Bearer <access_token>
                                → FastAPI returns data

3. TOKEN REFRESH (access token expired after 15 min)
   apiFetch receives 401 → calls refreshAccessToken()
   Browser → POST /api/auth/refresh
                 │  Cookie: refresh_token=<token>  ← sent because same-origin ✅
            nginx/Vite proxy → POST /auth/refresh → FastAPI
                                                         │
                                      Response: { access_token }  (new token)
                                      Set-Cookie: refresh_token   (rotated)
                 │
           Browser updates access_token in localStorage
           Original request is retried with new token
```

---

## Related Concepts

> [!info] Related Concepts
> - [[../glossary/authentication-security|Authentication & Security]] — JWT tokens, HttpOnly cookies, SameSite cookie attributes, CORS
> - [[../glossary/api-communication|API Communication]] — fetch credentials, Authorization headers, error handling
> - [[../glossary/frontend-build-configuration|Frontend Build & Configuration]] — Vite proxy, vite.config.ts, environment variables
> - [[../glossary/development-workflow|Development Workflow]] — Docker Compose networking, multi-container setup

---

## Related Documentation

- [apiClient.ts](../../frontend/src/lib/apiClient.ts) — Centralized fetch wrapper with token injection and refresh logic
- [AuthContext.tsx](../../frontend/src/features/auth/context/AuthContext.tsx) — Silent refresh on app mount
- [auth.py router](../../backend/api/app/routers/auth.py) — `/auth/refresh` endpoint implementation
- [vite.config.ts](../../frontend/vite.config.ts) — Dev proxy configuration
- [nginx.conf](../../frontend/nginx.conf) — Production proxy configuration
