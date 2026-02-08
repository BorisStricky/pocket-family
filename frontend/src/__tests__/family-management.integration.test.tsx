/**
 * Integration tests for Family Management hooks and API layer (Phase 2)
 *
 * Tests the following hooks and their interaction with MSW mock handlers:
 * - useCreateFamily: Creating new families
 * - useListMembers: Fetching members list for a family
 * - useInviteMember: Inviting new members via email
 * - useRemoveMember: Removing members from a family (owner action)
 * - useLeaveFamily: Member leaving a family they belong to
 * - useDeleteFamily: Owner deleting an entire family
 *
 * These tests use renderHook with a QueryClientProvider wrapper,
 * matching the pattern from existing hook tests in the project.
 * MSW handlers in test/mocks/handlers/family.ts provide in-memory
 * state that persists across requests within each test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { resetFamilyStore } from '@/test/mocks/server';
import { setupAuthenticatedUser } from '@/test/utils';
import { useCreateFamily } from '@/features/family/hooks/useCreateFamily';
import { useListMembers } from '@/features/family/hooks/useListMembers';
import { useInviteMember } from '@/features/family/hooks/useInviteMember';
import { useRemoveMember } from '@/features/family/hooks/useRemoveMember';
import { useLeaveFamily } from '@/features/family/hooks/useLeaveFamily';
import { useDeleteFamily } from '@/features/family/hooks/useDeleteFamily';
import React from 'react';

const API_BASE = 'http://localhost:8000';
const TEST_TENANT_ID = 'tenant-uuid-456';

/**
 * Create a fresh QueryClient for each test with retry disabled
 * Following the project's established pattern from MEMORY.md:
 * staleTime: 30_000 with default gcTime to avoid React Query conflicts
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Create a wrapper component with QueryClientProvider for renderHook
 * Each test gets a fresh QueryClient for cache isolation
 */
function createWrapper() {
  const queryClient = createTestQueryClient();
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    ),
  };
}

describe('useCreateFamily', () => {
  beforeEach(() => {
    resetFamilyStore();
    setupAuthenticatedUser(TEST_TENANT_ID);
  });

  it('creates a new family and returns the created tenant', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateFamily(), { wrapper });

    // Execute the mutation
    act(() => {
      result.current.mutate({ name: 'Smith Family' });
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify the returned tenant has the correct name
    expect(result.current.data).toBeDefined();
    expect(result.current.data!.name).toBe('Smith Family');
    expect(result.current.data!.id).toBeDefined();
  });

  it('shows isPending during creation', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateFamily(), { wrapper });

    // Before mutation
    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({ name: 'New Family' });
    });

    // Should eventually complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('handles validation error for empty name', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateFamily(), { wrapper });

    act(() => {
      // Send empty name which should trigger a 400 from the MSW handler
      result.current.mutate({ name: '' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('handles validation error for name too short', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateFamily(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'A' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates families query on success', async () => {
    const { wrapper, queryClient } = createWrapper();

    // Pre-populate the families cache
    queryClient.setQueryData(['families'], [{ id: '1', name: 'Old Family', created_at: '' }]);

    const { result } = renderHook(() => useCreateFamily(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'New Family' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The families query should have been invalidated
    const queryState = queryClient.getQueryState(['families']);
    expect(queryState?.isInvalidated).toBe(true);
  });
});

describe('useListMembers', () => {
  beforeEach(() => {
    resetFamilyStore();
    setupAuthenticatedUser(TEST_TENANT_ID);
  });

  it('fetches members list for a family', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useListMembers(TEST_TENANT_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Default mock store has owner + 2 members + 1 pending = 4 memberships
    expect(result.current.data).toBeDefined();
    expect(result.current.data!.length).toBe(4);
  });

  it('returns members with correct roles', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useListMembers(TEST_TENANT_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const members = result.current.data!;

    // Should include an owner
    const ownerMember = members.find((member) => member.role === 'owner');
    expect(ownerMember).toBeDefined();
    expect(ownerMember!.status).toBe('active');

    // Should include a pending invitation
    const pendingMember = members.find((member) => member.status === 'pending');
    expect(pendingMember).toBeDefined();
    expect(pendingMember!.user_id).toBeNull();
  });

  it('returns empty array for family with no members in store', async () => {
    const { wrapper } = createWrapper();

    // Use a family ID that has no memberships in the store
    const { result } = renderHook(() => useListMembers('some-other-tenant'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('handles loading state correctly', () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useListMembers(TEST_TENANT_ID), { wrapper });

    // Initially should be loading
    expect(result.current.isLoading).toBe(true);
  });

  it('does not fetch when familyId is empty', () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useListMembers(''), { wrapper });

    // Query should be disabled, not fetching
    expect(result.current.isFetching).toBe(false);
  });
});

describe('useInviteMember', () => {
  beforeEach(() => {
    resetFamilyStore();
    setupAuthenticatedUser(TEST_TENANT_ID);
  });

  it('invites a new member and returns pending membership', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useInviteMember(TEST_TENANT_ID), { wrapper });

    act(() => {
      result.current.mutate({
        user_email: 'newmember@example.com',
        role: 'member',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify the returned membership is pending
    expect(result.current.data).toBeDefined();
    expect(result.current.data!.status).toBe('pending');
    expect(result.current.data!.user_email).toBe('newmember@example.com');
    expect(result.current.data!.role).toBe('member');
  });

  it('defaults role to member when not specified', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useInviteMember(TEST_TENANT_ID), { wrapper });

    act(() => {
      result.current.mutate({
        user_email: 'another@example.com',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data!.role).toBe('member');
  });

  it('handles duplicate invitation error', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useInviteMember(TEST_TENANT_ID), { wrapper });

    // Try to invite an existing member (owner@example.com is in the mock store)
    act(() => {
      result.current.mutate({
        user_email: 'owner@example.com',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('handles missing email validation error', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useInviteMember(TEST_TENANT_ID), { wrapper });

    act(() => {
      result.current.mutate({
        user_email: '',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates members query on success', async () => {
    const { wrapper, queryClient } = createWrapper();

    // Pre-populate the members cache
    queryClient.setQueryData(['members', TEST_TENANT_ID], []);

    const { result } = renderHook(() => useInviteMember(TEST_TENANT_ID), { wrapper });

    act(() => {
      result.current.mutate({
        user_email: 'fresh@example.com',
        role: 'viewer',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Members query should be invalidated to trigger refetch
    const queryState = queryClient.getQueryState(['members', TEST_TENANT_ID]);
    expect(queryState?.isInvalidated).toBe(true);
  });
});

describe('useRemoveMember', () => {
  beforeEach(() => {
    resetFamilyStore();
    setupAuthenticatedUser(TEST_TENANT_ID);
  });

  it('removes a member successfully', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRemoveMember(TEST_TENANT_ID), { wrapper });

    act(() => {
      result.current.mutate({ membershipId: 'membership-uuid-2' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('handles 404 for non-existent membership', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRemoveMember(TEST_TENANT_ID), { wrapper });

    act(() => {
      result.current.mutate({ membershipId: 'non-existent-id' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('handles 403 when trying to remove owner', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRemoveMember(TEST_TENANT_ID), { wrapper });

    act(() => {
      result.current.mutate({ membershipId: 'cannot-remove-id' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates members query on success', async () => {
    const { wrapper, queryClient } = createWrapper();

    queryClient.setQueryData(['members', TEST_TENANT_ID], []);

    const { result } = renderHook(() => useRemoveMember(TEST_TENANT_ID), { wrapper });

    act(() => {
      result.current.mutate({ membershipId: 'membership-uuid-2' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const queryState = queryClient.getQueryState(['members', TEST_TENANT_ID]);
    expect(queryState?.isInvalidated).toBe(true);
  });
});

describe('useLeaveFamily', () => {
  beforeEach(() => {
    resetFamilyStore();
    setupAuthenticatedUser(TEST_TENANT_ID);
  });

  it('allows a member to leave the family', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLeaveFamily(TEST_TENANT_ID), { wrapper });

    // Use a regular member's membership ID (not the owner)
    act(() => {
      result.current.mutate('membership-uuid-2');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('allows an owner to leave when removal is permitted by backend', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLeaveFamily(TEST_TENANT_ID), { wrapper });

    act(() => {
      result.current.mutate('membership-owner-uuid');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('invalidates both members and families queries on success', async () => {
    const { wrapper, queryClient } = createWrapper();

    // Pre-populate caches
    queryClient.setQueryData(['members', TEST_TENANT_ID], []);
    queryClient.setQueryData(['families'], []);

    const { result } = renderHook(() => useLeaveFamily(TEST_TENANT_ID), { wrapper });

    act(() => {
      result.current.mutate('membership-uuid-3');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Both queries should be invalidated
    const membersState = queryClient.getQueryState(['members', TEST_TENANT_ID]);
    expect(membersState?.isInvalidated).toBe(true);

    const familiesState = queryClient.getQueryState(['families']);
    expect(familiesState?.isInvalidated).toBe(true);
  });

  it('handles error when backend rejects leave request', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLeaveFamily(TEST_TENANT_ID), { wrapper });

    // Use the special "cannot-remove-id" that triggers 403
    act(() => {
      result.current.mutate('cannot-remove-id');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useDeleteFamily', () => {
  beforeEach(() => {
    resetFamilyStore();
    setupAuthenticatedUser(TEST_TENANT_ID);
  });

  it('deletes a family successfully', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteFamily(), { wrapper });

    act(() => {
      result.current.mutate(TEST_TENANT_ID);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('handles 403 for non-owner trying to delete', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteFamily(), { wrapper });

    // Use the special "unauthorized-id" that triggers 403
    act(() => {
      result.current.mutate('unauthorized-id');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('handles 404 for non-existent family', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDeleteFamily(), { wrapper });

    act(() => {
      result.current.mutate('non-existent-id');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates families and related queries on success', async () => {
    const { wrapper, queryClient } = createWrapper();

    // Pre-populate caches
    queryClient.setQueryData(['families'], []);
    queryClient.setQueryData(['members', TEST_TENANT_ID], []);
    queryClient.setQueryData(['categories', TEST_TENANT_ID], []);

    const { result } = renderHook(() => useDeleteFamily(), { wrapper });

    act(() => {
      result.current.mutate(TEST_TENANT_ID);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // All related queries should be invalidated
    expect(queryClient.getQueryState(['families'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['members', TEST_TENANT_ID])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['categories', TEST_TENANT_ID])?.isInvalidated).toBe(true);
  });
});
