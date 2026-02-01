# Sprint 7: Reports, Budgets & Settings (1 week)

## Goal
Add remaining MVP pages: Reports (generate/export), Budgets (spending limits), and Settings (user profile, integrations). Completes core feature set.

## Success Criteria
- [ ] Users can generate reports with date range and filters
- [ ] Reports can be exported to CSV/PDF
- [ ] Users can create and manage budgets per category
- [ ] Settings page allows updating profile
- [ ] All core MVP features complete

---

## Components Checklist

### Reports Hooks

| Done | Hook | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | useGenerateReport | `src/features/reports/hooks/useGenerateReport.ts` | Generate report mutation | • Call `POST /reports`<br>• Returns report data or file URL |

### Budgets Hooks

| Done | Hook | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | useBudgets | `src/features/budgets/hooks/useBudgets.ts` | Fetch budgets list | • Query key: `['budgets', familyId]`<br>• Call `GET /budgets` |
| [ ] | useCreateBudget | `src/features/budgets/hooks/useCreateBudget.ts` | Create budget mutation | • Call `POST /budgets` |
| [ ] | useUpdateBudget | `src/features/budgets/hooks/useUpdateBudget.ts` | Update budget mutation | • Call `PUT /budgets/{id}` |
| [ ] | useDeleteBudget | `src/features/budgets/hooks/useDeleteBudget.ts` | Delete budget mutation | • Call `DELETE /budgets/{id}` |

### Settings Hooks

| Done | Hook | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | useUpdateProfile | `src/features/settings/hooks/useUpdateProfile.ts` | Update user profile mutation | • Call `PUT /me`<br>• Update name, email, etc. |

### API Functions

| Done | Function | File Path | Method | Endpoint | Request | Response | Notes |
|------|----------|-----------|--------|----------|---------|----------|-------|
| [ ] | generateReport | `src/features/reports/api/reportsApi.ts` | POST | `/reports` | Filters | Report data | Check OpenAPI for exact endpoint |
| [ ] | getBudgets | `src/features/budgets/api/budgetsApi.ts` | GET | `/budgets` | - | `BudgetRead[]` | Check OpenAPI |
| [ ] | createBudget | `src/features/budgets/api/budgetsApi.ts` | POST | `/budgets` | `BudgetCreate` | `BudgetRead` | Check OpenAPI |
| [ ] | updateBudget | `src/features/budgets/api/budgetsApi.ts` | PUT | `/budgets/{id}` | `BudgetUpdate` | `BudgetRead` | Check OpenAPI |
| [ ] | deleteBudget | `src/features/budgets/api/budgetsApi.ts` | DELETE | `/budgets/{id}` | - | `{ok: true}` | Check OpenAPI |
| [ ] | updateProfile | `src/features/settings/api/settingsApi.ts` | PUT | `/me` | Profile update | User object | Check OpenAPI |

### Feature Components (Reports)

| Done | Component | File Path | Props | Used In | Notes |
|------|-----------|-----------|-------|---------|-------|
| [ ] | ReportsFilters | `src/features/reports/components/ReportsFilters.tsx` | `filters, onChange` | Reports page | • Date range, category, account filters<br>• Report type select |
| [ ] | ReportViewer | `src/features/reports/components/ReportViewer.tsx` | `reportData` | Reports page | • Display generated report<br>• Table or chart<br>• Export button |

### Feature Components (Budgets)

| Done | Component | File Path | Props | Used In | Notes |
|------|-----------|-----------|-------|---------|-------|
| [ ] | BudgetsList | `src/features/budgets/components/BudgetsList.tsx` | `budgets` | Budgets page | • List of budgets with progress bars<br>• Show spent / limit |
| [ ] | BudgetForm | `src/features/budgets/components/BudgetForm.tsx` | `mode, initialData?, onSubmit` | Budgets page | • Fields: category, amount, period<br>• Validation |

### Feature Components (Settings)

| Done | Component | File Path | Props | Used In | Notes |
|------|-----------|-----------|-------|---------|-------|
| [ ] | ProfileForm | `src/features/settings/components/ProfileForm.tsx` | `user, onSubmit` | Settings page | • Fields: name, email<br>• Password change (optional) |
| [ ] | IntegrationsList | `src/features/settings/components/IntegrationsList.tsx` | `integrations` | Settings page | • List of connected integrations<br>• Placeholder for future |

### Pages

| Done | Page | File Path | Route | Protected | Dependencies | Notes |
|------|------|-----------|-------|-----------|--------------|-------|
| [ ] | ReportsPage | `src/features/reports/pages/ReportsPage.tsx` | `/app/:familyId/reports` | Yes | ReportsFilters, ReportViewer | Generate and view reports |
| [ ] | BudgetsPage | `src/features/budgets/pages/BudgetsPage.tsx` | `/app/:familyId/budgets` | Yes | BudgetsList, BudgetForm | Manage budgets |
| [ ] | SettingsPage | `src/features/settings/pages/SettingsPage.tsx` | `/app/:familyId/settings` | Yes | ProfileForm, IntegrationsList | User settings |

### Testing

| Done | Test | File Path | Purpose | Notes |
|------|------|-----------|---------|-------|
| [ ] | ReportsPage tests | `src/features/reports/__tests__/ReportsPage.test.tsx` | Test report generation | Mock API |
| [ ] | BudgetForm tests | `src/features/budgets/__tests__/BudgetForm.test.tsx` | Test form validation | Required fields |

---

## Implementation Steps (Sprint 7)

### Step 1: Reports API & Hooks
- [ ] Check OpenAPI for reports endpoint
- [ ] Implement `reportsApi.ts`
- [ ] Create `useGenerateReport` hook

### Step 2: Reports Page
- [ ] Build `ReportsFilters` component
- [ ] Build `ReportViewer` component
- [ ] Create `ReportsPage` with generate flow
- [ ] Add export to CSV/PDF (client-side or backend)

### Step 3: Budgets API & Hooks
- [ ] Check OpenAPI for budgets endpoints
- [ ] Implement `budgetsApi.ts` (CRUD)
- [ ] Create hooks: `useBudgets`, `useCreateBudget`, etc.

### Step 4: Budgets Page
- [ ] Build `BudgetsList` component with progress bars
- [ ] Build `BudgetForm` component
- [ ] Create `BudgetsPage` with CRUD flow
- [ ] Show budget alerts (over budget warning)

### Step 5: Settings API & Hooks
- [ ] Implement `settingsApi.ts` (update profile)
- [ ] Create `useUpdateProfile` hook

### Step 6: Settings Page
- [ ] Build `ProfileForm` component
- [ ] Build `IntegrationsList` (placeholder)
- [ ] Create `SettingsPage`
- [ ] Add logout button

### Step 7: Testing & Polish
- [ ] Test report generation with filters
- [ ] Test budget CRUD flow
- [ ] Test profile update
- [ ] Add loading states
- [ ] Add success/error toasts

---

## API Endpoints Reference (Sprint 7)

**Note:** Check OpenAPI spec for exact endpoints.

**Reports:**
| Endpoint | Method | Request | Response | Notes |
|----------|--------|---------|----------|-------|
| `/reports` | POST | Filters | Report data | Generate report |

**Budgets:**
| Endpoint | Method | Request | Response | Notes |
|----------|--------|---------|----------|-------|
| `/budgets` | GET | - | `BudgetRead[]` | List budgets |
| `/budgets` | POST | `BudgetCreate` | `BudgetRead` | Create budget |
| `/budgets/{id}` | PUT | `BudgetUpdate` | `BudgetRead` | Update budget |
| `/budgets/{id}` | DELETE | - | `{ok: true}` | Delete budget |

**Settings:**
| Endpoint | Method | Request | Response | Notes |
|----------|--------|---------|----------|-------|
| `/me` | PUT | Profile update | User object | Update profile |

---

## Notes & Assumptions

- **Reports:** Export client-side using libraries (csv-export, jsPDF)
- **Budgets:** Period options: monthly, quarterly, yearly
- **Budget alerts:** Backend can send notifications (optional)
- **Settings:** Password change via separate endpoint (optional)
- **Integrations:** Placeholder for future (Plaid, bank sync)
