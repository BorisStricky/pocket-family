// src/components/ProtectedRoute.test.tsx
// Tests for the ProtectedRoute guard component
// Uses direct context mocking - wraps component with mocked AuthContext values

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AuthContext } from '@/features/auth/context/AuthContext';
import type { User } from '@/types';

// Helper to create mock auth context value
function createMockAuthContext(
  isAuthenticated: boolean,
  isLoading: boolean,
  user: User | null = null
) {
  return {
    user,
    isAuthenticated,
    isLoading,
    setUser: () => {},
    setTokens: () => {},
    clearAuth: () => {},
  };
}

describe('ProtectedRoute', () => {
  it('should show loading state when isLoading is true', () => {
    // Arrange - Create loading auth context
    const mockContext = createMockAuthContext(false, true);

    // Act - Render ProtectedRoute with loading state
    render(
      <AuthContext.Provider value={mockContext}>
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Assert - Verify loading message is displayed
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect to /login when not authenticated', () => {
    // Arrange - Create unauthenticated auth context
    const mockContext = createMockAuthContext(false, false);

    // Act - Render ProtectedRoute with redirect check
    render(
      <AuthContext.Provider value={mockContext}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Assert - Verify redirect to login page
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render children when authenticated', () => {
    // Arrange - Create authenticated auth context
    const mockUser: User = {
      id: 'user-123',
      email: 'test@example.com',
      tenant_id: 'family-456',
      roles: ['member'],
    };
    const mockContext = createMockAuthContext(true, false, mockUser);

    // Act - Render ProtectedRoute when authenticated
    render(
      <AuthContext.Provider value={mockContext}>
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Assert - Verify protected content is rendered
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should handle state transition from loading to authenticated', () => {
    // Arrange - Start with loading state
    const loadingContext = createMockAuthContext(false, true);

    // Act - Render with loading state
    const { rerender } = render(
      <AuthContext.Provider value={loadingContext}>
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Assert - Verify loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Act - Update to authenticated state
    const mockUser: User = {
      id: 'user-123',
      email: 'test@example.com',
      tenant_id: 'family-456',
      roles: ['member'],
    };
    const authenticatedContext = createMockAuthContext(true, false, mockUser);

    rerender(
      <AuthContext.Provider value={authenticatedContext}>
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Assert - Verify transition to authenticated content
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should handle state transition from loading to unauthenticated', () => {
    // Arrange - Start with loading state
    const loadingContext = createMockAuthContext(false, true);

    // Act - Render with loading state
    const { rerender } = render(
      <AuthContext.Provider value={loadingContext}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Assert - Verify loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Act - Update to unauthenticated state
    const unauthenticatedContext = createMockAuthContext(false, false);

    rerender(
      <AuthContext.Provider value={unauthenticatedContext}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Assert - Verify redirect to login
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render complex children when authenticated', () => {
    // Arrange - Create authenticated auth context
    const mockUser: User = {
      id: 'user-999',
      email: 'complex@example.com',
      tenant_id: 'family-999',
      roles: ['owner'],
    };
    const mockContext = createMockAuthContext(true, false, mockUser);

    // Act - Render ProtectedRoute with complex children
    render(
      <AuthContext.Provider value={mockContext}>
        <MemoryRouter>
          <ProtectedRoute>
            <div>
              <h1>Dashboard</h1>
              <p>Welcome back, user!</p>
              <button>Action Button</button>
            </div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Assert - Verify all complex children are rendered
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome back, user!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
  });

  it('should maintain loading UI structure while loading', () => {
    // Arrange - Create loading auth context
    const mockContext = createMockAuthContext(false, true);

    // Act - Render ProtectedRoute
    const { container } = render(
      <AuthContext.Provider value={mockContext}>
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Assert - Verify loading container structure
    const loadingContainer = container.querySelector('div[style*="display: flex"]');
    expect(loadingContainer).toBeInTheDocument();
    expect(loadingContainer).toHaveStyle({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    });
  });
});
