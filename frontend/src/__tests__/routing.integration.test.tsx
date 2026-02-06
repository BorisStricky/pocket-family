// Integration tests for routing guards and navigation
// Tests FamilyGuard, ProtectedRoute, and app-level navigation

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import FamilyGuard from '@/components/FamilyGuard';
import { FamilyProvider } from '@/features/family/context/FamilyContext';

const API_BASE = 'http://localhost:8000';

describe('Routing - FamilyGuard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders children when user is a valid family member', async () => {
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <FamilyProvider>
                <div>Family Content</div>
              </FamilyProvider>
            </FamilyGuard>
          }
        />
      </Routes>,
      { initialEntries: ['/app/tenant-uuid-456/welcome'] }
    );

    // FamilyGuard fetches family data, then renders children
    await waitFor(() => {
      expect(screen.getByText('Family Content')).toBeInTheDocument();
    });
  });

  it('shows Access Denied when user is not a member (403)', async () => {
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <div>Family Content</div>
            </FamilyGuard>
          }
        />
      </Routes>,
      // "unauthorized-id" triggers 403 in MSW handler
      { initialEntries: ['/app/unauthorized-id/welcome'] }
    );

    // useFamilyById has retry: 1 which overrides test client's retry: false,
    // so the 403 error takes two round trips before surfacing
    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Children should NOT render
    expect(screen.queryByText('Family Content')).not.toBeInTheDocument();
  });

  it('shows Access Denied when family does not exist (404)', async () => {
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <div>Family Content</div>
            </FamilyGuard>
          }
        />
      </Routes>,
      // "non-existent-id" triggers 404 in MSW handler
      { initialEntries: ['/app/non-existent-id/welcome'] }
    );

    // useFamilyById retries once before surfacing the error
    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows loading state while validating family access', () => {
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <div>Family Content</div>
            </FamilyGuard>
          }
        />
      </Routes>,
      { initialEntries: ['/app/tenant-uuid-456/welcome'] }
    );

    // Should show loading text while family data is being fetched
    expect(screen.getByText('Validating family access...')).toBeInTheDocument();
  });

  it('shows View All Families link when access is denied', async () => {
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <div>Family Content</div>
            </FamilyGuard>
          }
        />
      </Routes>,
      { initialEntries: ['/app/unauthorized-id/welcome'] }
    );

    // Wait for the error state to fully render (useFamilyById has retry: 1)
    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    }, { timeout: 5000 });

    // "View All Families" link is always present as an escape hatch
    expect(screen.getByRole('link', { name: /view all families/i })).toBeInTheDocument();
  });
});

describe('Routing - FamilyContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores preferred family in localStorage when family loads', async () => {
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <FamilyProvider>
                <div>Inside family context</div>
              </FamilyProvider>
            </FamilyGuard>
          }
        />
      </Routes>,
      { initialEntries: ['/app/tenant-uuid-456/welcome'] }
    );

    // Wait for family data to load and context to update
    await waitFor(() => {
      expect(screen.getByText('Inside family context')).toBeInTheDocument();
    });

    // FamilyProvider stores preferred family in localStorage
    await waitFor(() => {
      expect(localStorage.getItem('preferred_family_id')).toBe('tenant-uuid-456');
    });
  });
});
