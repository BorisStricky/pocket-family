// src/lib/constants.ts
// App-wide constants for storage keys, API endpoints, etc.

/**
 * LocalStorage keys for token storage
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'pf_access_token',
  REFRESH_TOKEN: 'pf_refresh_token',
} as const;

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
} as const;
