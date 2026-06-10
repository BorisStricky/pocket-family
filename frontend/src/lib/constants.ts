// src/lib/constants.ts
// App-wide constants for storage keys, API endpoints, etc.

/**
 * LocalStorage keys for token storage
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'pf_access_token',
  REFRESH_TOKEN: 'pf_refresh_token',
  // Preferred UI language code ("en" or "pt-BR"). Read synchronously at i18n
  // init so the chosen language applies instantly on load, before any network
  // call to /users/me completes.
  LANGUAGE: 'pf_language',
} as const;

/**
 * Base URL for all API requests.
 * Reads from VITE_API_URL (set to "/api" in dev and production via same-origin proxy).
 * Falls back to localhost:8000 for local development without Docker.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * True when this build is the public demo instance. Read at build time from
 * VITE_DEMO_MODE so the Docker image can be reused — flip this and the
 * frontend disables signup, shows the disclaimer banner, and surfaces the
 * "Try the Demo" auto-login button.
 */
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * Credentials of the shared demo account. Kept here so the login page's
 * one-click "Try the Demo" button can auto-fill them. Backend seeds the
 * matching user on startup when DEMO_MODE=1.
 */
export const DEMO_CREDENTIALS = {
  EMAIL: 'demo@pocket-family.com',
  PASSWORD: 'demo123',
} as const;

/**
 * LocalStorage key that records whether the user has acknowledged the
 * demo disclaimer modal. Stored as an ISO timestamp.
 */
export const DEMO_ACK_STORAGE_KEY = 'pf_demo_acknowledged';

/**
 * API endpoint paths (relative to VITE_API_URL)
 */
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',

  // Tenants/Families
  TENANTS: '/tenants',
  TENANT_BY_ID: '/tenants/:id',
  TENANT_SWITCH: '/tenants/:id/switch',

  // Tenant members (family membership management)
  TENANT_MEMBERS: '/tenants/:tenantId/members',
  TENANT_MEMBER_BY_ID: '/tenants/:tenantId/members/:membershipId',

  // Categories
  CATEGORIES: '/categories',
  CATEGORY_BY_ID: '/categories/:id',

  // Current user profile / preferences
  USERS_ME: '/users/me',

  // Budgets
  BUDGETS: '/budgets',
  BUDGET_BY_ID: '/budgets/:id',

  // Health check
  PING: '/ping',
} as const;

/**
 * Layout dimension constants used across AppShell, SideNav, and TopNav
 * to maintain consistent spacing when the side navigation is open or closed
 */
export const LAYOUT = {
  DRAWER_WIDTH: 240,
} as const;

/**
 * Route paths for navigation
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  PASSWORD_RESET: '/password-reset',

  // Protected routes
  APP: '/app',
  DASHBOARD: '/app',
  TRANSACTIONS: '/app/transactions',
  ACCOUNTS: '/app/accounts',
  BUDGETS: '/app/budgets',
  REPORTS: '/app/reports',
  SETTINGS: '/app/settings',
  FAMILIES: '/app/families',
  ACCEPT_INVITE: '/accept-invite',
  LEGAL: '/legal',
} as const;
