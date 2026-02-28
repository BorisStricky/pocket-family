// src/features/family/hooks/useCurrentRole.ts
// Returns the current user's role in the active family context.
//
// The role is embedded in the JWT access token under the "roles" claim and is
// decoded into the User object at login/refresh time. It reflects the membership
// role for the tenant that is currently scoped in the token (i.e. the active family).
//
// Usage:
//   const currentRole = useCurrentRole();
//   const isViewer = currentRole === 'viewer';

import { useAuth } from '@/features/auth/hooks/useAuth';
import type { MembershipRole } from '@/types/family';

/**
 * Returns the authenticated user's membership role in the currently active family.
 * Returns null when no user is authenticated or when the token has no roles claim.
 */
export function useCurrentRole(): MembershipRole | null {
  const { user } = useAuth();
  // The JWT "roles" claim is a single-element array containing the user's role
  // for the tenant currently scoped in the token (e.g. ["owner"], ["member"], ["viewer"])
  return (user?.roles?.[0] as MembershipRole) ?? null;
}
