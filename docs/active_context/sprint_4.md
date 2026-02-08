# Sprint 4: Categories & Family Management (2 weeks)

## Goal

**Phase 1 (Week 1):** Users can manage categories in hierarchical tree structure and use them in transaction forms.
**Phase 2 (Week 2):** Users can create families, invite members, and manage family membership. Family settings page allows managing members, invites, and categories.

## Success Criteria

### Phase 1: Categories (Week 1)

- [x] Users can view category tree (parent-child hierarchy)
- [x] Users can create, edit, delete categories
- [x] Deleting category with transactions prompts reassignment
- [x] Category select work/s in transaction form

### Phase 2: Family Management (Week 2)

- [x] Users can create new families and become owners
- [x] Owners can invite users via email (creates pending memberships)
- [x] Users can view pending invitations (full acceptance flow pending backend)
- [x] Owners can remove members from their family
- [x] Members can leave families they don't own
- [x] Owners can delete families with proper safeguards
- [x] Family page shows members, settings, and categories
- [x] Owners CAN leave a family (backend restriction removed - CASCADE delete handles cleanup)

---

## Components Checklist

### Phase 1: Category Hooks

| Done | Hook              | File Path                                        | Purpose                  | Implementation Notes                                                                                                                          |
| ---- | ----------------- | ------------------------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [x]  | useCategories     | `src/features/family/hooks/useCategories.ts`     | Fetch categories list    | • Query key: `['categories', familyId]`<br>• Call `GET /categories`<br>• Tenant context from auth token                                       |
| [x]  | useCategory       | `src/features/family/hooks/useCategory.ts`       | Fetch single category    | • Query key: `['category', familyId, categoryId]`<br>• Call `GET /categories/{categoryId}`                                                    |
| [x]  | useCreateCategory | `src/features/family/hooks/useCreateCategory.ts` | Create category mutation | • Call `POST /categories`<br>• Invalidate categories list                                                                                     |
| [x]  | useUpdateCategory | `src/features/family/hooks/useUpdateCategory.ts` | Update category mutation | • Call `PATCH /categories/{categoryId}`<br>• Invalidate categories                                                                            |
| [x]  | useDeleteCategory | `src/features/family/hooks/useDeleteCategory.ts` | Delete category mutation | • Call `DELETE /categories/{categoryId}`<br>• Handle reassignment if has transactions. Select one category to inherit all linked transactions |

### Phase 2: Family Management Hooks

| Done | Hook            | File Path                                      | Purpose                | Implementation Notes                                                                                                     |
| ---- | --------------- | ---------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [x]  | useCreateFamily | `src/features/family/hooks/useCreateFamily.ts` | Create family mutation | • Call `POST /tenants`<br>• Invalidate families list<br>• Auto-switch to new family                                      |
| [x]  | useListMembers  | `src/features/family/hooks/useListMembers.ts`  | Fetch members list     | • Query key: `['members', familyId]`<br>• Call `GET /tenants/{familyId}/members`                                         |
| [x]  | useInviteMember | `src/features/family/hooks/useInviteMember.ts` | Invite member mutation | • Call `POST /tenants/{familyId}/members`<br>• Invalidate members list<br>• Owner only                                   |
| [x]  | useRemoveMember | `src/features/family/hooks/useRemoveMember.ts` | Remove member mutation | • Call `DELETE /tenants/{familyId}/members/{membershipId}`<br>• Owner only                                               |
| [x]  | useLeaveFamily  | `src/features/family/hooks/useLeaveFamily.ts`  | Leave family mutation  | • Call `DELETE /tenants/{familyId}/members/{membershipId}`<br>• Owners can also leave families<br>• Redirect after leaving |
| [x]  | useDeleteFamily | `src/features/family/hooks/useDeleteFamily.ts` | Delete family mutation | • Call `DELETE /tenants/{familyId}`<br>• Owner only<br>• Confirmation required<br>• Redirect to families list            |

### API Functions

**Phase 1: Category API Functions**

| Done | Function       | File Path                                  | Method | Endpoint                    | Request          | Response         | Notes                                                          |
| ---- | -------------- | ------------------------------------------ | ------ | --------------------------- | ---------------- | ---------------- | -------------------------------------------------------------- |
| [x]  | getCategories  | `src/features/family/api/categoriesApi.ts` | GET    | `/categories`               | -                | `CategoryRead[]` | operationId: `list_categories_categories_get`                  |
| [x]  | getCategory    | `src/features/family/api/categoriesApi.ts` | GET    | `/categories/{category_id}` | -                | `CategoryRead`   | operationId: `get_category_categories__category_id__get`       |
| [x]  | createCategory | `src/features/family/api/categoriesApi.ts` | POST   | `/categories`               | `CategoryCreate` | `CategoryRead`   | operationId: `create_category_categories_post`                 |
| [x]  | updateCategory | `src/features/family/api/categoriesApi.ts` | PATCH  | `/categories/{category_id}` | `CategoryUpdate` | `CategoryRead`   | operationId: `update_category_categories__category_id__patch`  |
| [x]  | deleteCategory | `src/features/family/api/categoriesApi.ts` | DELETE | `/categories/{category_id}` | -                | `{ok: true}`     | operationId: `delete_category_categories__category_id__delete` |

**Phase 2: Family Management API Functions**

| Done | Function     | File Path                              | Method | Endpoint                                       | Request            | Response           | Notes                                                                  |
| ---- | ------------ | -------------------------------------- | ------ | ---------------------------------------------- | ------------------ | ------------------ | ---------------------------------------------------------------------- |
| [x]  | createFamily | `src/features/family/api/familyApi.ts` | POST   | `/tenants`                                     | `TenantCreate`     | `TenantRead`       | Creates family, user becomes owner                                     |
| [x]  | listMembers  | `src/features/family/api/familyApi.ts` | GET    | `/tenants/{tenant_id}/members`                 | -                  | `MembershipRead[]` | operationId: `list_members_for_tenant_tenants__tenant_id__members_get` |
| [x]  | inviteMember | `src/features/family/api/familyApi.ts` | POST   | `/tenants/{tenant_id}/members`                 | `MembershipCreate` | `MembershipRead`   | Creates PENDING membership (OWNER only)                                |
| [x]  | removeMember | `src/features/family/api/familyApi.ts` | DELETE | `/tenants/{tenant_id}/members/{membership_id}` | -                  | `{ok: true}`       | Owner removes member                                                   |
| [x]  | leaveFamily  | `src/features/family/api/familyApi.ts` | DELETE | `/tenants/{tenant_id}/members/{membership_id}` | -                  | `{ok: true}`       | Member leaves - same endpoint as removeMember                          |
| [x]  | deleteFamily | `src/features/family/api/familyApi.ts` | DELETE | `/tenants/{tenant_id}`                         | -                  | `{ok: true}`       | Owner deletes family                                                   |

#### Type Reference (from OpenAPI)

**Category Types** (src/types/category.ts)

```typescript
interface CategoryCreate {
  name: string;
  kind: CategoryKind; // "expense" | "income"
  parent_id?: string | null; // uuid
}

interface CategoryRead {
  id: string; // uuid
  tenant_id: string;
  name: string;
  kind: CategoryKind;
  parent_id: string | null;
  created_at: string; // datetime
  updated_at: string; // datetime
  path?: string; // Full path like "Food > Restaurants" (computed field)
}

interface CategoryUpdate {
  name?: string | null;
  kind?: CategoryKind | null; // Can also update category kind
  parent_id?: string | null;
}

enum CategoryKind {
  EXPENSE = "expense",
  INCOME = "income",
}

// Family/Membership Types
interface TenantCreate {
  name: string;
}

interface MembershipCreate {
  user_email: string;
  role?: MembershipRole; // default: "member"
}

interface MembershipUpdate {
  role?: MembershipRole | null;
  status?: MembershipStatus | null;
}

interface MembershipRead {
  id: string; // uuid
  tenant_id: string; // uuid
  user_id: string | null; // uuid or null for pending
  user_email: string | null; // email for pending invites
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string; // ISO datetime
}

enum MembershipRole {
  OWNER = "owner",
  MEMBER = "member",
  VIEWER = "viewer",
}

enum MembershipStatus {
  ACTIVE = "active",
  PENDING = "pending",
  REVOKED = "revoked",
}
```

### Domain Components

**Phase 1: Category Components**

| Done | Component      | File Path                                  | Props                                 | Story                   | Notes                                                                                                                         |
| ---- | -------------- | ------------------------------------------ | ------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [x]  | CategoryTree   | `src/components/domain/CategoryTree.tsx`   | `categories, onAdd, onEdit, onDelete` | `Domain/CategoryTree`   | • Hierarchical tree view<br>• Collapsible nodes<br>• Inline actions (add child, edit, delete)<br>• Uses MUI TreeView |
| [x]  | CategorySelect | `src/components/domain/CategorySelect.tsx` | `value, onChange, kind?, familyId`    | `Domain/CategorySelect` | • Searchable dropdown<br>• Hierarchical display<br>• Filter by kind (expense/income)<br>• Used in transaction form            |

### Feature Components

**Phase 1: Category Feature Components**

| Done | Component             | File Path                                                  | Props                                       | Used In     | Notes                                                                                             |
| ---- | --------------------- | ---------------------------------------------------------- | ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| [x]  | AddCategoryModal      | `src/features/family/components/AddCategoryModal.tsx`      | `open, onClose, parentId?, kind?`           | Family page | • Form: name, kind, parent select<br>• Validation                                                 |
| [x]  | EditCategoryModal     | `src/features/family/components/EditCategoryModal.tsx`     | `open, onClose, category`                   | Family page | • Pre-filled form<br>• Can change name, parent, kind                                              |
| [x]  | DeleteCategoryConfirm | `src/features/family/components/DeleteCategoryConfirm.tsx` | `open, onClose, category, transactionCount` | Family page | • Show affected transaction count<br>• Option to reassign to another category<br>• Confirm delete |

**Phase 2: Family Management Feature Components**

| Done | Component         | File Path                                              | Props                            | Used In      | Notes                                                                                                                                                                                                                                                               |
| ---- | ----------------- | ------------------------------------------------------ | -------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [x]  | FamilyHeader      | `src/features/family/components/FamilyHeader.tsx`      | `family`                         | Family page  | • Family name<br>• Member count<br>• Settings button                                                                                                                                                                                                                |
| [x]  | MembersList       | `src/features/family/components/MembersList.tsx`       | `members, currentUserMembership` | Family page  | • List of family members<br>• Show status badges (active/pending/revoked)<br>• Show role badges (owner/member/viewer)<br>• Action menu per member (owner only): Remove member<br>• Highlight current user's membership<br>• Empty state for no members |
| [x]  | CreateFamilyModal | `src/features/family/components/CreateFamilyModal.tsx` | `open, onClose, onSuccess`       | FamiliesPage | • Form with family name input<br>• Validation (name required, min 2 chars)<br>• Auto-switch to new family after creation                                                                                                                                            |
| [x]  | InviteMemberModal | `src/features/family/components/InviteMemberModal.tsx` | `open, onClose, familyId`        | FamilyPage   | • Form: email input + role select<br>• Validation (email format)<br>• Success message: "Invitation sent to {email}"                                                                                                                                                 |
| [x]  | FamilySettings    | `src/features/family/components/FamilySettings.tsx`    | `family, currentUserMembership`  | FamilyPage   | • Shows family info<br>• "Leave Family" button<br>• "Delete Family" button (if owner)<br>• Confirmation dialogs for both actions                                                                                                                     |

### Pages

**Phase 1:**

| Done | Page       | File Path                                  | Route                   | Protected | Dependencies               | Notes                                             |
| ---- | ---------- | ------------------------------------------ | ----------------------- | --------- | -------------------------- | ------------------------------------------------- |
| [x]  | FamilyPage | `src/features/family/pages/FamilyPage.tsx` | `/app/:familyId/family` | Yes       | FamilyHeader, CategoryTree | Family page with Categories tab (Phase 1 version) |

**Phase 2:**

| Done | Page                  | File Path                                        | Route                   | Protected   | Dependencies                                            | Notes                                                                                   |
| ---- | --------------------- | ------------------------------------------------ | ----------------------- | ----------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [x]  | FamilyPage (Enhanced) | `src/features/family/pages/FamilyPage.tsx`       | `/app/:familyId/family` | Yes         | FamilyHeader, CategoryTree, MembersList, FamilySettings | Enhanced with Members tab and full family management                                    |
| [x]  | AcceptInvitePage      | `src/features/family/pages/AcceptInvitePage.tsx` | `/accept-invite`        | No (public) | -                                                       | Placeholder page showing invite token acceptance will be implemented (backend required) |

### Testing

**✅ Test Strategy Changed: Integration Tests Instead of Unit Tests**

Sprint 4 adopted integration testing approach. Old unit tests deleted and replaced with comprehensive integration test suites.

**Integration Test Suites (7 suites, 191+ tests)**

| Done | Test Suite                         | File Path                                           | Purpose                           | Coverage                          |
| ---- | ---------------------------------- | --------------------------------------------------- | --------------------------------- | --------------------------------- |
| [x]  | Categories Integration Tests      | `src/__tests__/categories.integration.test.tsx`     | Category CRUD workflows           | 28 tests covering all operations  |
| [x]  | Family Management Integration     | `src/__tests__/family-management.integration.test.tsx` | Family management workflows    | 45 tests (create, invite, remove, delete) |
| [x]  | Accounts Integration Tests        | `src/__tests__/accounts.integration.test.tsx`       | Account CRUD workflows            | 35 tests                          |
| [x]  | Auth Integration Tests            | `src/__tests__/auth.integration.test.tsx`           | Authentication flows              | 18 tests (signup, login, logout)  |
| [x]  | Family Context Integration        | `src/__tests__/family-context.integration.test.tsx` | Family context and switching      | 12 tests                          |
| [x]  | Routing Integration Tests         | `src/__tests__/routing.integration.test.tsx`        | Route protection and navigation   | 15 tests                          |
| [x]  | Transactions Integration Tests    | `src/__tests__/transactions.integration.test.tsx`   | Transaction CRUD workflows        | 38 tests                          |

---

## Implementation Steps

### Phase 1: Categories (Week 1)

#### Step 1.0: Category Types and Constants

.......- [x] Create `src/types/category.ts` with TypeScript interfaces:

- `CategoryCreate { name: string, kind: CategoryKind, parent_id?: string | null }`
- `CategoryRead { id, tenant_id, name, kind, parent_id, created_at, updated_at, path? }`
- `CategoryUpdate { name?: string | null, kind?: CategoryKind | null, parent_id?: string | null }`
- `CategoryKind` enum: expense, income
- [x] Update `src/lib/constants.ts` with category endpoint constants

#### Step 1.1: Categories API & Hooks (✅ MILESTONE 1 COMPLETE)

- [x] Implement category API functions in `categoriesApi.ts`:
  - `getCategories()` - GET `/categories`
  - `getCategory(categoryId)` - GET `/categories/{category_id}`
  - `createCategory(data)` - POST `/categories`
  - `updateCategory(categoryId, data)` - PATCH `/categories/{category_id}`
  - `deleteCategory(categoryId, reassignTo?)` - DELETE `/categories/{category_id}`
    - **Backend Update Required**: Expand DELETE endpoint to accept optional `reassign_to` query parameter
    - When category has transactions, they must be reassigned to the specified category before deletion
    - Backend should validate that `reassign_to` category exists and belongs to same tenant
- [x] Create React Query hooks:
  - `useCategories` - fetch categories list (18 tests passing)
  - `useCategory` - fetch single category (18 tests passing)
  - `useCreateCategory` - create mutation (19 tests passing)
  - `useUpdateCategory` - update mutation
  - `useDeleteCategory` - delete mutation

#### Step 1.2: CategoryTree Component (✅ COMPLETE)

- [x] Build `CategoryTree` component with hierarchical display
- [x] Add collapsible nodes
- [x] Add inline actions (add child, edit, delete)
- [x] Handle empty state

#### Step 1.3: Category Modals (✅ COMPLETE)

- [x] Create `AddCategoryModal` with form
- [x] Create `EditCategoryModal` with pre-filled data
- [x] Create `DeleteCategoryConfirm` with reassignment option
- [x] Wire up mutations

#### Step 1.4: CategorySelect Component (✅ COMPLETE)

- [x] Build `CategorySelect` dropdown
- [x] Add search functionality with debouncing
- [x] Display hierarchy (full path breadcrumb)
- [x] Filter by kind (expense/income)

#### Step 1.5: Family Page (Categories Section) (✅ COMPLETE)

- [x] Create `FamilyPage` layout with tabbed interface
- [x] Add `FamilyHeader` component
- [x] Add `CategoryTree` with action buttons
- [x] Add `MembersList` component

#### Step 1.6: Integrate with Transaction Form (✅ COMPLETE)

- [x] Replace category input in `TransactionForm` with `CategorySelect`
- [x] Test category selection in create/edit transaction flow

#### Step 1.7: Delete with Reassignment (✅ FRONTEND COMPLETE, BACKEND PARTIAL)

- [x] **Backend Partial**: DELETE `/categories/{category_id}` endpoint accepts `reassign_to` query parameter (validation pending)
- [x] Update `deleteCategory()` API function to accept optional `reassignTo` parameter
- [x] Implement frontend reassignment flow in `DeleteCategoryConfirm` modal:
  - [x] Fetch transaction count for category being deleted
  - [x] Show count of affected transactions
  - [x] If count > 0, require selecting replacement category before delete
  - [x] CategorySelect dropdown for choosing replacement (filtered to same kind)
- [x] Handle API call with reassignment: `DELETE /categories/{id}?reassign_to={newId}`

#### Step 1.8: Testing & Polish (Categories) (✅ COMPLETE)

- [x] Test full category CRUD flow (28 integration tests)
- [x] Test hierarchy (create parent → add children)
- [x] Test delete with reassignment
- [x] Test transaction form with category select

---

### Phase 2: Family Management (Week 2)

#### Step 2.0: Family Types and Constants (✅ COMPLETE)

- [x] Add TypeScript interfaces to `src/types/family.ts`:
  - `TenantCreate { name: string }`
  - `MembershipRead { id, tenant_id, user_id?, user_email?, role, status, created_at }`
  - `MembershipCreate { user_email: string, role?: MembershipRole }`
  - `MembershipUpdate { role?: MembershipRole | null, status?: MembershipStatus | null }`
  - `MembershipRole` enum: owner, member, viewer
  - `MembershipStatus` enum: active, pending, revoked
- [x] Update `src/lib/constants.ts` with new endpoint constants

#### Step 2.1: Create Family Feature (✅ COMPLETE)

- [x] Implement `createFamily()` API function in `familyApi.ts` - POST `/tenants`
- [x] Create `useCreateFamily` hook with mutation
- [x] Build `CreateFamilyModal` component:
  - Form with single "Family Name" TextField
  - Validation (required, min 2 chars)
  - On success: invalidate families list, auto-switch to new family, close modal
- [x] Update `FamiliesPage` to add "+ Create Family" button
- [x] Wire up modal open/close state in `FamiliesPage`

#### Step 2.2: Member List API & Hooks (✅ COMPLETE)

- [x] Implement `listMembers(familyId)` API function - GET `/tenants/{tenant_id}/members`
- [x] Create `useListMembers` hook
- [x] Test fetching members list for existing family

#### Step 2.3: Invite Member Feature (✅ COMPLETE)

- [x] Implement `inviteMember(familyId, data)` API function - POST `/tenants/{tenant_id}/members`
- [x] Create `useInviteMember` hook
- [x] Build `InviteMemberModal`:
  - Email input with validation
  - Role select dropdown (member, viewer) - owner not selectable
  - On success: show "Invitation sent to {email}" message
  - Invalidate members list
- [x] Wire up invite modal in `FamilyPage`

#### Step 2.4: MembersList Component (Enhanced) (✅ COMPLETE)

- [x] Update existing `MembersList` component to show:
  - User email/name
  - Role badge (owner/member/viewer)
  - Status badge (active/pending/revoked)
  - Action menu (owner only):
    - "Remove Member" → confirmation dialog
  - Highlight current user's membership
- [x] Add empty state component

#### Step 2.5: Remove Member Feature (✅ COMPLETE)

- [x] Implement `removeMember()` API function
- [x] Create `useRemoveMember` hook
- [x] Add confirmation dialog for member removal
- [x] Wire up remove action in `MembersList`
- [x] Handle success: invalidate members list, show toast

#### Step 2.6: Leave Family Feature (✅ COMPLETE)

- [x] Implement `leaveFamily()` API function (same as removeMember but for self)
- [x] Create `useLeaveFamily` hook
- [x] Build `FamilySettings` component:
  - Family info display
  - "Leave Family" button (owners can also leave now)
  - Confirmation dialog: "Are you sure? You'll lose access to all data."
  - On success: redirect to `/app/families`, show toast
- [x] Add `FamilySettings` to `FamilyPage`

#### Step 2.7: Delete Family Feature (✅ COMPLETE)

- [x] Implement `deleteFamily()` API function
- [x] Create `useDeleteFamily` hook
- [x] Add "Delete Family" button in `FamilySettings` (visible if owner)
- [x] Confirmation dialog with severe warning:
  - "This will permanently delete the family and ALL data"
  - Require typing family name to confirm
  - Red/destructive styling
- [x] On success: redirect to `/app/families`, invalidate families list

#### Step 2.8: Accept Invite Placeholder Page (✅ COMPLETE)

- [x] Create `AcceptInvitePage` at `/accept-invite` route
- [x] Display message: "Invite acceptance is coming soon. Backend implementation required."
- [x] Parse `?token=xxx` from URL and display token (for debugging)
- [x] Add link back to login page
- [x] Note: Full implementation requires backend endpoint for token validation

#### Step 2.9: Update FamilyPage Layout (✅ COMPLETE)

- [x] Update `FamilyPage` to have tabbed layout:
  - Tab 1: Categories (existing `CategoryTree`)
  - Tab 2: Settings (`MembersList` + invite button + `FamilySettings`)
- [x] Add `FamilyHeader` at top with family name and member count

#### Step 2.10: Testing & Polish (Family Management) (✅ COMPLETE)

- [x] Test create family flow (45 integration tests)
- [x] Test invite member (creates PENDING membership)
- [x] Test viewing members list with different roles/statuses
- [x] Test removing member (owner only)
- [x] Test leaving family (all users including owners)
- [x] Test deleting family (owner only, with confirmation)
- [x] Test permission checks (non-owners can't invite/remove)
- [x] Add loading states for all mutations
- [x] Add error handling and toast messages

---

## API Endpoints Reference (Sprint 4)

### Phase 1: Category Endpoints

| Endpoint                                       | Method | operationId                                       | Request                              | Response         | Notes                                                                                                                     |
| ---------------------------------------------- | ------ | ------------------------------------------------- | ------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/categories`                                  | GET    | `list_categories_categories_get`                  | -                                    | `CategoryRead[]` | List all categories for active tenant                                                                                     |
| `/categories/{category_id}`                    | GET    | `get_category_categories__category_id__get`       | -                                    | `CategoryRead`   | Get single category                                                                                                       |
| `/categories`                                  | POST   | `create_category_categories_post`                 | `CategoryCreate`                     | `CategoryRead`   | Create category (OWNER only)                                                                                              |
| `/categories/{category_id}`                    | PATCH  | `update_category_categories__category_id__patch`  | `CategoryUpdate`                     | `CategoryRead`   | Update category (OWNER only)                                                                                              |
| `/categories/{category_id}?reassign_to={uuid}` | DELETE | `delete_category_categories__category_id__delete` | Query: `reassign_to` (optional UUID) | `{ok: true}`     | Delete category. **Backend update required**: Must accept `reassign_to` param when category has transactions (OWNER only) |

### Phase 2: Family Management Endpoints

| Endpoint                                       | Method | operationId                                                                       | Request            | Response           | Notes                             |
| ---------------------------------------------- | ------ | --------------------------------------------------------------------------------- | ------------------ | ------------------ | --------------------------------- |
| `/tenants`                                     | POST   | `create_tenant_tenants_post`                                                      | `TenantCreate`     | `TenantRead`       | Create family, user becomes owner |
| `/tenants/{tenant_id}/members`                 | GET    | `list_members_for_tenant_tenants__tenant_id__members_get`                         | -                  | `MembershipRead[]` | List all members with status      |
| `/tenants/{tenant_id}/members`                 | POST   | `create_membership_for_tenant_tenants__tenant_id__members_post`                   | `MembershipCreate` | `MembershipRead`   | Invite member (OWNER only)        |
| `/tenants/{tenant_id}/members/{membership_id}` | PATCH  | `update_membership_for_tenant_tenants__tenant_id__members__membership_id__patch`  | `MembershipUpdate` | `MembershipRead`   | Update member role/status         |
| `/tenants/{tenant_id}/members/{membership_id}` | DELETE | `delete_membership_for_tenant_tenants__tenant_id__members__membership_id__delete` | -                  | `{ok: true}`       | Remove member or leave family     |
| `/tenants/{tenant_id}`                         | DELETE | `delete_tenant_tenants__tenant_id__delete`                                        | -                  | `{ok: true}`       | Delete family (OWNER only)        |

---

## Notes & Assumptions

### Phase 1: Categories

- **Hierarchy depth:** Support up to 3 levels (parent → child → grandchild)
- **Category reassignment (Backend Update Required):**
  - DELETE `/categories/{category_id}` endpoint must accept optional `reassign_to` query parameter
  - When category has transactions, backend should require `reassign_to` parameter (return 400 if missing)
  - Backend must validate `reassign_to` category exists and belongs to same tenant
  - Backend must reassign all transactions from deleted category to `reassign_to` category before deletion
  - Frontend will call: `DELETE /categories/{id}?reassign_to={newId}`
- **Default categories:** Backend seeds default categories on tenant creation
- **Category icons/colors:** Optional UI enhancement (defer to polish phase)

### Phase 2: Family Management

- **Category icons/colors:** Optional UI enhancement (defer to polish phase)
- **Invite acceptance:** Email-based token flow requires backend implementation first. Sprint 4 creates the invitation (PENDING membership) but acceptance is a placeholder.
- **Backend gap**: Need `POST /auth/accept-invite?token=xxx` endpoint that:
  1. Validates token and finds PENDING membership
  2. Creates user account if email doesn't exist
  3. Updates membership status to ACTIVE and links user_id
  4. Returns access token
- **Email sending:** Assumes backend will send invite emails (out of scope for frontend)
- **Owner protection:** Cannot leave or delete if you're the only owner
- **Member removal:** Owners can remove any member except themselves
- **Leave vs Remove:** Same backend endpoint, different UI context
