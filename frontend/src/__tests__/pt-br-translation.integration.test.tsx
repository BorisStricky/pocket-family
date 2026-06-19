// Integration test proving that the pt-BR translation reaches the product UI body —
// not just the nav chrome. The existing language-switcher test already asserts that
// SideNav labels re-localize; this test deliberately targets the TransactionsPage body
// (the "Add Transaction" button) to prove translation propagates into feature pages.

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, setupAuthenticatedUser } from '@/test/utils';
import { resetTransactionStore } from '@/test/mocks/server';
import { TransactionsPage } from '@/features/transactions/pages';
import AppShell from '@/components/ui/organisms/AppShell';
import { FamilyProvider } from '@/features/family/context/FamilyContext';

// The tenant ID used by setupAuthenticatedUser and the default MSW transaction store
const TENANT_ID = 'tenant-uuid-456';

// Route path matching the app's router configuration for family-scoped pages
const TRANSACTIONS_ROUTE = `/app/${TENANT_ID}/transactions`;

// Render TransactionsPage nested inside AppShell so the TopNav user menu is present.
// The language switcher lives in the TopNav user dropdown, so AppShell must be in the
// tree for the language-switch interaction to work. AppShell renders via <Outlet />,
// so TransactionsPage is a nested route child — matching the real app's router layout.
// FamilyProvider is required by TopNav and SideNav to read the current family context.
function renderTransactionsPageWithShell() {
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
        <Route path="transactions" element={<TransactionsPage />} />
      </Route>
    </Routes>,
    { initialEntries: [TRANSACTIONS_ROUTE] }
  );
}

// Open the user dropdown, then the nested Language submenu.
// Mirrors the exact helper used in language-switcher.integration.test.tsx.
async function openLanguageSubmenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /account of current user/i }));
  await user.click(await screen.findByText('Language'));
}

describe('pt-BR translation reaches TransactionsPage body', () => {
  beforeEach(() => {
    // Authenticate so API calls include the Authorization header and MSW returns data
    setupAuthenticatedUser(TENANT_ID);
    // Reset the in-memory transaction store so each test starts with a known dataset
    resetTransactionStore();
  });

  it('re-localizes the Add Transaction button from English to Portuguese after switching language', async () => {
    const user = userEvent.setup();
    renderTransactionsPageWithShell();

    // The "Add Transaction" button is rendered by TransactionsPage body — not the nav.
    // Confirm the English label is present first so we know the page has rendered.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
    });

    // Switch the app language to pt-BR using the same user-menu interaction
    // the language-switcher integration test uses: open user dropdown → Language submenu → select.
    await openLanguageSubmenu(user);
    await user.click(await screen.findByText('Português (BR)'));

    // After switching, the TransactionsPage body must re-render with pt-BR strings.
    // "Adicionar Transação" is the value of transactions.addTransaction in pt-BR.json.
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Adicionar Transação/i })
      ).toBeInTheDocument();
    });

    // The English label must be gone — confirming a real language switch, not a duplicate render.
    expect(screen.queryByRole('button', { name: /^add transaction$/i })).not.toBeInTheDocument();
  });
});
