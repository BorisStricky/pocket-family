// src/test/mocks/factories/family.ts
// Factory functions for creating mock Family/Tenant objects in tests

import type { TenantRead } from '@/types';

/**
 * Options for creating mock family/tenant objects
 */
interface CreateMockFamilyOptions {
  id?: string;
  name?: string;
  createdAt?: string;
}

/**
 * Create a mock TenantRead object with customizable properties
 * Matches the TenantRead interface from src/types/family.ts
 *
 * @example
 * const family = createMockFamily({ name: 'Smith Family' });
 * const families = [createMockFamily({ id: '1' }), createMockFamily({ id: '2' })];
 */
export function createMockFamily(options: CreateMockFamilyOptions = {}): TenantRead {
  const {
    id = 'tenant-uuid-456',
    name = 'Test Family',
    createdAt = new Date().toISOString(),
  } = options;

  return {
    id,
    name,
    created_at: createdAt,
  };
}

/**
 * Create a list of mock families for testing list views
 *
 * @example
 * const families = createMockFamilyList(3);
 */
export function createMockFamilyList(count: number = 2): TenantRead[] {
  return Array.from({ length: count }, (_, index) =>
    createMockFamily({
      id: `tenant-uuid-${index + 1}`,
      name: `Family ${index + 1}`,
    })
  );
}
