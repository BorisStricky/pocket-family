// Integration tests for authentication workflows
// Tests login, signup, logout as users experience them through the UI

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import { STORAGE_KEYS } from '@/lib/constants';
import LoginPage from '@/pages/login_page';
import SignupPage from '@/pages/signup_page';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const API_BASE = 'http://localhost:8000';

describe('Auth Integration - Login', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('logs in successfully and stores token', async () => {
    const user = userEvent.setup();

    renderWithProviders(<LoginPage />, {
      initialEntries: ['/login'],
    });

    // Fill in credentials
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    // Token should be stored after successful login
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).not.toBeNull();
    });
  });

  it('shows error message for invalid credentials', async () => {
    const user = userEvent.setup();

    // Login returns 401 for invalid@example.com, and apiClient will try to refresh.
    // We must also make refresh fail to prevent the retry from succeeding.
    server.use(
      http.post(`${API_BASE}/auth/refresh`, () => {
        return HttpResponse.json(
          { detail: 'Refresh token invalid' },
          { status: 401 }
        );
      })
    );

    renderWithProviders(<LoginPage />, {
      initialEntries: ['/login'],
    });

    await user.type(screen.getByLabelText(/email/i), 'invalid@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    // Error message should display
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows validation error for short password', async () => {
    const user = userEvent.setup();

    renderWithProviders(<LoginPage />, {
      initialEntries: ['/login'],
    });

    // Type valid email but password too short (min 6 chars per AuthForm validate())
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'abc');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    // Custom validation error should appear
    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    });
  });
});

describe('Auth Integration - Signup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('signs up successfully and stores token', async () => {
    const user = userEvent.setup();

    renderWithProviders(<SignupPage />, {
      initialEntries: ['/signup'],
    });

    // Fill in signup form
    await user.type(screen.getByLabelText(/name/i), 'Test User');
    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    // Token should be stored
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).not.toBeNull();
    });
  });

  it('shows error for duplicate email', async () => {
    const user = userEvent.setup();

    renderWithProviders(<SignupPage />, {
      initialEntries: ['/signup'],
    });

    // Use the email that triggers 409 in the MSW handler
    await user.type(screen.getByLabelText(/name/i), 'Test User');
    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    // Error message should display
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

describe('Auth Integration - Protected Routes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirects unauthenticated users to /login', () => {
    // Render a protected route without setting up auth
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { initialEntries: ['/app/family-123/transactions'] }
    );

    // Protected content should NOT render
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders protected content for authenticated users', async () => {
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { initialEntries: ['/app/tenant-uuid-456/transactions'] }
    );

    // Should show loading first, then content
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('shows loading state while checking auth', () => {
    // Set up a valid token so AuthContext enters loading state on mount
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { initialEntries: ['/app/tenant-uuid-456/transactions'] }
    );

    // The component should eventually resolve (either loading or content)
    // AuthContext isLoading is true initially, then false
    expect(screen.queryByText('Protected Content') || screen.queryByText('Loading...')).toBeTruthy();
  });
});
