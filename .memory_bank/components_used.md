# Frontend Components Inventory - Implementation Status

**Last Updated**: Sprint 3 Milestone 4 Complete (2026-01-27)

This document tracks which components have been implemented in the Personal Finance application, organized by Sprint and feature area.

## Sprint 0: Authentication & Foundation

Sprint 0 established the core authentication system and foundation components. Focus was on minimal UI components needed for auth flows (login, signup, protected routes).

---

## ✅ IMPLEMENTED COMPONENTS

### Atoms (11/12 implemented - Sprint 0)

| Component | File Path | Status | Used In Sprint 0 | Storybook |
|-----------|-----------|--------|------------------|-----------|
| **Avatar** | `src/components/atoms/Avatar.tsx` | ✅ Sprint 0 | AppShell | ✅ Yes |
| **Button** | `src/components/atoms/Button.tsx` | ✅ Sprint 0 | Landing, Login, Signup, AuthForm | ✅ Yes |
| **Checkbox** | `src/components/atoms/Checkbox.tsx` | ✅ Sprint 0 | Not used yet (pre-built) | ✅ Yes |
| **Chip** | `src/components/atoms/Chip.tsx` | ✅ Sprint 0 | Not used yet (pre-built) | ✅ Yes |
| **Icon** | `src/components/atoms/Icon.tsx` | ✅ Sprint 0 | Landing, AppShell | ✅ Yes |
| **IconButton** | `src/components/atoms/IconButton.tsx` | ✅ Sprint 0 | Not used yet (pre-built) | ✅ Yes |
| **Input** | `src/components/atoms/Input.tsx` | ✅ Sprint 0 | AuthForm (login/signup) | ✅ Yes |
| **Modal** | `src/components/atoms/Modal.tsx` | ✅ Sprint 0 | Not used yet (pre-built) | ✅ Yes |
| **Select** | `src/components/atoms/Select.tsx` | ✅ Sprint 0 | Not used yet (pre-built) | ✅ Yes |
| **Typography** | `src/components/atoms/Typography.tsx` | ✅ Sprint 0 | All pages | ❌ No story |
| **Index** | `src/components/atoms/index.ts` | ✅ Sprint 0 | Barrel export for atoms | N/A |

**Missing Atoms**:
- ❌ Tooltip (Future sprint)
- ❌ TableCellRenderer helpers (Currency, Date formatting)

---

### Molecules (2 implemented - Pre-built for Future)

| Component | File Path | Status | Used In Sprint 0 | Storybook |
|-----------|-----------|--------|------------------|-----------|
| **TransactionListItem** | `src/components/molecules/TransactionListItem.tsx` | ✅ Sprint 0 (Pre-built) | Not used yet | ✅ Yes |
| **TransactionsFilterBar** | `src/components/molecules/TransactionsFilterBar.tsx` | ✅ Sprint 0 (Pre-built) | Not used yet | ✅ Yes |

**Note**: These were pre-built for future transaction features (Sprint 1+).

**Missing Molecules** (Future sprints):
- ❌ SearchInput (debounced search)
- ❌ FilterChipRow
- ❌ FileUploader
- ❌ PaginationControls
- ❌ FormField
- ❌ ConfirmDialog
- ❌ FamilySwitcherMini

---

### Organisms (2 implemented - Pre-built for Future)

| Component | File Path | Status | Used In Sprint 0 | Storybook |
|-----------|-----------|--------|------------------|-----------|
| **TransactionsList** | `src/components/organisms/TransactionsList.tsx` | ✅ Sprint 0 (Pre-built) | Not used yet | ✅ Yes |
| **TransactionsGrid** | `src/components/organisms/TransactionsGrid.tsx` | ✅ Sprint 0 (Pre-built) | Not used yet | ✅ Yes |

**Note**: AG Grid-based components pre-built for Sprint 1+ transaction features.

**Missing Organisms** (Future sprints):
- ❌ TopNav
- ❌ SideNav
- ❌ OverviewCard
- ❌ MiniChart
- ❌ CategoryTree
- ❌ AgAccountsGrid
- ❌ ImportPreviewGrid
- ❌ CategoryGrid

---

### Auth Components (Sprint 0 - Core Feature)

| Component | File Path | Status | Used In Sprint 0 | Notes |
|-----------|-----------|--------|------------------|-------|
| **AuthForm** | `src/features/auth/components/AuthForm.tsx` | ✅ Sprint 0 | Login, Signup pages | Reusable form with mode='login'\|'signup' |
| **ProtectedRoute** | `src/components/ProtectedRoute.tsx` | ✅ Sprint 0 | /app route guard | Tests: 7 tests in ProtectedRoute.test.tsx |

### Pages (Sprint 0)

| Page | File Path | Status | Purpose |
|------|-----------|--------|---------|
| **LandingPage** | `src/pages/landing_page.tsx` | ✅ Sprint 0 | Public homepage with hero, features |
| **LoginPage** | `src/pages/login_page.tsx` | ✅ Sprint 0 | Login with useLogin hook |
| **SignupPage** | `src/pages/signup_page.tsx` | ✅ Sprint 0 | Signup with useSignup hook |
| **AppShell** | `src/pages/app_shell.tsx` | ✅ Sprint 0 | Authenticated app layout with header, logout |

### Account Pages (Sprint 3)

| Page | File Path | Status | Purpose |
|------|-----------|--------|---------|
| **AccountsPage** | `src/features/accounts/pages/AccountsPage.tsx` | ✅ Sprint 3 | Family-scoped accounts list |
| **AddAccountPage** | `src/features/accounts/pages/AddAccountPage.tsx` | ✅ Sprint 3 | Create account with family sharing |
| **EditAccountPage** | `src/features/accounts/pages/EditAccountPage.tsx` | ✅ Sprint 3 | Edit existing account |
| **FamilyAccountDetailPage** | `src/features/accounts/pages/FamilyAccountDetailPage.tsx` | ✅ Sprint 3 | Account detail within family context |
| **AllAccountsPage** | `src/features/accounts/pages/AllAccountsPage.tsx` | ✅ Sprint 3 M4 | Global view of all user accounts |
| **GlobalAccountDetailPage** | `src/features/accounts/pages/GlobalAccountDetailPage.tsx` | ✅ Sprint 3 M4 | Account detail in global context |
| **GlobalAddAccountPage** | `src/features/accounts/pages/GlobalAddAccountPage.tsx` | ✅ Sprint 3 M4 | Create account without family sharing |

### Forms (Pre-built for Future)

| Component | File Path | Status | Used In Sprint 0 |
|-----------|-----------|--------|------------------|
| **TransactionForm** | `src/components/TransactionForm.tsx` | ✅ Sprint 0 (Pre-built) | Not used yet |

### Modals (Pre-built for Future)

| Component | File Path | Status | Used In Sprint 0 |
|-----------|-----------|--------|------------------|
| **TransactionDetailModal** | `src/components/modals/TransactionDetailModal.tsx` | ✅ Sprint 0 (Pre-built) | Not used yet |

**Missing Modals** (Future sprints):
- ❌ AddCategoryModal
- ❌ EditCategoryModal
- ❌ DeleteCategoryConfirm
- ❌ AddTransactionModal
- ❌ ImportMappingModal

---

## 📋 COMPONENT USAGE PATTERNS

### Transaction Type Definition
Located in: `frontend/src/components/molecules/TransactionListItem.tsx`

```typescript
export type Transaction = {
  id: string;
  tenant_id?: string;
  account_id?: string;
  account?: string; // display name
  category_id?: string | null;
  category?: string | null;
  transaction_date: string; // ISO date
  transaction_type?: 'expense' | 'income';
  amount: number | string; // cents (number) or decimal string
  currency?: string;
  created_by?: string;
  description?: string | null;
  title?: string | null;
  reconciled?: boolean;
  source?: 'manual' | 'recurring';
  avatarUrl?: string | null;
  recurring?: boolean;
};
```

### Currency Formatting
Implemented in both `TransactionListItem` and `TransactionsGrid`:
- Supports integer cents (e.g., 12345 → R$ 123.45)
- Supports decimal strings (e.g., "123.45")
- Uses Brazilian locale by default (`pt-BR`)

### Button Variants
- `primary` → MUI contained + primary color
- `secondary` → MUI outlined + inherit color
- `ghost` → MUI text + transparent background

---

## 🎯 NEXT COMPONENTS TO IMPLEMENT (Priority Order)

Based on typical feature development needs:

### High Priority:
1. **TopNav** + **SideNav** → Required for app navigation
2. **AppShell** → Verify/complete implementation in `app_shell.tsx`
3. **ConfirmDialog** → Used for delete confirmations
4. **AddCategoryModal** / **EditCategoryModal** → Category management
5. **OverviewCard** → Dashboard KPIs

### Medium Priority:
6. **CategoryTree** → Category management page
7. **SearchInput** → Debounced search component
8. **FileUploader** → Import feature
9. **FamilySwitcherMini** → Family context switching

### Low Priority:
10. **Tooltip** → Nice-to-have for better UX
11. **TableCellRenderer helpers** → Refactor from inline implementations
12. **AgAccountsGrid** → Accounts page
13. **ImportPreviewGrid** → Import preview

---

## 📝 IMPLEMENTATION NOTES

### Deviations from Spec:
1. **Typography variants**: Spec says `h1|h2|h3|subtitle|body|caption`, implementation uses Material-UI mapping internally
2. **Button sizes**: Spec says `sm|md|lg`, implementation uses `small|medium|large`
3. **TransactionForm**: Currently standalone in root components, not in a page/modal folder
4. **Pagination**: Using MUI Pagination directly instead of custom PaginationControls molecule

### Consistency Patterns:
- All atoms re-export as default + named export
- All components have TypeScript prop interfaces
- MUI components are wrapped with custom prop types
- Icon names use Lucide-react TypeScript typing

### Testing Status (Sprint 0):
- ✅ Storybook: 13 component stories created
- ✅ Unit Tests: 7 test suites, 80 tests passing
  - ProtectedRoute.test.tsx (7 tests)
  - AuthContext.test.tsx (17 tests)
  - useLogin.test.tsx (8 tests)
  - useSignup.test.tsx (10 tests)
  - useLogout.test.tsx (9 tests)
  - jwtUtils.test.ts (16 tests)
  - apiClient.test.ts (13 tests)
- ✅ Coverage: 90%+ on critical auth flows

---

## 🔄 UPDATE INSTRUCTIONS

When implementing new components, update this file with:
1. ✅ Status change in the relevant table
2. File path
3. Brief notes on implementation details
4. Any deviations from spec_3_component_inventory.md

**Format for additions**:
```markdown
| **ComponentName** | `frontend/src/components/path/File.tsx` | ✅ Complete | Notes about implementation |
```
