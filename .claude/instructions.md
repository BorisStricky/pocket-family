Perfect! Here's the optimized instruction set for Claude Code:

---

# Claude Code Instructions - Personal Finance Frontend

## 1. Context & Project Overview

Building a multi-tenant personal finance SaaS frontend using React + TypeScript + MUI. This is a **learning project** requiring detailed explanations. Backend API exists and is documented in OpenAPI spec.

**Architecture**: Hybrid approach - atomic design for shared components, flat structure for feature-specific code.

---

## 2. Critical Files - Read First (Priority Order)

### ALWAYS READ (High Priority):
1. `.active_context/frontend_roadmap.md` - Current sprint and task overview
2. `.active_context/sprint_N.md` - Detailed current sprint checklist (N = current sprint number)
3. `docs/north_star.md` - Product vision and domain model
4. `docs/SystemArchitecture.md` - Backend architecture and tech stack
5. `docs/repo-structure.md` - Repository layout and conventions

### Read When Relevant (Medium Priority):
6. `docs/spec_3_component_inventory.md` - Component catalog when building UI
7. `docs/openAPI_spec.json` - API endpoints when implementing data fetching
8. `docs/spec_2_pages_inventory_and_sitemap.md` - Routing and page structure

### Update As You Work:
- `.memory_bank/components_used.md` - Track which components exist (update after each feature)
- `docs/glossary.md` - Add new concepts inline as encountered
- Sprint checklist - Mark `[x]` when tasks complete

---

## 3. Code Quality Standards

### Variable Naming (CRITICAL):
- ❌ **Never abbreviate**: `tx`, `q`, `acc`, `cat`
- ✅ **Always full names**: `transaction`, `query`, `account`, `category`
- ✅ **Be descriptive**: `userTransactions` not `data`, `isLoadingCategories` not `loading`

### TypeScript:
- All files use `.tsx` or `.ts` extensions
- No `any` types - use proper interfaces
- Props interfaces for all components
- Export types from feature-specific `types.ts`

### File Organization:
```
src/
  components/ui/        # Shared atomic design (Button, Input, etc.)
  components/domain/    # Business components (AgTransactionsGrid, CategoryTree)
  features/*/
    components/         # Feature-specific (FLAT, no subdirs)
    pages/
    hooks/
    api/
```

---

## 4. Learning Mode Requirements

### Inline Comments (Required for ALL files):
```typescript
// Example - explain the "why" at high level:

// Prefetch family data on mount to validate user membership
// before rendering protected content
useEffect(() => {
  if (familyId) {
    prefetchFamily(familyId);
  }
}, [familyId]);
```

### Glossary Updates:
- When introducing new concept: Add to `docs/glossary.md` immediately
- **Format**:
  ```markdown
  **Term**: Brief definition (1-2 sentences). Context: where it's used.
  ```
- Mention in chat: "Added 'React Query invalidation' to glossary"

### Explanations in Chat:
- After implementing feature, provide brief summary:
  - What was built
  - Key patterns used
  - Why certain decisions were made
  - What to test/verify

---

## 5. Change Management - Approval Required

### ALWAYS ask for approval before:

1. **Architecture Changes**:
   - Changing folder structure
   - Adding new architectural layers
   - Modifying routing patterns
   - Changing state management approach

2. **File Structure Changes**:
   - Moving files between folders
   - Renaming folders
   - Creating new top-level directories

3. **Dependencies** (only if necessary):
   - Adding new npm packages
   - Upgrading major versions
   - Removing existing dependencies

### Ask case-by-case:
4. **Component Refactoring**:
   - Extracting large components
   - Combining similar components
   - Changing component APIs (props)

### Format for approval requests:
```
🔴 APPROVAL NEEDED - [Category]

Proposed change: [Brief description]
Why: [Justification]
Impact: [What files/features affected]
Alternative considered: [If any]

Proceed? (yes/no)
```

---

## 6. Implementation Workflow

### For Each Task:

1. **Read Current Sprint** (`.active_context/sprint_N.md`)
2. **Check Checklist** - Find next uncompleted `[ ]` item
3. **Implement Feature**:
   - Write code with inline comments
   - Update `.memory_bank/components_used.md` if new components
   - Add to glossary if new concepts
4. **Update Checklist** - Mark `[x]` when complete
5. **Summarize in Chat** - Brief explanation of what was done

### Example Task Flow:
```markdown
Current task: Sprint 2 - Create TransactionForm component

Steps:
1. Read sprint_2.md checklist
2. Create src/features/transactions/components/TransactionForm.tsx
3. Add inline comments explaining form validation, API integration
4. Update .memory_bank/components_used.md with "TransactionForm"
5. Add "controlled form" to glossary if not present
6. Mark checkbox in sprint_2.md: [x] Transaction form component
7. Chat: "Created TransactionForm with validation. Uses React Hook Form for..."
```

---

## 7. API Integration Pattern

All API calls use centralized client:

```typescript
// src/lib/apiClient.ts - reads VITE_API_URL from env
import { apiFetch } from '@/lib/apiClient';

// In hooks:
const { data: transactions } = useQuery({
  queryKey: ['transactions', familyId, filters],
  queryFn: () => apiFetch(`/transactions?familyId=${familyId}`),
});
```

**Always include**:
- Authorization header (from localStorage)
- Family ID in API calls
- Error handling (401 → logout, 403 → show error)

---

## 8. Context Window Management

If context fills up, **prioritize keeping**:
1. Current sprint details (`.active_context/sprint_N.md`)
2. File you're actively editing
3. Related component/page files
4. North star + architecture (if needed for decisions)

**Can drop temporarily**:
- Component inventory (unless building new components)
- Full OpenAPI spec (reference specific endpoints as needed)
- Older sprint files

---

## 9. Testing & Verification

After each feature, suggest testing steps:
```
To verify:
1. Run `npm run dev`
2. Navigate to /app/:familyId/transactions
3. Click "Add Transaction"
4. Verify form validation works
5. Check network tab for API call with correct familyId
```

---

## 10. Quick Reference

**Current Project State**:
- Sprint: [Will be in active_context]
- Stack: React + TypeScript + MUI + React Query + AG Grid
- Backend: FastAPI (running on localhost:8000 in dev)

**Common Patterns**:
- Protected routes: Wrap with `<ProtectedRoute>`
- Family context: Use `useFamilyContext()` hook
- API calls: Use `apiFetch()` from `lib/apiClient.ts`
- Forms: MUI + React Hook Form
- Tables: AG Grid wrappers in `components/domain/ag/`

---

## Summary Checklist for Every Task:

- [ ] Read current sprint details
- [ ] Find next incomplete task in checklist
- [ ] Write code with inline comments (explain "why")
- [ ] Use full variable names (no abbreviations)
- [ ] Add new concepts to glossary
- [ ] Update components_used.md if applicable
- [ ] Mark task as `[x]` complete in sprint checklist
- [ ] Ask approval if architecture/structure change needed
- [ ] Summarize what was built in chat
- [ ] Mention glossary additions

---