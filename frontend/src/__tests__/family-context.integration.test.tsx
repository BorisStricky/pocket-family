// Integration tests for FamilyContext provider
// Tests family data loading, context value provision, and family switching

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, renderHook } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser, server } from '@/test/utils';
import { FamilyProvider, FamilyContext } from '@/features/family/context/FamilyContext';
import FamilyGuard from '@/components/FamilyGuard';

const API_BASE = 'http://localhost:8000';

// Helper component that displays family context values for testing
function FamilyContextDisplay() {
  const context = React.useContext(FamilyContext);
  if (!context) return <div>No context</div>;

  return (
    <div>
      <div data-testid="current-family">{context.currentFamily?.name || 'No family'}</div>
      <div data-testid="families-count">{context.families.length}</div>
      <div data-testid="is-loading">{context.isLoading ? 'loading' : 'ready'}</div>
      {context.families.map((family) => (
        <div key={family.id} data-testid={`family-${family.id}`}>
          {family.name}
        </div>
      ))}
    </div>
  );
}

describe('FamilyContext Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides current family name from URL param', async () => {
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <FamilyProvider>
                <FamilyContextDisplay />
              </FamilyProvider>
            </FamilyGuard>
          }
        />
      </Routes>,
      { initialEntries: ['/app/tenant-uuid-456/welcome'] }
    );

    // Wait for family to load from API and context to update
    await waitFor(() => {
      expect(screen.getByTestId('current-family')).toHaveTextContent('Test Family');
    });
  });

  it('provides list of all families user belongs to', async () => {
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <FamilyProvider>
                <FamilyContextDisplay />
              </FamilyProvider>
            </FamilyGuard>
          }
        />
      </Routes>,
      { initialEntries: ['/app/tenant-uuid-456/welcome'] }
    );

    // Default MSW handler returns 2 families
    await waitFor(() => {
      expect(screen.getByTestId('families-count')).toHaveTextContent('2');
    });
  });

  it('shows loading state while fetching family data', () => {
    setupAuthenticatedUser('tenant-uuid-456');

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <FamilyProvider>
                <FamilyContextDisplay />
              </FamilyProvider>
            </FamilyGuard>
          }
        />
      </Routes>,
      { initialEntries: ['/app/tenant-uuid-456/welcome'] }
    );

    // FamilyGuard shows its own loading state before FamilyProvider mounts
    // So we check the guard's loading indicator
    expect(screen.getByText('Validating family access...')).toBeInTheDocument();
  });

  it('handles family not found gracefully', async () => {
    setupAuthenticatedUser('tenant-uuid-456');

    // Override to return 404 for the specific family
    server.use(
      http.get(`${API_BASE}/tenants/:id`, ({ params }) => {
        return HttpResponse.json(
          { detail: 'Tenant not found' },
          { status: 404 }
        );
      })
    );

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <FamilyProvider>
                <FamilyContextDisplay />
              </FamilyProvider>
            </FamilyGuard>
          }
        />
      </Routes>,
      { initialEntries: ['/app/some-family-id/welcome'] }
    );

    // FamilyGuard should show error, not crash
    // useFamilyById retries once before surfacing the error
    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('handles empty families list', async () => {
    setupAuthenticatedUser('tenant-uuid-456');

    // Override to return empty families list
    server.use(
      http.get(`${API_BASE}/tenants`, () => {
        return HttpResponse.json([]);
      })
    );

    renderWithProviders(
      <Routes>
        <Route
          path="/app/:familyId/*"
          element={
            <FamilyGuard>
              <FamilyProvider>
                <FamilyContextDisplay />
              </FamilyProvider>
            </FamilyGuard>
          }
        />
      </Routes>,
      { initialEntries: ['/app/tenant-uuid-456/welcome'] }
    );

    // Should still render (family by ID may succeed even if list is empty)
    await waitFor(() => {
      expect(screen.getByTestId('families-count')).toHaveTextContent('0');
    });
  });
});
