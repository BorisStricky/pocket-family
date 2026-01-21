// src/test/mocks/factories/user.ts
// Factory functions for creating mock User objects in tests

import type { User } from '@/types';

/**
 * Options for creating mock user objects
 */
interface CreateMockUserOptions {
  id?: string;
  email?: string;
  name?: string;
  tenantId?: string | null;
  roles?: string[];
}

/**
 * Create a mock User object with customizable properties
 * Matches the User interface from src/types/index.ts
 *
 * @example
 * const user = createMockUser({ email: 'test@example.com' });
 * const owner = createMockUser({ roles: ['owner'] });
 */
export function createMockUser(options: CreateMockUserOptions = {}): User {
  const {
    id = 'user-uuid-123',
    email = 'test@example.com',
    name = 'Test User',
    tenantId = 'tenant-uuid-456',
    roles = ['member'],
  } = options;

  return {
    id,
    email,
    name,
    tenant_id: tenantId,
    roles,
  };
}

/**
 * Create a mock user who is an owner of their tenant
 */
export function createMockOwner(tenantId: string = 'tenant-uuid-456'): User {
  return createMockUser({
    tenantId,
    roles: ['owner'],
  });
}

/**
 * Create a mock user without a tenant (new user scenario)
 */
export function createMockUserWithoutTenant(): User {
  return createMockUser({
    tenantId: null,
    roles: [],
  });
}
