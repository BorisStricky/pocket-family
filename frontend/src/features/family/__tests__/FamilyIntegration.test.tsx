// src/features/family/__tests__/FamilyIntegration.test.tsx
// Integration tests for family context and hooks
// Tests the full family feature flow with MSW handlers

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { QueryClientProvider } from '@tanstack/react-query';
import { FamilyProvider, FamilyContext } from '../context/FamilyContext';
import { useFamilies } from '../hooks/useFamilies';
import { useFamilyById } from '../hooks/useFamilyById';
import { useSwitchFamily } from '../hooks/useSwitchFamily';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { createTestQueryClient, TestWrapper } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { createMockJWT, createMockFamily, createMockFamilyList } from '@/test/mocks/factories';
import { STORAGE_KEYS } from '@/lib/constants';
import type { TenantRead } from '@/types/family';
import type { TokenResponse } from '@/types';

describe('Family Integration Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('useFamilies hook', () => {
    it('should fetch list of families from GET /tenants', async () => {
      // Arrange - Create wrapper
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook
      const { result } = renderHook(() => useFamilies(), { wrapper });

      // Assert - Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify families data structure
      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
      expect(result.current.data!.length).toBeGreaterThan(0);
    });

    it('should return family list with correct structure', async () => {
      // Arrange - Override handler to return specific families
      const mockFamilies = createMockFamilyList(2);
      server.use(
        http.get('http://localhost:8000/tenants', () => {
          return HttpResponse.json(mockFamilies);
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook
      const { result } = renderHook(() => useFamilies(), { wrapper });

      // Assert - Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify structure matches mock
      expect(result.current.data).toEqual(mockFamilies);
      expect(result.current.data![0].id).toBe(mockFamilies[0].id);
      expect(result.current.data![0].name).toBe(mockFamilies[0].name);
    });

    it('should handle empty family list', async () => {
      // Arrange - Override handler to return empty array
      server.use(
        http.get('http://localhost:8000/tenants', () => {
          return HttpResponse.json([]);
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook
      const { result } = renderHook(() => useFamilies(), { wrapper });

      // Assert - Wait for success with empty array
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('useFamilyById hook', () => {
    it('should fetch specific family by ID from GET /tenants/:id', async () => {
      // Arrange - Create mock family
      const mockFamily = createMockFamily({ id: 'family-123', name: 'Test Family' });
      server.use(
        http.get('http://localhost:8000/tenants/:id', ({ params }) => {
          if (params.id === 'family-123') {
            return HttpResponse.json(mockFamily);
          }
          return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook with familyId
      const { result } = renderHook(() => useFamilyById('family-123'), { wrapper });

      // Assert - Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockFamily);
    });

    it('should handle 403 forbidden when user is not a member', async () => {
      // Arrange - Override to return 403
      server.use(
        http.get('http://localhost:8000/tenants/:id', () => {
          return HttpResponse.json(
            { detail: 'Not authorized to access this family' },
            { status: 403 }
          );
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook
      const { result } = renderHook(() => useFamilyById('not-member'), { wrapper });

      // Assert - Wait for error (hook retries once, so allow extra time)
      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 5000 }
      );
    });

    it('should handle 404 when family does not exist', async () => {
      // Arrange - Override to return 404
      server.use(
        http.get('http://localhost:8000/tenants/:id', () => {
          return HttpResponse.json(
            { detail: 'Family not found' },
            { status: 404 }
          );
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      );

      // Act - Render the hook
      const { result } = renderHook(() => useFamilyById('nonexistent'), { wrapper });

      // Assert - Wait for error (hook retries once, so allow extra time)
      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 5000 }
      );
    });
  });

  describe('useSwitchFamily hook', () => {
    it('should switch family and update token', async () => {
      // Arrange - Set up initial auth state
      const initialToken = createMockJWT({ tenant_id: 'family-old' });
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, initialToken);

      // Create new token for family switch
      const newToken = createMockJWT({ tenant_id: 'family-new' });
      server.use(
        http.post('http://localhost:8000/tenants/:id/switch', () => {
          const response: TokenResponse = {
            access_token: newToken,
            token_type: 'bearer',
          };
          return HttpResponse.json(response);
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter>
              {children}
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      // Act - Render the hook and trigger switch
      const { result } = renderHook(() => useSwitchFamily(), { wrapper });

      result.current.mutate('family-new');

      // Assert - Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify new token is stored
      expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe(newToken);
    });

    it('should call POST /tenants/:id/switch with correct ID', async () => {
      // Arrange - Track which ID was called
      let calledWithId: string | null = null;
      server.use(
        http.post('http://localhost:8000/tenants/:id/switch', ({ params }) => {
          calledWithId = params.id as string;
          const newToken = createMockJWT({ tenant_id: params.id as string });
          const response: TokenResponse = {
            access_token: newToken,
            token_type: 'bearer',
          };
          return HttpResponse.json(response);
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter>
              {children}
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      // Act - Render the hook and switch to specific family
      const { result } = renderHook(() => useSwitchFamily(), { wrapper });

      result.current.mutate('family-target-123');

      // Assert - Wait for completion and verify correct ID
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(calledWithId).toBe('family-target-123');
    });

    it('should handle switch family error gracefully', async () => {
      // Arrange - Override to return error
      server.use(
        http.post('http://localhost:8000/tenants/:id/switch', () => {
          return HttpResponse.json(
            { detail: 'Not authorized to switch to this family' },
            { status: 403 }
          );
        })
      );

      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter>
              {children}
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      // Act - Render the hook and attempt switch
      const { result } = renderHook(() => useSwitchFamily(), { wrapper });

      result.current.mutate('forbidden-family');

      // Assert - Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('FamilyContext integration', () => {
    it('should provide current family from URL parameter', async () => {
      // Arrange - Create mock family
      const mockFamily = createMockFamily({ id: 'family-123', name: 'Test Family' });
      server.use(
        http.get('http://localhost:8000/tenants/:id', () => {
          return HttpResponse.json(mockFamily);
        })
      );

      const queryClient = createTestQueryClient();

      // Create a component that consumes the context
      function TestComponent() {
        const context = React.useContext(FamilyContext);
        if (!context) return <div>No Context</div>;
        if (context.isLoading) return <div>Loading...</div>;
        return <div>Family: {context.currentFamily?.name}</div>;
      }

      // Act - Render with FamilyProvider and route parameter
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/app/family-123/welcome']}>
              <Routes>
                <Route
                  path="/app/:familyId/*"
                  element={
                    <FamilyProvider>
                      <TestComponent />
                    </FamilyProvider>
                  }
                />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      // Assert - Wait for family data to load
      await waitFor(() => {
        expect(screen.getByText('Family: Test Family')).toBeInTheDocument();
      });
    });

    it('should provide families list to nested components', async () => {
      // Arrange - Create mock families
      const mockFamilies = createMockFamilyList(3);
      server.use(
        http.get('http://localhost:8000/tenants', () => {
          return HttpResponse.json(mockFamilies);
        }),
        http.get('http://localhost:8000/tenants/:id', ({ params }) => {
          const family = mockFamilies.find(f => f.id === params.id);
          return family
            ? HttpResponse.json(family)
            : HttpResponse.json({ detail: 'Not found' }, { status: 404 });
        })
      );

      const queryClient = createTestQueryClient();

      // Create a component that shows family count
      function TestComponent() {
        const context = React.useContext(FamilyContext);
        if (!context) return <div>No Context</div>;
        return <div>Families count: {context.families.length}</div>;
      }

      // Act - Render with FamilyProvider
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={[`/app/${mockFamilies[0].id}/welcome`]}>
              <Routes>
                <Route
                  path="/app/:familyId/*"
                  element={
                    <FamilyProvider>
                      <TestComponent />
                    </FamilyProvider>
                  }
                />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      // Assert - Wait for families data to load
      await waitFor(() => {
        expect(screen.getByText('Families count: 3')).toBeInTheDocument();
      });
    });

    it('should store preferred family ID in localStorage', async () => {
      // Arrange - Create mock family
      const mockFamily = createMockFamily({ id: 'family-preferred', name: 'Preferred Family' });
      server.use(
        http.get('http://localhost:8000/tenants/:id', () => {
          return HttpResponse.json(mockFamily);
        })
      );

      const queryClient = createTestQueryClient();

      function TestComponent() {
        const context = React.useContext(FamilyContext);
        if (!context || context.isLoading) return <div>Loading...</div>;
        return <div>Family: {context.currentFamily?.name}</div>;
      }

      // Act - Render with specific familyId
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/app/family-preferred/welcome']}>
              <Routes>
                <Route
                  path="/app/:familyId/*"
                  element={
                    <FamilyProvider>
                      <TestComponent />
                    </FamilyProvider>
                  }
                />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      // Assert - Wait for family to load and verify localStorage
      await waitFor(() => {
        expect(screen.getByText('Family: Preferred Family')).toBeInTheDocument();
      });

      expect(localStorage.getItem('preferred_family_id')).toBe('family-preferred');
    });
  });
});
