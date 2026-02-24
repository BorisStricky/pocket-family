# Mobile-Ready: Responsive Layout & UI Polish

**Branch:** `mobile-ready` → `master`
**Last Updated:** 2026-02-20

## Overview

This changeset transforms the application from a desktop-only layout into a fully responsive interface that works across mobile and desktop viewports. The primary changes introduce a hamburger-menu-driven sidebar that renders as a persistent drawer on desktop and a full-screen temporary overlay on mobile, along with a series of smaller UI polish improvements to prevent overflow, hide redundant content on small screens, and fix underlying test infrastructure bugs.

## Goals Achieved

- ✅ **Responsive Sidebar**: SideNav switches between `persistent` (desktop ≥900px) and `temporary` (mobile) MUI Drawer variants controlled by `useMediaQuery`
- ✅ **Hamburger Menu**: TopNav gains a `MenuIcon` button that toggles the sidebar; hidden in global mode
- ✅ **Content Shift on Desktop**: Main content area shifts right with a smooth CSS transition when the persistent drawer opens
- ✅ **Mobile Auto-Close**: SideNav auto-closes after navigation on mobile and when viewport shrinks below breakpoint
- ✅ **Layout Constants**: `LAYOUT.DRAWER_WIDTH` extracted to `constants.ts` to keep width value in sync across components
- ✅ **Overflow Prevention**: Family name truncation in `FamilySwitcherMini`, app title hidden on mobile, dashboard title condensed
- ✅ **Responsive Chart**: Spending pie chart legend hidden on mobile to prevent overcrowding
- ✅ **Responsive Card Grid**: `FamilyList` replaced MUI `Grid` with flexbox `Box` for predictable equal-width cards
- ✅ **Local Network Access**: CORS and Docker env updated to support testing on a physical device via LAN
- ✅ **Test Bug Fixes**: MSW handler query param keys corrected; `QueryClient` in test wrapper stabilized with `useState`
- ✅ **Test Assertion Updates**: BRL currency assertions updated to match `R$ 0,00` format

---

## Architecture & Tech Stack Changes

> [!info] Related Concepts
> - [[../knowledge/glossary/ui-components-design|UI Components & Design]] — MUI Drawer variants, breakpoints, responsive layout
> - [[../knowledge/glossary/react-patterns-hooks|React Patterns & Hooks]] — `useMediaQuery`, `useState`, `useEffect` for responsive state
> - [[../knowledge/glossary/testing|Testing]] — MSW handler fixes and QueryClient stability in Vitest
> - [[../knowledge/glossary/project-structure-concepts|Project Structure]] — Layout constants centralized in `constants.ts`

### New Pattern: Controlled Responsive Drawer

Previously `SideNav` used MUI's `permanent` variant with no open/close state. This worked only on desktop. The new pattern lifts drawer state into `AppShell`:

```
AppShell (owns state)
  ├── sideNavigationOpen: boolean  ← useState, default true on desktop
  ├── isMobileViewport: boolean    ← useMediaQuery(theme.breakpoints.down('md'))
  ├── TopNav ← receives onMenuClick (toggle handler)
  └── SideNav ← receives open, onClose, isMobileViewport
```

On **desktop**: `SideNav` renders as `variant="persistent"` — the drawer takes space in document flow and the main `<Box>` receives `ml: DRAWER_WIDTH` with a smooth CSS `margin` transition.

On **mobile**: `SideNav` renders as `variant="temporary"` — the drawer is a full-viewport-width overlay with a close button in the toolbar. It closes automatically after any menu item is clicked.

### Centralized Layout Constant

`DRAWER_WIDTH` was previously a magic number (`240`) hard-coded directly in `SideNav`. It is now exported from `constants.ts` as `LAYOUT.DRAWER_WIDTH` and imported by both `SideNav` and `AppShell` to keep them in sync.

### Local Network Testing Support

The `VITE_API_URL` Docker environment variable was updated to a LAN IP so the app can be tested on a physical mobile device on the same network. The FastAPI CORS `allow_origins` list was expanded with the same IP+port to allow cross-origin requests from the device.

---

## Directory Structure

```
frontend/src/
  __tests__/
    ✏️ dashboard.integration.test.tsx  — Updated BRL currency assertions
  components/ui/
    molecules/
      ✏️ FamilySwitcherMini.tsx        — Added overflow truncation styles
    organisms/
      ✏️ AppShell.tsx                  — Responsive drawer state management
      ✏️ SideNav.tsx                   — Persistent/temporary variant switching
      ✏️ TopNav.tsx                    — Hamburger menu button added
  features/
    dashboard/
      components/
        ✏️ SpendingByCategory.tsx      — Legend hidden on mobile
      pages/
        ✏️ DashboardPage.tsx           — Title condensed on mobile
    family/
      components/
        ✏️ FamilyList.tsx              — Grid → flexbox Box layout
  lib/
    ✏️ constants.ts                    — LAYOUT.DRAWER_WIDTH constant added
  test/
    mocks/handlers/
      ✏️ transactions.ts               — Fixed start/end query param names
    ✏️ utils.tsx                       — QueryClient stabilized with useState

backend/api/app/
  ✏️ main.py                           — LAN IP added to CORS allow_origins

docker-compose.dev.yml                 ✏️ VITE_API_URL updated to LAN IP
```

---

## Files Changed — Detailed Breakdown

### Shell & Navigation (Core Responsive Work)

**`frontend/src/components/ui/organisms/AppShell.tsx`** — MODIFIED
- **Purpose**: Root layout container that orchestrates TopNav, SideNav, and the scrollable content area.
- **Key Changes**: Added `useState` for `sideNavigationOpen`, `useMediaQuery` for `isMobileViewport`. `useEffect` auto-closes the drawer when viewport shrinks. Toggle and close callbacks passed down to child components. Main content `<Box>` now receives a `ml` value equal to `LAYOUT.DRAWER_WIDTH` when the persistent drawer is open, with a smooth `margin` CSS transition.
- **Impact**: All responsive behavior is centralized here; TopNav and SideNav become controlled components with no internal drawer state.

**`frontend/src/components/ui/organisms/SideNav.tsx`** — MODIFIED
- **Purpose**: Sidebar navigation drawer with page links.
- **Key Changes**: Converted from a `permanent` (always-visible) drawer to a `persistent` (desktop) or `temporary` (mobile) drawer controlled by new `open`, `onClose`, and `isMobileViewport` props. On mobile, the drawer spans `100vw` and includes a `CloseIcon` button in the toolbar. Menu item `onClick` calls `onClose` on mobile. `keepMounted: true` on the MUI Modal avoids re-mounting drawer DOM on every toggle.
- **Impact**: Navigation is now accessible on mobile via hamburger menu without breaking the desktop layout.

**`frontend/src/components/ui/organisms/TopNav.tsx`** — MODIFIED
- **Purpose**: Fixed app bar at the top with branding, family switcher, and user menu.
- **Key Changes**: New optional `onMenuClick` prop; when provided, a `MenuIcon` `IconButton` is rendered as the leftmost element. App title (`"Personal Finance"`) gains `display: { xs: 'none', md: 'block' }` to hide on mobile and free up horizontal space. Back button loses the `edge="start"` attribute (now used by the hamburger button instead). `FamilySwitcherMini` container gets `minWidth: 0` to allow MUI to shrink it.
- **Impact**: Toolbar is usable at all widths; hamburger is only shown in family mode (not global mode).

### UI Polish

**`frontend/src/components/ui/molecules/FamilySwitcherMini.tsx`** — MODIFIED
- **Purpose**: Compact dropdown button for switching between family tenants in the top nav.
- **Key Changes**: Added `maxWidth: { xs: 200, sm: 280 }`, `overflow: hidden`, `textOverflow: ellipsis`, `whiteSpace: nowrap` so long family names do not overflow the fixed-width toolbar on narrow screens.
- **Impact**: Prevents horizontal scroll caused by extremely long tenant names.

**`frontend/src/features/family/components/FamilyList.tsx`** — MODIFIED
- **Purpose**: Grid of family/tenant cards shown on the family picker page.
- **Key Changes**: Replaced MUI `Grid` container+item pattern with a flexbox `Box` (`display: flex`, `flexWrap: wrap`, `gap: 3`) and fixed-width inner `Box` (`width: 340`, `maxWidth: '100%'`). This avoids the MUI v5 Grid deprecation path and gives all cards a uniform width regardless of count.
- **Impact**: Cards are visually consistent on all screen sizes; eliminates dependency on deprecated MUI Grid.

**`frontend/src/features/dashboard/components/SpendingByCategory.tsx`** — MODIFIED
- **Purpose**: Recharts pie chart showing spending breakdown by category.
- **Key Changes**: Added `useMediaQuery` check; the Recharts `<Legend />` component is omitted when `isMobileViewport` is true. This prevents the legend from overlapping the chart on small screens.
- **Impact**: Chart remains readable on mobile without requiring explicit height adjustments.

**`frontend/src/features/dashboard/pages/DashboardPage.tsx`** — MODIFIED
- **Purpose**: Main dashboard page with KPI cards, chart, and recent transactions.
- **Key Changes**: Added `useMediaQuery` check; the page title changes from `"Dashboard - FamilyName"` to just `"Dashboard"` on mobile, saving horizontal space in the header row that also contains the date range toggle buttons.
- **Impact**: Header row no longer wraps or overflows on narrow screens.

### Shared Constants

**`frontend/src/lib/constants.ts`** — MODIFIED
- **Purpose**: Centralized app-wide constants (storage keys, API endpoints, routes).
- **Key Changes**: Added `LAYOUT` export object containing `DRAWER_WIDTH: 240`. This was previously a magic number defined inline in `SideNav.tsx`.
- **Impact**: Single source of truth for drawer width; changing it in one place updates both `SideNav` and `AppShell`.

### Infrastructure / Network

**`backend/api/app/main.py`** — MODIFIED
- **Purpose**: FastAPI application entry point with CORS middleware configuration.
- **Key Changes**: Added `http://192.168.1.101:5173` to the CORS `allow_origins` list.
- **Impact**: Enables the frontend served from a LAN IP (e.g., on a physical mobile device on the same Wi-Fi network) to make API requests without CORS rejection.

**`docker-compose.dev.yml`** — MODIFIED
- **Purpose**: Docker Compose configuration for local development environment.
- **Key Changes**: `VITE_API_URL` changed from `http://localhost:8000` to `http://192.168.1.101:8000` so the frontend built inside Docker references the host machine's LAN IP rather than `localhost` (which from inside a container resolves to the container itself).
- **Impact**: Required for physical device testing; **should be reverted or made configurable before merging to main** if the LAN IP is environment-specific.

---

## Testing Strategy

> [!info] Testing Resources
> See [[../knowledge/glossary/testing|Testing]] for project-wide Vitest + React Testing Library + MSW patterns.

### Test Bug Fixes

**`frontend/src/test/mocks/handlers/transactions.ts`** — MODIFIED
- **Fix**: MSW handler was reading `start_date` and `end_date` from the query string, but the actual API client sends `start` and `end`. The handler was therefore returning all transactions regardless of the selected date range, causing false-positive test passes. Fixed to read the correct param names.
- **Impact**: Date range filter tests now accurately reflect real API behavior.

**`frontend/src/test/utils.tsx`** — MODIFIED
- **Fix**: `AllProviders` wrapper was calling `createTestQueryClient()` directly in the render function body, which created a new `QueryClient` instance on every render. React Query cancels all in-flight queries when its client reference changes, causing intermittent test failures for async data fetches. Wrapping initialization in `useState(() => createTestQueryClient())` guarantees the same client instance is used across re-renders.
- **Impact**: Eliminates a class of flaky tests where queries appeared to never resolve.

### Test Assertion Updates

**`frontend/src/__tests__/dashboard.integration.test.tsx`** — MODIFIED
- Updated expected currency strings from `$0.00` (USD) to `R$ 0,00` (BRL) to match the Sprint 7 currency localization.
- Added comment explaining that `Intl.NumberFormat` outputs a non-breaking space between `R$` and the number, which Testing Library's default text normalizer collapses to a regular space.

---

## Migration Notes

> [!warning] Docker Environment Variable
> `VITE_API_URL` in `docker-compose.dev.yml` is set to a specific LAN IP (`192.168.1.101`). This is environment-specific and will break for other developers whose machine has a different IP. **Before merging to main**, consider:
> - Reverting to `http://localhost:8000` as the default
> - Or using a `.env` file on each machine to override `VITE_API_URL`

> [!warning] CORS Origin
> The LAN IP `http://192.168.1.101:5173` added to `backend/api/app/main.py` is also environment-specific. Same recommendation applies.

---

## Next Steps / Follow-up Work

- **Revert or parameterize** the LAN IP in `docker-compose.dev.yml` and `main.py` before merging
- **Persist sidebar preference** in `localStorage` so returning desktop users don't have to re-open the sidebar on page refresh
- **Write new tests** for the hamburger menu toggle interaction and mobile SideNav overlay behavior
- **Storybook stories** for the updated `SideNav` and `TopNav` with mobile viewport args

---

## Related Documentation

- [[../knowledge/glossary/ui-components-design|UI Components & Design]] — MUI Drawer, breakpoints, responsive patterns
- [[../knowledge/glossary/react-patterns-hooks|React Patterns & Hooks]] — `useMediaQuery`, lifted state, controlled components
- [[../knowledge/glossary/testing|Testing]] — MSW, Vitest, React Testing Library patterns
- [[../knowledge/glossary/project-structure-concepts|Project Structure & Concepts]] — Constants organization, feature module layout
- [[../knowledge/glossary/state-management|State Management]] — React Query client stability in tests
