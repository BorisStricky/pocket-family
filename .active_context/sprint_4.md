# Sprint 4: Categories & Family Management (1 week)

## Goal
Users can manage categories in hierarchical tree structure. Users can create families, invite members, and manage family membership. Family settings page allows managing members, invites, and categories. Categories now available in transaction forms.

## Success Criteria
- [ ] Users can view category tree (parent-child hierarchy)
- [ ] Users can create, edit, delete categories
- [ ] Deleting category with transactions prompts reassignment
- [ ] Users can create new families and become owners
- [ ] Owners can invite users via email (creates pending memberships)
- [ ] Users can view pending invitations (full acceptance flow pending backend)
- [ ] Owners can remove members from their family
- [ ] Members can leave families they don't own
- [ ] Owners can delete families with proper safeguards
- [ ] Family page shows members, settings, and categories
- [ ] Category select works in transaction form

---

## Components Checklist

### Categories Hooks

| Done | Hook | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | useCategories | `src/features/family/hooks/useCategories.ts` | Fetch categories list | • Query key: `['categories', familyId]`<br>• Call `GET /tenants/{familyId}/categories`<br>• Returns hierarchical tree |
| [ ] | useCategory | `src/features/family/hooks/useCategory.ts` | Fetch single category | • Query key: `['category', familyId, categoryId]`<br>• Call `GET /tenants/{familyId}/categories/{categoryId}` |
| [ ] | useCreateCategory | `src/features/family/hooks/useCreateCategory.ts` | Create category mutation | • Call `POST /tenants/{familyId}/categories`<br>• Invalidate categories list |
| [ ] | useUpdateCategory | `src/features/family/hooks/useUpdateCategory.ts` | Update category mutation | • Call `PUT /tenants/{familyId}/categories/{categoryId}`<br>• Invalidate categories |
| [ ] | useDeleteCategory | `src/features/family/hooks/useDeleteCategory.ts` | Delete category mutation | • Call `DELETE /tenants/{familyId}/categories/{categoryId}`<br>• Handle reassignment if has transactions |

### Family Management Hooks

| Done | Hook | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | useCreateFamily | `src/features/family/hooks/useCreateFamily.ts` | Create family mutation | • Call `POST /tenants`<br>• Invalidate families list<br>• Auto-switch to new family |
| [ ] | useListMembers | `src/features/family/hooks/useListMembers.ts` | Fetch members list | • Query key: `['members', familyId]`<br>• Call `GET /tenants/{familyId}/members` |
| [ ] | useInviteMember | `src/features/family/hooks/useInviteMember.ts` | Invite member mutation | • Call `POST /tenants/{familyId}/members`<br>• Invalidate members list<br>• Owner only |
| [ ] | useRemoveMember | `src/features/family/hooks/useRemoveMember.ts` | Remove member mutation | • Call `DELETE /tenants/{familyId}/members/{membershipId}`<br>• Owner only |
| [ ] | useLeaveFamily | `src/features/family/hooks/useLeaveFamily.ts` | Leave family mutation | • Call `DELETE /tenants/{familyId}/members/{membershipId}`<br>• Member can leave (not owner)<br>• Redirect after leaving |
| [ ] | useDeleteFamily | `src/features/family/hooks/useDeleteFamily.ts` | Delete family mutation | • Call `DELETE /tenants/{familyId}`<br>• Owner only<br>• Confirmation required<br>• Redirect to families list |

### API Functions

| Done | Function | File Path | Method | Endpoint | Request | Response | Notes |
|------|----------|-----------|--------|----------|---------|----------|-------|
| [ ] | getCategories | `src/features/family/api/familyApi.ts` | GET | `/tenants/{tenant_id}/categories` | - | `CategoryRead[]` | operationId: `list_categories_tenants__tenant_id__categories_get` |
| [ ] | getCategory | `src/features/family/api/familyApi.ts` | GET | `/tenants/{tenant_id}/categories/{category_id}` | - | `CategoryRead` | operationId: `get_category_tenants__tenant_id__categories__category_id__get` |
| [ ] | createCategory | `src/features/family/api/familyApi.ts` | POST | `/tenants/{tenant_id}/categories` | `CategoryCreate` | `CategoryRead` | operationId: `create_category_tenants__tenant_id__categories_post` |
| [ ] | updateCategory | `src/features/family/api/familyApi.ts` | PUT | `/tenants/{tenant_id}/categories/{category_id}` | `CategoryUpdate` | `CategoryRead` | operationId: `update_category_tenants__tenant_id__categories__category_id__put` |
| [ ] | deleteCategory | `src/features/family/api/familyApi.ts` | DELETE | `/tenants/{tenant_id}/categories/{category_id}` | - | `{ok: true}` | operationId: `delete_category_tenants__tenant_id__categories__category_id__delete` |
| [ ] | createFamily | `src/features/family/api/familyApi.ts` | POST | `/tenants` | `TenantCreate` | `TenantRead` | Creates family, user becomes owner |
| [ ] | listMembers | `src/features/family/api/familyApi.ts` | GET | `/tenants/{tenant_id}/members` | - | `MembershipRead[]` | List all members with status |
| [ ] | inviteMember | `src/features/family/api/familyApi.ts` | POST | `/tenants/{tenant_id}/members` | `MembershipCreate` | `MembershipRead` | Creates PENDING membership |
| [ ] | removeMember | `src/features/family/api/familyApi.ts` | DELETE | `/tenants/{tenant_id}/members/{membership_id}` | - | `{ok: true}` | Owner removes member |
| [ ] | leaveFamily | `src/features/family/api/familyApi.ts` | DELETE | `/tenants/{tenant_id}/members/{membership_id}` | - | `{ok: true}` | Member leaves (not owner) |
| [ ] | deleteFamily | `src/features/family/api/familyApi.ts` | DELETE | `/tenants/{tenant_id}` | - | `{ok: true}` | Owner deletes family |

**Type Reference (from OpenAPI):**
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
  path?: string; // Full path like "Food > Restaurants"
}

interface CategoryUpdate {
  name?: string | null;
  parent_id?: string | null;
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
  VIEWER = "viewer"
}

enum MembershipStatus {
  ACTIVE = "active",
  PENDING = "pending",
  REVOKED = "revoked"
}
```

### Domain Components

| Done | Component | File Path | Props | Story | Notes |
|------|-----------|-----------|-------|-------|-------|
| [ ] | CategoryTree | `src/components/domain/CategoryTree.tsx` | `categories, onAdd, onEdit, onDelete` | `Domain/CategoryTree` | • Hierarchical tree view<br>• Collapsible nodes<br>• Inline actions (add child, edit, delete)<br>• Use MUI TreeView or custom |
| [ ] | CategorySelect | `src/components/domain/CategorySelect.tsx` | `value, onChange, kind?, familyId` | `Domain/CategorySelect` | • Searchable dropdown<br>• Hierarchical display<br>• Filter by kind (expense/income)<br>• Used in transaction form |

### Feature Components (Family/Categories)

| Done | Component | File Path | Props | Used In | Notes |
|------|-----------|-----------|-------|---------|-------|
| [ ] | AddCategoryModal | `src/features/family/components/AddCategoryModal.tsx` | `open, onClose, parentId?, kind?` | Family page | • Form: name, kind, parent select<br>• Validation |
| [ ] | EditCategoryModal | `src/features/family/components/EditCategoryModal.tsx` | `open, onClose, category` | Family page | • Pre-filled form<br>• Can change name, parent |
| [ ] | DeleteCategoryConfirm | `src/features/family/components/DeleteCategoryConfirm.tsx` | `open, onClose, category, transactionCount` | Family page | • Show affected transaction count<br>• Option to reassign to another category<br>• Confirm delete |
| [ ] | FamilyHeader | `src/features/family/components/FamilyHeader.tsx` | `family` | Family page | • Family name<br>• Member count<br>• Settings button |
| [ ] | MembersList | `src/features/family/components/MembersList.tsx` | `members, currentUserMembership` | Family page | • List of family members<br>• Show status badges (active/pending/revoked)<br>• Show role badges (owner/member/viewer)<br>• Action menu per member (owner only): Change role, Remove member<br>• Highlight current user's membership<br>• Empty state for no members |
| [ ] | CreateFamilyModal | `src/features/family/components/CreateFamilyModal.tsx` | `open, onClose, onSuccess` | FamiliesPage | • Form with family name input<br>• Validation (name required, min 2 chars)<br>• Auto-switch to new family after creation |
| [ ] | InviteMemberModal | `src/features/family/components/InviteMemberModal.tsx` | `open, onClose, familyId` | FamilyPage | • Form: email input + role select<br>• Validation (email format)<br>• Success message: "Invitation sent to {email}" |
| [ ] | FamilySettings | `src/features/family/components/FamilySettings.tsx` | `family, currentUserMembership` | FamilyPage | • Shows family info<br>• "Leave Family" button (if not owner)<br>• "Delete Family" button (if owner)<br>• Confirmation dialogs for both actions |

### Pages

| Done | Page | File Path | Route | Protected | Dependencies | Notes |
|------|------|-----------|-------|-----------|--------------|-------|
| [ ] | FamilyPage | `src/features/family/pages/FamilyPage.tsx` | `/app/:familyId/family` | Yes | FamilyHeader, CategoryTree, MembersList, FamilySettings | Main family settings page with tabs for Categories and Members |
| [ ] | AcceptInvitePage | `src/features/family/pages/AcceptInvitePage.tsx` | `/accept-invite` | No (public) | - | Placeholder page showing invite token acceptance will be implemented (backend required) |

### Testing

| Done | Test | File Path | Purpose | Notes |
|------|------|-----------|---------|-------|
| [ ] | useCategories tests | `src/features/family/__tests__/useCategories.test.ts` | Test hook logic | Mock API |
| [ ] | CategoryTree tests | `src/components/domain/__tests__/CategoryTree.test.tsx` | Test tree rendering | Mock hierarchical data |
| [ ] | CategorySelect tests | `src/components/domain/__tests__/CategorySelect.test.tsx` | Test dropdown | Test search, selection |

---

## Implementation Steps (Sprint 4)

### Step 0: Types and Constants (Family Management)
- [ ] Add TypeScript interfaces to `src/types/family.ts`:
  - `TenantCreate { name: string }`
  - `MembershipRead { id, tenant_id, user_id?, user_email?, role, status, created_at }`
  - `MembershipCreate { user_email: string, role?: MembershipRole }`
  - `MembershipUpdate { role?: MembershipRole, status?: MembershipStatus }`
  - `MembershipRole` enum: owner, member, viewer
  - `MembershipStatus` enum: active, pending, revoked
- [ ] Update `src/lib/constants.ts` with new endpoint constants

### Step 0.5: Create Family Feature
- [ ] Implement `createFamily()` API function in `familyApi.ts`
- [ ] Create `useCreateFamily` hook with mutation
- [ ] Build `CreateFamilyModal` component:
  - Form with single "Family Name" TextField
  - Validation (required, min 2 chars)
  - On success: invalidate families list, auto-switch to new family, close modal
- [ ] Update `FamiliesPage` to add "+ Create Family" button
- [ ] Wire up modal open/close state in `FamiliesPage`

### Step 1: Categories API & Hooks
- [ ] Implement category API functions in `familyApi.ts`
- [ ] Create React Query hooks: `useCategories`, `useCreateCategory`, etc.
- [ ] Define category types

### Step 2: CategoryTree Component
- [ ] Build `CategoryTree` component with hierarchical display
- [ ] Add collapsible nodes
- [ ] Add inline actions (add child, edit, delete)
- [ ] Handle empty state

### Step 3: Category Modals
- [ ] Create `AddCategoryModal` with form
- [ ] Create `EditCategoryModal` with pre-filled data
- [ ] Create `DeleteCategoryConfirm` with reassignment option
- [ ] Wire up mutations

### Step 4: CategorySelect Component
- [ ] Build `CategorySelect` dropdown
- [ ] Add search functionality
- [ ] Display hierarchy (indent or breadcrumb)
- [ ] Filter by kind (expense/income)

### Step 5: Family Page
- [ ] Create `FamilyPage` layout
- [ ] Add `FamilyHeader` component
- [ ] Add `CategoryTree` with action buttons
- [ ] Add `MembersList` (basic version)

### Step 6: Integrate with Transaction Form
- [ ] Replace category input in `TransactionForm` with `CategorySelect`
- [ ] Test category selection in create/edit transaction flow

### Step 7: Delete with Reassignment
- [ ] Implement reassignment flow when deleting category with transactions
- [ ] Show count of affected transactions
- [ ] Allow selecting replacement category
- [ ] Handle backend API call for reassignment

### Step 8: Testing & Polish (Categories)
- [ ] Test full category CRUD flow
- [ ] Test hierarchy (create parent → add children)
- [ ] Test delete with reassignment
- [ ] Test transaction form with category select

### Step 9: Member List API & Hooks
- [ ] Implement `listMembers()` API function
- [ ] Create `useListMembers` hook
- [ ] Test fetching members list for existing family

### Step 10: Invite Member Feature
- [ ] Implement `inviteMember()` API function
- [ ] Create `useInviteMember` hook
- [ ] Build `InviteMemberModal`:
  - Email input with validation
  - Role select dropdown (member, viewer) - owner not selectable
  - On success: show "Invitation sent to {email}" message
  - Invalidate members list
- [ ] Wire up invite modal in `FamilyPage`

### Step 11: MembersList Component (Enhanced)
- [ ] Update existing `MembersList` component to show:
  - User email/name
  - Role badge (owner/member/viewer)
  - Status badge (active/pending/revoked)
  - Action menu (owner only):
    - "Change Role" → opens role select dialog
    - "Remove Member" → confirmation dialog
  - Highlight current user's membership
- [ ] Add empty state component

### Step 12: Remove Member Feature
- [ ] Implement `removeMember()` API function
- [ ] Create `useRemoveMember` hook
- [ ] Add confirmation dialog for member removal
- [ ] Wire up remove action in `MembersList`
- [ ] Handle success: invalidate members list, show toast

### Step 13: Leave Family Feature
- [ ] Implement `leaveFamily()` API function (same as removeMember but for self)
- [ ] Create `useLeaveFamily` hook
- [ ] Build `FamilySettings` component:
  - Family info display
  - "Leave Family" button (visible if NOT owner)
  - Confirmation dialog: "Are you sure? You'll lose access to all data."
  - On success: redirect to `/app/families`, show toast
- [ ] Add `FamilySettings` to `FamilyPage`

### Step 14: Delete Family Feature
- [ ] Implement `deleteFamily()` API function
- [ ] Create `useDeleteFamily` hook
- [ ] Add "Delete Family" button in `FamilySettings` (visible if owner)
- [ ] Confirmation dialog with severe warning:
  - "This will permanently delete the family and ALL data"
  - Require typing family name to confirm
  - Red/destructive styling
- [ ] On success: redirect to `/app/families`, invalidate families list

### Step 15: Accept Invite Placeholder Page
- [ ] Create `AcceptInvitePage` at `/accept-invite` route
- [ ] Display message: "Invite acceptance is coming soon. Backend implementation required."
- [ ] Parse `?token=xxx` from URL and display token (for debugging)
- [ ] Add link back to login page
- [ ] Note: Full implementation requires backend endpoint for token validation

### Step 16: Update FamilyPage Layout
- [ ] Update `FamilyPage` to have tabbed layout:
  - Tab 1: Categories (existing `CategoryTree`)
  - Tab 2: Members (`MembersList` + invite button + `FamilySettings`)
- [ ] Or use sections with headers (simpler approach)
- [ ] Add `FamilyHeader` at top with family name and member count

### Step 17: Testing & Polish (Family Management)
- [ ] Test create family flow
- [ ] Test invite member (creates PENDING membership)
- [ ] Test viewing members list with different roles/statuses
- [ ] Test removing member (owner only)
- [ ] Test leaving family (member only)
- [ ] Test deleting family (owner only, with confirmation)
- [ ] Test permission checks (non-owners can't invite/remove)
- [ ] Add loading states for all mutations
- [ ] Add error handling and toast messages

---

## API Endpoints Reference (Sprint 4)

| Endpoint | Method | operationId | Request | Response | Notes |
|----------|--------|-------------|---------|----------|-------|
| `/tenants/{tenant_id}/categories` | GET | `list_categories_tenants__tenant_id__categories_get` | - | `CategoryRead[]` | List all categories for family |
| `/tenants/{tenant_id}/categories/{category_id}` | GET | `get_category_tenants__tenant_id__categories__category_id__get` | - | `CategoryRead` | Get single category |
| `/tenants/{tenant_id}/categories` | POST | `create_category_tenants__tenant_id__categories_post` | `CategoryCreate` | `CategoryRead` | Create category |
| `/tenants/{tenant_id}/categories/{category_id}` | PUT | `update_category_tenants__tenant_id__categories__category_id__put` | `CategoryUpdate` | `CategoryRead` | Update category |
| `/tenants/{tenant_id}/categories/{category_id}` | DELETE | `delete_category_tenants__tenant_id__categories__category_id__delete` | - | `{ok: true}` | Delete category |

---

## Notes & Assumptions

- **Hierarchy depth:** Support up to 3 levels (parent → child → grandchild)
- **Category reassignment:** Backend endpoint for bulk reassignment (check OpenAPI spec or implement)
- **Default categories:** Backend seeds default categories on tenant creation
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
