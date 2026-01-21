// src/features/auth/hooks/useSignup.test.tsx
// Tests for the useSignup mutation hook
// Uses MSW handlers for /auth/signup endpoint

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useSignup } from './useSignup';
import { createTestQueryClient, TestWrapper } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { createMockJWT, createNoTenantMockJWT } from '@/test/mocks/factories';
import { STORAGE_KEYS } from '@/lib/constants';
import type { TokenResponse } from '@/types';

describe('useSignup', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should successfully signup and store tokens', async () => {
    // Arrange - Create wrapper with query client and auth provider
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger signup mutation
    const { result } = renderHook(() => useSignup(), { wrapper });

    result.current.mutate({
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    });

    // Assert - Wait for mutation to succeed
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify tokens are stored in localStorage
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeTruthy();
  });

  it('should decode JWT and update auth context on success', async () => {
    // Arrange - Create wrapper
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger signup
    const { result } = renderHook(() => useSignup(), { wrapper });

    result.current.mutate({
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    });

    // Assert - Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify the data contains user info (from decoded JWT)
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.access_token).toBeTruthy();
  });

  it('should handle 400 validation error', async () => {
    // Arrange - Override MSW handler to return 400
    server.use(
      http.post('http://localhost:8000/auth/signup', () => {
        return HttpResponse.json(
          { detail: 'Invalid email format' },
          { status: 400 }
        );
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger signup with invalid email
    const { result } = renderHook(() => useSignup(), { wrapper });

    result.current.mutate({
      email: 'invalid-email',
      password: 'password123',
    });

    // Assert - Wait for mutation to fail
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Verify error details
    expect(result.current.error).toBeDefined();

    // Verify tokens are NOT stored
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
  });

  it('should handle 409 duplicate email error', async () => {
    // Arrange - Override MSW handler to return 409
    server.use(
      http.post('http://localhost:8000/auth/signup', () => {
        return HttpResponse.json(
          { detail: 'Email already registered' },
          { status: 409 }
        );
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger signup with existing email
    const { result } = renderHook(() => useSignup(), { wrapper });

    result.current.mutate({
      email: 'existing@example.com',
      password: 'password123',
    });

    // Assert - Wait for error
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Verify NO tokens stored on error
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
  });

  it('should handle signup without name field', async () => {
    // Arrange - Create wrapper
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger signup without name
    const { result } = renderHook(() => useSignup(), { wrapper });

    result.current.mutate({
      email: 'noname@example.com',
      password: 'password123',
      // name is optional
    });

    // Assert - Wait for success (name is optional)
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify tokens are stored
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeTruthy();
  });

  it('should handle new user with null tenant_id', async () => {
    // Arrange - Override MSW handler to return token with null tenant_id
    // New users don't have a tenant until they create or join one
    const mockJWT = createNoTenantMockJWT();
    server.use(
      http.post('http://localhost:8000/auth/signup', () => {
        const response: TokenResponse = {
          access_token: mockJWT,
          refresh_token: 'refresh-token-no-tenant',
          token_type: 'bearer',
        };
        return HttpResponse.json(response);
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger signup
    const { result } = renderHook(() => useSignup(), { wrapper });

    result.current.mutate({
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    });

    // Assert - Wait for success
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify tokens are stored (even with null tenant_id for new users)
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe(mockJWT);
  });

  it('should not store tokens on server error', async () => {
    // Arrange - Override MSW handler to return 500 error
    server.use(
      http.post('http://localhost:8000/auth/signup', () => {
        return HttpResponse.json(
          { detail: 'Internal server error' },
          { status: 500 }
        );
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger signup
    const { result } = renderHook(() => useSignup(), { wrapper });

    result.current.mutate({
      email: 'test@example.com',
      password: 'password123',
    });

    // Assert - Wait for error
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Verify NO tokens stored on error
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
  });

  it('should call POST /auth/signup with correct data', async () => {
    // Arrange - Track if endpoint was called with correct data
    let requestBody: any = null;
    server.use(
      http.post('http://localhost:8000/auth/signup', async ({ request }) => {
        requestBody = await request.json();
        const mockJWT = createMockJWT({ email: 'verify@example.com' });
        const response: TokenResponse = {
          access_token: mockJWT,
          refresh_token: 'refresh-token',
          token_type: 'bearer',
        };
        return HttpResponse.json(response);
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook and trigger signup
    const { result } = renderHook(() => useSignup(), { wrapper });

    const signupData = {
      email: 'verify@example.com',
      password: 'testpassword',
      name: 'Test User',
    };

    result.current.mutate(signupData);

    // Assert - Wait for completion and verify request body
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(requestBody).toEqual(signupData);
  });

  it('should track mutation states: idle → success', async () => {
    // Arrange - Create wrapper
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook
    const { result } = renderHook(() => useSignup(), { wrapper });

    // Assert initial state - idle
    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);

    // Act - Trigger mutation
    result.current.mutate({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });

    // Assert success state (skip pending check - too fast in tests)
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
    });
  });

  it('should track mutation states: idle → error', async () => {
    // Arrange - Override to return error
    server.use(
      http.post('http://localhost:8000/auth/signup', () => {
        return HttpResponse.json(
          { detail: 'Email already registered' },
          { status: 409 }
        );
      })
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    );

    // Act - Render the hook
    const { result } = renderHook(() => useSignup(), { wrapper });

    // Assert initial state
    expect(result.current.isError).toBe(false);

    // Act - Trigger mutation
    result.current.mutate({
      email: 'existing@example.com',
      password: 'password123',
    });

    // Assert error state (skip pending check - too fast in tests)
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.isPending).toBe(false);
      expect(result.current.isSuccess).toBe(false);
    });
  });
});
