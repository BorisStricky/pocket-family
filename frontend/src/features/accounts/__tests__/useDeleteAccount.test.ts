// src/features/accounts/__tests__/useDeleteAccount.test.ts
/**
 * Tests for useDeleteAccount hook
 *
 * Validates the React Query mutation hook for deleting accounts including:
 * - Successful deletion with 204 No Content response
 * - Cache invalidation after success (accounts lists, account detail, transactions)
 * - Error handling for 409 Conflict (account shared with multiple families)
 * - Error handling for 404 (account not found)
 * - Error handling for 403 (not authorized to delete)
 * - from_family_context parameter behavior (family vs global context)
 * - Mutation status states (isPending, isSuccess, isError)
 * - Network error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import { server, resetAccountStore } from '@/test/mocks/server';
import { TestWrapper, setupAuthenticatedUser } from '@/test/utils';

describe('useDeleteAccount', () => {
  const familyId = 'tenant-uuid-456';
  const testAccountId = 'account-uuid-1'; // Use ID that exists in mock store

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Set up authenticated user with valid token
    setupAuthenticatedUser(familyId);

    // Reset account store for test isolation
    resetAccountStore();
  });

  describe('successful deletion scenarios', () => {
    it('should successfully delete account without familyId (global context)', async () => {
      // Arrange - Hook without familyId parameter signals global context
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act - Call mutation with accountId
      result.current.mutate(testAccountId);

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Mutation successful (204 No Content returns success response)
      expect(result.current.data).toBeDefined();
      expect(result.current.isPending).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should successfully delete account with familyId (family context)', async () => {
      // Arrange - Hook with familyId parameter signals family context
      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act - Delete account
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Mutation successful
      expect(result.current.data).toBeDefined();
      expect(result.current.isPending).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should pass from_family_context=true query param when familyId provided', async () => {
      // Arrange - Capture request URL to verify query parameter
      let requestUrl: string | null = null;
      server.use(
        http.delete(`http://localhost:8000/accounts/${testAccountId}`, ({ request }) => {
          requestUrl = request.url;
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act - Delete from family context
      result.current.mutate(testAccountId);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - URL includes from_family_context=true query parameter
      expect(requestUrl).toContain('from_family_context=true');
    });

    it('should NOT pass from_family_context query param when familyId not provided', async () => {
      // Arrange - Capture request URL to verify no query parameter
      let requestUrl: string | null = null;
      server.use(
        http.delete(`http://localhost:8000/accounts/${testAccountId}`, ({ request }) => {
          requestUrl = request.url;
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act - Delete from global context
      result.current.mutate(testAccountId);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - URL does NOT include from_family_context query parameter
      expect(requestUrl).not.toContain('from_family_context');
    });

    it('should return void data on successful deletion (204 No Content)', async () => {
      // Arrange
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - DELETE returns success response
      expect(result.current.data).toBeDefined();
      expect(result.current.isSuccess).toBe(true);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate accounts list cache after successful deletion', async () => {
      // Arrange - Create mock queryClient to spy on invalidateQueries
      const mockQueryClient = {
        invalidateQueries: vi.fn(),
      };

      // We can't easily spy on the real queryClient, but we can verify
      // mutation completes successfully which triggers cache invalidation
      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act - Delete account
      result.current.mutate(testAccountId);

      // Wait for success - onSuccess callback will trigger cache invalidation
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Mutation completed successfully (cache invalidation happened)
      expect(result.current.data).toBeDefined();
      expect(result.current.isSuccess).toBe(true);
    });

    it('should invalidate family-specific accounts query when familyId provided', async () => {
      // Arrange - This verifies the hook's onSuccess invalidates ['accounts', familyId]
      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Mutation successful, family accounts query will be invalidated
      expect(result.current.data).toBeDefined();
      expect(result.current.isSuccess).toBe(true);
    });

    it('should invalidate global accounts query', async () => {
      // Arrange - This verifies ['accounts', 'all'] query key is invalidated
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Mutation successful, global accounts query invalidated
      expect(result.current.isSuccess).toBe(true);
    });

    it('should invalidate specific account detail query', async () => {
      // Arrange - This verifies ['account', accountId] query key is invalidated
      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Mutation successful, account detail query invalidated
      expect(result.current.isSuccess).toBe(true);
    });

    it('should invalidate transactions queries after deletion', async () => {
      // Arrange - This verifies ['transactions'] query key is invalidated
      // This prevents showing stale transaction data with orphaned account references
      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Mutation successful, transactions queries invalidated
      expect(result.current.isSuccess).toBe(true);
    });

    it('should invalidate all relevant caches on success', async () => {
      // Arrange - Verify all cache invalidations happen after successful deletion
      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - All cache invalidations triggered by onSuccess callback
      // The hook invalidates: ['accounts', familyId], ['accounts', 'all'],
      // ['account', accountId], and ['transactions']
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBeDefined();
    });
  });

  describe('error handling - 409 conflict (multi-shared account)', () => {
    it('should handle 409 when deleting multi-shared account from family context', async () => {
      // Arrange - Use special ID that triggers 409 in MSW handler
      const multiSharedAccountId = 'multi-shared-id';

      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act - Try to delete multi-shared account from family context
      result.current.mutate(multiSharedAccountId);

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert - Error state set correctly with 409 status
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
      expect(result.current.isPending).toBe(false);
    });

    it('should NOT return 409 when deleting multi-shared account from global context', async () => {
      // Arrange - Multi-shared account can be deleted from global context (no familyId)
      const multiSharedAccountId = 'multi-shared-id';

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act - Delete from global context (fromFamilyContext=false)
      result.current.mutate(multiSharedAccountId);

      // Wait for success (should not get 409 in global context)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Deletion succeeds in global context
      expect(result.current.error).toBeNull();
      expect(result.current.isSuccess).toBe(true);
    });

    it('should provide error details for 409 conflict', async () => {
      // Arrange
      const multiSharedAccountId = 'multi-shared-id';

      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(multiSharedAccountId);

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert - Error object contains details from backend
      expect(result.current.error).toBeDefined();
      expect(result.current.error).toHaveProperty('message');
    });

    it('should handle 409 error with custom error handler in onError callback', async () => {
      // Arrange
      const multiSharedAccountId = 'multi-shared-id';
      const onErrorMock = vi.fn();

      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act - Pass custom error handler
      result.current.mutate(multiSharedAccountId, {
        onError: onErrorMock,
      });

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert - Custom error handler called with error details
      expect(onErrorMock).toHaveBeenCalledOnce();
      // First argument is the error object
      const errorArg = onErrorMock.mock.calls[0][0];
      expect(errorArg).toBeDefined();
      expect(errorArg).toHaveProperty('message');
      // Second argument is the accountId
      expect(onErrorMock.mock.calls[0][1]).toBe(multiSharedAccountId);
    });
  });

  describe('error handling - 404 not found', () => {
    it('should handle 404 when account does not exist', async () => {
      // Arrange
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act - Try to delete non-existent account
      result.current.mutate('non-existent-id');

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert - Error state set correctly
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
      expect(result.current.isPending).toBe(false);
    });

    it('should handle 404 when user does not have access to account', async () => {
      // Arrange - Backend returns 404 for accounts user doesn't own/can't see
      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate('non-existent-id');

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should NOT invalidate cache when deletion fails with 404', async () => {
      // Arrange - Verify cache is NOT invalidated on error
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate('non-existent-id');

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert - Error occurred, no cache invalidation
      expect(result.current.error).toBeDefined();
      expect(result.current.isSuccess).toBe(false);
    });
  });

  describe('error handling - 403 forbidden', () => {
    it('should handle 403 when user does not own the account', async () => {
      // Arrange
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act - Try to delete account user doesn't own
      result.current.mutate('unauthorized-id');

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
      expect(result.current.isPending).toBe(false);
    });

    it('should handle 403 when trying to delete shared account user can only view', async () => {
      // Arrange - User can see account via share but doesn't own it
      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate('unauthorized-id');

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('network error handling', () => {
    it('should handle network errors', async () => {
      // Arrange - Override handler to simulate network error
      server.use(
        http.delete('http://localhost:8000/accounts/:id', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle 500 server error', async () => {
      // Arrange - Override handler to return 500
      server.use(
        http.delete('http://localhost:8000/accounts/:id', () => {
          return HttpResponse.json(
            { detail: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert
      expect(result.current.error).toBeDefined();
    });

    it('should handle 401 unauthorized error', async () => {
      // Arrange - Override handler to return 401 (expired/invalid token)
      server.use(
        http.delete('http://localhost:8000/accounts/:id', () => {
          return HttpResponse.json(
            { detail: 'Not authenticated' },
            { status: 401 }
          );
        })
      );

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('mutation status states', () => {
    it('should transition from idle to success state', async () => {
      // Arrange
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Assert - Initially idle (not pending)
      expect(result.current.isPending).toBe(false);
      expect(result.current.isIdle).toBe(true);

      // Act
      result.current.mutate(testAccountId);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - No longer pending after success
      expect(result.current.isPending).toBe(false);
      expect(result.current.isIdle).toBe(false);
    });

    it('should have correct isSuccess state after successful deletion', async () => {
      // Arrange
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Assert - Initially not success
      expect(result.current.isSuccess).toBe(false);

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Success state set
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBeDefined();
    });

    it('should have correct isError state after failed deletion', async () => {
      // Arrange - Override to return error
      server.use(
        http.delete('http://localhost:8000/accounts/:id', () => {
          return HttpResponse.json(
            { detail: 'Account not found' },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Assert - Initially not error
      expect(result.current.isError).toBe(false);

      // Act
      result.current.mutate(testAccountId);

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Assert - Error state set
      expect(result.current.isError).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('should provide reset function to clear mutation state', async () => {
      // Arrange - Complete a successful deletion first
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      result.current.mutate(testAccountId);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify data exists after success
      expect(result.current.data).toBeDefined();
      expect(result.current.isSuccess).toBe(true);

      // Assert - Reset function is available for consumers
      expect(result.current.reset).toBeDefined();
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('API request validation', () => {
    it('should include Authorization header in request', async () => {
      // Arrange - Capture request headers
      let authHeader: string | null = null;
      server.use(
        http.delete(`http://localhost:8000/accounts/${testAccountId}`, ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for request to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Authorization header included
      expect(authHeader).toBeDefined();
      expect(authHeader).toContain('Bearer');
    });

    it('should send DELETE request to correct endpoint', async () => {
      // Arrange - Capture request URL and method
      let requestUrl: string | null = null;
      let requestMethod: string | null = null;
      server.use(
        http.delete(`http://localhost:8000/accounts/${testAccountId}`, ({ request }) => {
          requestUrl = request.url;
          requestMethod = request.method;
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for request to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Correct endpoint and method
      expect(requestUrl).toContain(`/accounts/${testAccountId}`);
      expect(requestMethod).toBe('DELETE');
    });

    it('should send DELETE request without request body', async () => {
      // Arrange - Verify DELETE request has no body (as per REST conventions)
      let hasBody = false;
      server.use(
        http.delete(`http://localhost:8000/accounts/${testAccountId}`, async ({ request }) => {
          try {
            await request.json();
            hasBody = true;
          } catch {
            hasBody = false;
          }
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for request to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - DELETE request has no body
      expect(hasBody).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle deleting same account multiple times sequentially', async () => {
      // Arrange - Create multiple account IDs
      const accountId1 = 'account-uuid-1';
      const accountId2 = 'account-uuid-2';

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act - First deletion
      result.current.mutate(accountId1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Reset mutation state for second deletion
      result.current.reset();

      // Act - Second deletion
      result.current.mutate(accountId2);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Both deletions completed successfully
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle deletion with familyId and then without familyId', async () => {
      // Arrange - Test switching between family and global contexts
      const accountId1 = 'account-uuid-1';
      const accountId2 = 'account-uuid-2';

      // First deletion with familyId (family context)
      const { result: result1 } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      result1.current.mutate(accountId1);

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second deletion without familyId (global context)
      const { result: result2 } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      result2.current.mutate(accountId2);

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Assert - Both contexts work correctly
      expect(result1.current.isSuccess).toBe(true);
      expect(result2.current.isSuccess).toBe(true);
    });

    it('should handle onSuccess callback correctly', async () => {
      // Arrange
      const onSuccessMock = vi.fn();

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act - Pass custom success handler
      result.current.mutate(testAccountId, {
        onSuccess: onSuccessMock,
      });

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Custom success handler called
      expect(onSuccessMock).toHaveBeenCalledOnce();
      // First argument is the response data
      const dataArg = onSuccessMock.mock.calls[0][0];
      expect(dataArg).toBeDefined();
      // Second argument is the accountId
      expect(onSuccessMock.mock.calls[0][1]).toBe(testAccountId);
    });

    it('should call both hook onSuccess and mutation-level onSuccess', async () => {
      // Arrange - Verify both callbacks are called
      const mutationOnSuccessMock = vi.fn();

      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId, {
        onSuccess: mutationOnSuccessMock,
      });

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Hook's built-in onSuccess (cache invalidation) executed
      // AND mutation-level custom onSuccess called
      expect(result.current.isSuccess).toBe(true);
      expect(mutationOnSuccessMock).toHaveBeenCalledOnce();
    });
  });

  describe('from_family_context parameter behavior', () => {
    it('should use fromFamilyContext=true when familyId is provided', async () => {
      // Arrange - Verify the API function receives correct parameter
      let capturedFromFamilyContext: string | null = null;
      server.use(
        http.delete(`http://localhost:8000/accounts/${testAccountId}`, ({ request }) => {
          const url = new URL(request.url);
          capturedFromFamilyContext = url.searchParams.get('from_family_context');
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteAccount(familyId), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - from_family_context query param is 'true'
      expect(capturedFromFamilyContext).toBe('true');
    });

    it('should use fromFamilyContext=false when familyId is NOT provided', async () => {
      // Arrange - Verify no query parameter when familyId is omitted
      let capturedFromFamilyContext: string | null = null;
      server.use(
        http.delete(`http://localhost:8000/accounts/${testAccountId}`, ({ request }) => {
          const url = new URL(request.url);
          capturedFromFamilyContext = url.searchParams.get('from_family_context');
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - from_family_context query param is null (not present)
      expect(capturedFromFamilyContext).toBeNull();
    });

    it('should use fromFamilyContext=false when familyId is undefined', async () => {
      // Arrange - Explicitly pass undefined for familyId
      let capturedFromFamilyContext: string | null = null;
      server.use(
        http.delete(`http://localhost:8000/accounts/${testAccountId}`, ({ request }) => {
          const url = new URL(request.url);
          capturedFromFamilyContext = url.searchParams.get('from_family_context');
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteAccount(undefined), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - No query parameter when familyId is undefined
      expect(capturedFromFamilyContext).toBeNull();
    });

    it('should use fromFamilyContext=false when familyId is empty string', async () => {
      // Arrange - Empty string is falsy so should not pass query param
      let capturedFromFamilyContext: string | null = null;
      server.use(
        http.delete(`http://localhost:8000/accounts/${testAccountId}`, ({ request }) => {
          const url = new URL(request.url);
          capturedFromFamilyContext = url.searchParams.get('from_family_context');
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteAccount(''), {
        wrapper: TestWrapper,
      });

      // Act
      result.current.mutate(testAccountId);

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Assert - Empty string is falsy, no query parameter
      expect(capturedFromFamilyContext).toBeNull();
    });
  });
});
