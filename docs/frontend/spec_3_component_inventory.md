# SPEC-3 - Component Inventory (Atomic Design)

**Reference:** navigation & route map updated with family-switch flow. See navigation doc for route details. fileciteturn2file6

## Background

This inventory uses Atomic Design to enumerate UI components for the MVP React frontend (MUI v5 assumed). It includes atoms, molecules, organisms, page compositions, Storybook story names, and concise TypeScript prop/interface sketches. AG Grid gets thin wrapper components for domain tables.

---

## How to use this doc

- Frontend devs should create `src/components/atoms`, `.../molecules`, `.../organisms`, `.../pages` and Storybook stories matching the names below.
- Keep components small, strongly typed (TypeScript), and documented in Storybook.
- Family (tenant) terminology: UI strings must show "Family"; internal props may use `familyId`.

---

## Atoms (smallest building blocks)

- **Button** — `props: ButtonProps & {variant?: 'primary'|'secondary'|'ghost', size?: 'sm'|'md'|'lg'}`
  - Story: `Atoms/Button/Primary`, `Atoms/Button/Secondary`
- **Icon** — wrapper around lucide-react or MUI icons. `props: {name:string, size?:number, ariaHidden?:boolean}`
  - Story: `Atoms/Icon/IconSet`
- **Text / Typography** — `props: {variant:'h1'|'h2'|'body'|'caption', children:string}`
  - Story: `Atoms/Typography/AllVariants`
- **Input** — basic text input. `props: TextFieldProps` (MUI) with `name`, `value`, `onChange`.
  - Story: `Atoms/Input/Text`, `Atoms/Input/WithError`
- **Select** — single-select primitive. Use MUI Select with searchable option when needed.
  - Story: `Atoms/Select/Default`
- **Checkbox / Switch** — `props: {checked:boolean, onChange}`
  - Story: `Atoms/Checkbox/Switch`
- **Avatar** — `props: {src?:string, name?:string, size?:number}`
  - Story: `Atoms/Avatar/User`
- **Badge / Chip** — shows category chip with color. `props: {label, color?:string}`
  - Story: `Atoms/Chip/Category`
- **Modal / Dialog** — `props: {open:boolean, onClose, title?:string}` (wrap MUI Dialog)
  - Story: `Atoms/Modal/Default`
- **Tooltip** — small informative tooltip. Story: `Atoms/Tooltip/Default`
- **IconButton** — small circular button for actions. Story: `Atoms/IconButton/Default`
- **TableCellRenderer (small)** — simple cell render helpers (Currency, Date) used by AG Grid wrappers.

---

## Molecules (composed atoms)

- **SearchInput** — `Input` + clear button + debounce. `props: {value, onChange, placeholder}`
  - Story: `Molecules/SearchInput/Default`
- **FilterChipRow** — row of chips representing active filters with dismiss handlers.
  - Story: `Molecules/FilterChipRow/Active`
- **FileUploader** — drag/drop area + file list + progress. `props: {onUpload(files)}`
  - Story: `Molecules/FileUploader/CSV`
- **PaginationControls** — page size, page number, prev/next. `props: {page, pageSize, total, onPageChange}`
  - Story: `Molecules/Pagination/Default`
- **FormField** — label + input + hint + error; wraps MUI TextField with consistent spacing.
  - Story: `Molecules/FormField/Text`
- **ConfirmDialog** — title, body, confirm/cancel actions, used for destructive actions.
  - Story: `Molecules/ConfirmDialog/Delete`
- **FamilySwitcherMini** — small dropdown in top nav showing current Family and quick switch.
  - Story: `Molecules/FamilySwitcher/Mini`

---

## Organisms (complex components)

- **TopNav** — left: hamburger (mobile), center: app name, right: FamilySwitcherMini + Avatar menu. Props: `{onOpenNav, user}`. Story: `Organisms/TopNav/Default`
- **SideNav** — vertical nav with links; supports collapsed state. Props: `{activeRoute, onNavigate}`. Story: `Organisms/SideNav/Default`
- **AppShell** — composes TopNav, SideNav, main Outlet, Toasts, ErrorBoundary. Props: `{children, familyId}`. Story: `Organisms/AppShell/Default`
- **OverviewCard** — KPI card with number, delta, sparkline. Props: `{title, value, delta, sparklineData}`. Story: `Organisms/OverviewCard/All`
- **MiniChart** — small line/area chart used in cards (recharts or recharts-compatible). Story: `Organisms/MiniChart/Samples`
- **TransactionsFilterBar** — date range picker, search, category select, account select, export button. Props: `{filters, onChange}`. Story: `Organisms/TransactionsFilterBar/Default`
- **CategoryTree** — collapsible tree of categories with inline actions (add/edit/delete). Props: `{categories, onAdd, onEdit, onDelete}`. Story: `Organisms/CategoryTree/Default`

---

## Domain Organisms — AG Grid wrappers (important)

### AgTransactionsGrid (wrapper)
- Location: `src/components/organisms/ag/AgTransactionsGrid.tsx`
- Purpose: Centralize AG Grid config for transactions.
- Key props (TypeScript sketch):
```ts
type AgTransactionsGridProps = {
  familyId: string;
  queryParams?: TransactionsQuery;
  serverSide?: boolean; // enable server-side row model
  onRowClick?: (row: Transaction) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  initialSort?: {colId:string, asc:boolean}[];
}
```
- Events to expose: `onGridReady`, `onFilterChanged`, `onSortChanged`, `onRowDoubleClicked`.
- Integration: accept a `fetchRows` prop or internally call `useTransactions(familyId, queryParams)` when `serverSide=false`.
- Story: `Organisms/AgTransactionsGrid/Default` (with mocked data)

### AgAccountsGrid
- Props similar to transactions but typed for `Account` rows. Story: `Organisms/AgAccountsGrid/Default`

### ImportPreviewGrid
- Thin wrapper used in Import and Category import preview. Accepts `rows`, `columns`, `onConfirmImport`.
- Story: `Organisms/ImportPreviewGrid/CSVPreview`

### CategoryGrid (optional)
- AG Grid table for large category lists. Props: `{categories, onEdit, onDelete, onAdd}`. Story: `Organisms/CategoryGrid/Default`

---

## Templates / Page compositions (organisms + pages)

For each page below include a Storybook "Page/" story showing the full composition (desktop width and mobile width responsive variants).

- **DashboardPage** — composes `OverviewCard` grid, `MiniChart`, `RecentTransactions` (AgTransactionsGrid with limit). Story: `Pages/Dashboard/Default`
- **TransactionsPage** — `TransactionsFilterBar` + `AgTransactionsGrid` + `BulkActions` + `PaginationControls`. Story: `Pages/Transactions/List`
- **TransactionForm (page/modal)** — form fields, category select, account select, amount, datepicker. Story: `Pages/Transactions/Form/Create` and `.../Edit`
- **AccountsPage** — `AgAccountsGrid` + `AccountCard` components. Story: `Pages/Accounts/List`
- **FamilyPage** — `FamilyHeader` + `CategoryTree` (left) + `CategoryGrid` (right) + `InviteMember` area + `AddCategoryModal` flow. Story: `Pages/Family/Manage`
- **ImportPage** — `FileUploader` -> `ImportPreviewGrid` -> mapping UI -> confirm. Story: `Pages/Import/CSVFlow`
- **SettingsPage** — `ProfileForm`, `IntegrationsList`. Story: `Pages/Settings/Default`
- **OnboardingWizard** — stepper with sample data import, create first account, add categories. Story: `Pages/Onboarding/Flow`

---

## Modals & Dialogs (reusable)

- **AddCategoryModal** — form: name, parent select, color picker, icon. Hook: `useCreateCategory`. Story: `Modals/Category/Add`
- **EditCategoryModal** — same as create but prefilled. Hook: `useUpdateCategory`. Story: `Modals/Category/Edit`
- **DeleteCategoryConfirm** — shows affected transaction count and reassign option. Hook: `useDeleteCategory`. Story: `Modals/Category/DeleteConfirm`
- **AddTransactionModal** — reusable transaction form modal. Story: `Modals/Transaction/Add`
- **ImportMappingModal** — mapping CSV columns to account/category fields. Story: `Modals/Import/Mapping`

---

## Hooks to implement (frontend data layer)

- `useMe()` → `GET /me` (prefetch on AppShell)
- `useFamilies()` → `GET /tenants` (Family list)
- `useFamily(familyId)` → `GET /tenants/{familyId}` (validate family membership)
- `useTransactions(familyId, params)` → `GET /transactions?familyId={familyId}`
- `useTransaction(familyId, transactionId)` → `GET /transactions/{transactionId}`
- `useCreateTransaction()` → `POST /transactions` (include familyId in body)
- `useCategories(familyId)` → `GET /tenants/{familyId}/categories`
- `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()`

Naming: include `familyId` in hook params; use React Query keys like `['transactions', familyId, params]`.

---

## Storybook & Testing guidance

- Create stories for every atom → molecule → organism → page composition. Use mock data fixtures in `storybook/mocks/`.
- Visual tests: Chromatic or Storybook Snapshot tests for critical components (TransactionForm, AgTransactionsGrid, CategoryTree).
- Accessibility: run axe on stories for atoms and molecules.

---

## Deliverables for the frontend team (from this doc)

1. Storybook stories scaffolding for all components listed.  
2. `src/components` skeleton with typed props and basic unit tests.  
3. AG Grid wrapper components with mocked stories and docs showing integration patterns.  

---

If this Component Inventory looks good, I will:  
1) generate TypeScript interface files for the key components (e.g., `AgTransactionsGridProps`, `TransactionFormProps`, `Category` model) and  
2) map each page to exact operationIds/paths in `/mnt/data/openAPI_spec.json` to feed the hooks (unless you want me to do a different next step).

*Author:* Software Architect GPT

