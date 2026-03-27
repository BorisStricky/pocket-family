# 5. Sprint 1: App Shell + Family Context (1 week)

## Goal
Authenticated users can access the app shell with navigation, see their families, and switch between them. Foundation for all feature pages.

## Success Criteria
- [ ] AppShell layout works (TopNav + SideNav + main content area)
- [ ] User can see list of families they belong to
- [ ] User can switch between families (URL updates to `/app/:familyId/...`)
- [ ] Family context available throughout app
- [ ] Protected routes validate family membership
- [ ] Welcome/placeholder page shows after login

---

## Components Checklist

### Family Context & Hooks

| Done | Item | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | Family Context | `src/features/family/context/FamilyContext.tsx` | Global current family state | • Provide `currentFamily`, `families`, `switchFamily()`<br>• Read from URL param `:familyId`<br>• Sync with localStorage for default family |
| [ ] | useFamily | `src/features/family/hooks/useFamily.ts` | Hook to access family context | `const { currentFamily, families, switchFamily } = useFamily()` |
| [ ] | useFamilies | `src/features/family/hooks/useFamilies.ts` | Fetch user's families | • React Query hook<br>• Call `GET /tenants`<br>• Query key: `['families']` |
| [ ] | useFamilyById | `src/features/family/hooks/useFamilyById.ts` | Fetch single family | • Call `GET /tenants/{familyId}`<br>• Query key: `['family', familyId]`<br>• Validate membership |
| [ ] | useSwitchFamily | `src/features/family/hooks/useSwitchFamily.ts` | Switch family mutation | • Call `POST /tenants/{familyId}/switch`<br>• Update context<br>• Navigate to new family route |

### API Functions

| Done | Function | File Path | Method | Endpoint | Request | Response | Notes |
|------|----------|-----------|--------|----------|---------|----------|-------|
| [ ] | getFamilies | `src/features/family/api/familyApi.ts` | GET | `/tenants` | - | `TenantRead[]` | operationId: `list_tenants_tenants_get` |
| [ ] | getFamilyById | `src/features/family/api/familyApi.ts` | GET | `/tenants/{tenant_id}` | - | `TenantRead` | operationId: `get_tenant_tenants__tenant_id__get` |
| [ ] | switchFamily | `src/features/family/api/familyApi.ts` | POST | `/tenants/{tenant_id}/switch` | - | `TokenOut` | operationId: `switch_tenant_tenants__tenant_id__switch_post` |

**Type Reference (from OpenAPI):**
```typescript
interface TenantRead {
  id: string; // uuid
  name: string;
  created_at: string; // datetime
  updated_at: string; // datetime
}
```

### Routing Updates

| Done | Item | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | Update Router | `src/router/index.tsx` | Add family-scoped routes | • Add nested route: `/app/:familyId/*`<br>• Wrap with `FamilyGuard` component<br>• Add default redirect: `/app` → `/app/:defaultFamilyId/welcome` |
| [ ] | FamilyGuard | `src/components/FamilyGuard.tsx` | Validate family membership | • Extract `:familyId` from URL<br>• Call `useFamilyById(familyId)`<br>• Show error if 403/404<br>• Offer family switcher on error |

### UI Components (Organisms)

| Done | Component | File Path | Props | Story | Notes |
|------|-----------|-----------|-------|-------|-------|
| [ ] | AppShell | `src/components/ui/organisms/AppShell.tsx` | `children` | `Organisms/AppShell` | • TopNav + SideNav + main content area<br>• Responsive (drawer on mobile)<br>• Uses MUI `AppBar`, `Drawer`, `Box` |
| [ ] | TopNav | `src/components/ui/organisms/TopNav.tsx` | `onOpenNav, user?` | `Organisms/TopNav` | • Hamburger (mobile), app name, FamilySwitcherMini, Avatar menu |
| [ ] | SideNav | `src/components/ui/organisms/SideNav.tsx` | `activeRoute, open, onClose` | `Organisms/SideNav` | • Vertical nav with links<br>• Collapsible on mobile<br>• Highlight active route |
| [ ] | FamilySwitcherMini | `src/components/ui/molecules/FamilySwitcherMini.tsx` | `currentFamily, families, onSwitch` | `Molecules/FamilySwitcher` | • Dropdown in TopNav<br>• Shows current family name<br>• List of other families |
| [ ] | FamilyList | `src/features/family/components/FamilyList.tsx` | `families, onSelect` | `Features/FamilyList` | • Full-page family selector<br>• Card grid with family names |

### UI Components (Atoms - Additional)

| Done | Component | File Path | Props | Story | Notes |
|------|-----------|-----------|-------|-------|-------|
| [ ] | Avatar | `src/components/ui/atoms/Avatar.tsx` | `src?, name?, size?` | `Atoms/Avatar` | MUI Avatar with fallback to initials |
| [ ] | IconButton | `src/components/ui/atoms/IconButton.tsx` | `icon, onClick, ariaLabel` | `Atoms/IconButton` | MUI IconButton wrapper |

### Pages

| Done | Page | File Path | Route | Protected | Dependencies | Notes |
|------|------|-----------|-------|-----------|--------------|-------|
| [ ] | AppRoot | `src/features/app/pages/AppRoot.tsx` | `/app` | Yes | Redirect logic | Redirects to `/app/:defaultFamilyId/welcome` |
| [ ] | WelcomePage | `src/features/app/pages/WelcomePage.tsx` | `/app/:familyId/welcome` | Yes | FamilyContext | Simple placeholder: "Welcome to [Family Name]" |
| [ ] | FamiliesPage | `src/features/family/pages/FamiliesPage.tsx` | `/app/families` | Yes | FamilyList | Full list of families for switching |

### Testing

| Done | Test | File Path | Purpose | Notes |
|------|------|-----------|---------|-------|
| [ ] | FamilyContext tests | `src/features/family/__tests__/FamilyContext.test.tsx` | Test family context | Mock API, test switch logic |
| [ ] | FamilyGuard tests | `src/components/__tests__/FamilyGuard.test.tsx` | Test membership validation | Test 403 handling |
| [ ] | AppShell tests | `src/components/ui/organisms/__tests__/AppShell.test.tsx` | Test responsive nav | Test mobile drawer |

---

## Implementation Steps (Sprint 1)

### Step 1: Family API & Hooks
- [ ] Implement `familyApi.ts` (getFamilies, getFamilyById, switchFamily)
- [ ] Create React Query hooks: `useFamilies`, `useFamilyById`, `useSwitchFamily`
- [ ] Define `TenantRead` type in `src/types/`

### Step 2: Family Context
- [ ] Create `FamilyContext` with current family state
- [ ] Implement `useFamily` hook
- [ ] Sync family selection with URL param and localStorage

### Step 3: Routing & Guards
- [ ] Update router with `/app/:familyId/*` nested routes
- [ ] Create `FamilyGuard` component
- [ ] Add redirect logic from `/app` to default family
- [ ] Test 403/404 handling for invalid family IDs

### Step 4: AppShell Layout
- [ ] Build `TopNav` component (hamburger, app name, family switcher, avatar menu)
- [ ] Build `SideNav` component (vertical nav links)
- [ ] Build `AppShell` organism (compose TopNav + SideNav + content area)
- [ ] Make responsive (drawer on mobile)

### Step 5: Family Switcher UI
- [ ] Build `FamilySwitcherMini` dropdown for TopNav
- [ ] Build `FamilyList` component for full-page selector
- [ ] Create `FamiliesPage` at `/app/families`

### Step 6: Welcome Page
- [ ] Create simple `WelcomePage` showing family name
- [ ] Use as default landing after login
- [ ] Add quick actions (Add Transaction, View Transactions)

### Step 7: Testing & Polish
- [ ] Test family switching flow
- [ ] Test invalid family ID handling
- [ ] Test mobile responsive navigation
- [ ] Add loading states for family data

---

## API Endpoints Reference (Sprint 1)

| Endpoint | Method | operationId | Request | Response | Notes |
|----------|--------|-------------|---------|----------|-------|
| `/tenants` | GET | `list_tenants_tenants_get` | - | `TenantRead[]` | List user's families |
| `/tenants/{tenant_id}` | GET | `get_tenant_tenants__tenant_id__get` | - | `TenantRead` | Get single family details |
| `/tenants/{tenant_id}/switch` | POST | `switch_tenant_tenants__tenant_id__switch_post` | - | `TokenOut` | Switch active family, returns new token with family scope |

---

## Notes & Assumptions

- **Default family:** After login, redirect to user's preferred family (in the the access token)
- **Family switcher:** Always visible in TopNav for quick access
- **URL structure:** All feature routes include `:familyId` (e.g., `/app/:familyId/transactions`)
- **Backend validation:** Backend validates family membership on every API call
- **Error handling:** Show friendly error + family switcher if user tries to access unauthorized family

---