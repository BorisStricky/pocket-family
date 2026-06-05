// Integration tests for the language selection feature.
// Renders the authenticated AppShell (TopNav + SideNav) and exercises the
// language switcher in the user dropdown, asserting the UI re-localizes.

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser } from '@/test/utils';
import AppShell from '@/components/ui/organisms/AppShell';
import { FamilyProvider } from '@/features/family/context/FamilyContext';

// Render AppShell under a family-scoped route so SideNav can read :familyId and
// build its navigation. FamilyProvider supplies the family context TopNav reads;
// a trivial child element stands in for a real page.
function renderAuthenticatedShell() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/app/:familyId"
        element={
          <FamilyProvider>
            <AppShell />
          </FamilyProvider>
        }
      >
        <Route path="dashboard" element={<div>Dashboard Page Content</div>} />
      </Route>
    </Routes>,
    { initialEntries: ['/app/tenant-uuid-456/dashboard'] }
  );
}

// Open the user dropdown, then the nested Language submenu.
async function openLanguageSubmenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /account of current user/i }));
  await user.click(await screen.findByText('Language'));
}

describe('Language switcher', () => {
  beforeEach(() => {
    setupAuthenticatedUser('tenant-uuid-456');
  });

  it('renders navigation labels in English by default', async () => {
    renderAuthenticatedShell();

    // SideNav labels come from the en translation bundle.
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('switches navigation labels to Portuguese when selected from the user menu', async () => {
    const user = userEvent.setup();
    renderAuthenticatedShell();

    // Wait for the English nav to be present before switching.
    await screen.findByText('Dashboard');

    await openLanguageSubmenu(user);
    await user.click(await screen.findByText('Português (BR)'));

    // After switching, the SideNav re-renders with pt-BR labels.
    await waitFor(() => {
      expect(screen.getByText('Painel')).toBeInTheDocument();
    });
    // And the English label is gone — confirming a real language switch.
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('marks the active language with a check in the submenu', async () => {
    const user = userEvent.setup();
    renderAuthenticatedShell();
    await screen.findByText('Dashboard');

    // Switch to Portuguese first so it becomes the active language.
    await openLanguageSubmenu(user);
    await user.click(await screen.findByText('Português (BR)'));
    await screen.findByText('Painel');

    // Reopen the submenu — its trigger is now localized as "Idioma".
    await user.click(screen.getByRole('button', { name: /account of current user/i }));
    await user.click(await screen.findByText('Idioma'));

    // The active option (Português) should be marked selected.
    const activeOption = await screen.findByRole('menuitem', { name: /Português \(BR\)/ });
    expect(activeOption).toHaveClass('Mui-selected');
  });
});
