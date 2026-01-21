// src/types/family.ts
// Type definitions for family/tenant domain models

/**
 * TenantRead schema - response from GET /tenants endpoints
 * Represents a family/group in the multi-tenant system
 */
export interface TenantRead {
  id: string; // UUID
  name: string; // Family/tenant display name
  created_at: string; // ISO datetime string
}
