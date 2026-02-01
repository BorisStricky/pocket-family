---
documentation_status: New
overview: Covers authentication and security concepts including JWT tokens, access/refresh token patterns, HttpOnly cookies, localStorage, and CORS. Explains how to securely implement authentication in web applications and protect against common vulnerabilities like XSS attacks.
tags:
  - jwt
  - security
  - authentication
  - cookies
  - cors
  - web-security
---

# Authentication & Security

**JWT (JSON Web Token)**: Encoded string containing user information and expiration time. Backend creates JWT on login/signup, frontend stores it and sends with API requests. Structure: `header.payload.signature`

**JWT Payload**: The middle part of JWT containing claims (data) like user ID, tenant ID, roles, expiration. We decode this client-side to get user info. Example claims:
- `sub`: user ID
- `tenant_id`: family/tenant ID
- `roles`: array of user roles
- `exp`: expiration timestamp

**Access Token**: Short-lived JWT used to authenticate API requests. Sent in `Authorization: Bearer <token>` header. Stored in localStorage.

**Refresh Token**: Long-lived token used to get new access tokens when they expire. Stored as HttpOnly cookie for security. More secure pattern than storing long-lived access tokens in localStorage.

**HttpOnly Cookie**: Browser cookie with `httponly` flag that prevents JavaScript from accessing it via `document.cookie`. Protects against XSS attacks where malicious scripts try to steal tokens. Browser automatically sends HttpOnly cookies with requests to the same domain. We use this for refresh tokens. Set by backend with `response.set_cookie(httponly=True)`, requires `credentials: 'include'` in frontend fetch.

**localStorage**: Browser API for storing key-value pairs that persist across page reloads. We use it to store the access token (`pf_access_token`). Refresh token is NOT stored here (stored as HttpOnly cookie instead for security).

**Token Decoding (Client-Side)**: Extracting payload from JWT using base64 decoding. NOT verification (which requires secret key on backend). We decode to read user ID, tenant ID, roles. Implementation: [jwtUtils.ts](../frontend/src/lib/jwtUtils.ts)

**CORS (Cross-Origin Resource Sharing)**: Browser security feature that blocks requests from one origin (e.g., `localhost:5173`) to another (e.g., `localhost:8000`) unless the server explicitly allows it. Fixed by adding CORS middleware to FastAPI backend. Configuration: [backend/api/app/main.py](../backend/api/app/main.py)

**CORS Preflight Request**: Automatic OPTIONS request sent by browser before actual POST/PUT/DELETE requests to check if CORS is allowed. Backend must respond with appropriate headers (`Access-Control-Allow-Origin`, etc.).
