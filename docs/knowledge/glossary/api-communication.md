---
documentation_status: New
overview: Covers REST API communication including HTTP methods, status codes, request headers, and error handling patterns. Explains how to implement a centralized API client with authentication and credentials handling.
tags:
  - rest-api
  - http
  - fetch
  - typescript
  - api
---

# API Communication

**REST API**: Architecture style where each URL represents a resource and HTTP methods (GET/POST/PUT/DELETE) represent actions. Example: `POST /auth/login`, `GET /transactions`

**API Client (apiFetch)**: Centralized function for all API calls. Handles auth headers, base URL, JSON parsing, error handling. Implementation: [apiClient.ts](../frontend/src/lib/apiClient.ts)

**Request Headers**: Metadata sent with HTTP requests. We send:
- `Content-Type: application/json`: Tells server we're sending JSON
- `Authorization: Bearer <token>`: Proves user is authenticated

**credentials: 'include'**: Fetch API option that tells browser to include cookies in cross-origin requests. Required when using HttpOnly cookies for authentication. Without this, the browser won't send cookies to different origins (e.g., from `localhost:5173` frontend to `localhost:8000` backend). Set in `apiFetch` function.

**HTTP Status Codes**:
- `200-299`: Success
- `400`: Bad request (validation error)
- `401`: Unauthorized (not logged in or token expired)
- `403`: Forbidden (logged in but don't have permission)
- `404`: Not found
- `500`: Server error

**API Error Handling**: Pattern for handling errors from API:
1. Catch errors in mutation/query
2. Show user-friendly message
3. Log actual error for debugging
4. Handle 401 by logging out user
