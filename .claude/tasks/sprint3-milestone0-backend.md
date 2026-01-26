# Sprint 3 - Milestone 0: Backend Enhancements

## Overview
Enhance backend API to support account sharing atomically and update account balances when transactions are created.

## Agent Assignments
- **Primary**: `backend-dev`
- **Validation**: `backend-test`
- **Fallback**: `backend-dev`

## Dependencies
- None (first milestone)

## Success Criteria
- [x] `GET /accounts` accepts optional `tenant_id` query parameter
- [x] `AccountShareWith` schema exists in `schemas.py`
- [x] `AccountCreate` schema has optional `share_with` field
- [x] `POST /accounts` atomically creates account + share when `share_with` provided
- [x] `POST /transactions` updates account balance based on transaction_type
- [x] Backend tests pass for all new functionality

---

## Tasks

### Task 0.1: Add tenant_id Query Parameter to GET /accounts
**File**: `backend/api/app/routers/accounts.py`

- [x] Add `tenant_id: Optional[UUID] = Query(None)` parameter to `list_accounts` endpoint
- [x] When `tenant_id` provided:
  - Validate user is active member of that tenant
  - Return only accounts shared with that tenant (via AccountShare)
- [x] When `tenant_id` omitted:
  - Keep current behavior (all user's accounts + all shared)
- [x] Add appropriate error handling (403 if not member of tenant)

### Task 0.2: Add AccountShareWith Schema
**File**: `backend/api/app/schemas.py`

- [x] Create `AccountShareWith` Pydantic schema:
  ```python
  class AccountShareWith(BaseModel):
      tenant_id: UUID
      visibility: Optional[ShareVisibility] = ShareVisibility.HIDDEN
  ```

### Task 0.3: Update AccountCreate Schema
**File**: `backend/api/app/schemas.py`

- [x] Add optional `share_with` field to `AccountCreate`:
  ```python
  share_with: Optional[AccountShareWith] = None
  ```

### Task 0.4: Enhance POST /accounts for Atomic Share Creation
**File**: `backend/api/app/routers/accounts.py`

- [x] Update `create_account` endpoint to handle `share_with`:
  - If `share_with` is provided:
    - Validate user is active member of specified tenant
    - Begin transaction
    - Create Account
    - Create AccountShare with provided visibility
    - Commit transaction (or rollback if either fails)
  - If `share_with` is omitted:
    - Keep current behavior (create account only)
- [x] Return appropriate error messages for validation failures

### Task 0.5: Update Account Balance on Transaction Creation
**File**: `backend/api/app/routers/transactions.py`

- [x] Update `create_transaction` to modify account balance:
  - After creating transaction, fetch the associated account
  - If `transaction_type == "income"`: `account.balance += amount`
  - If `transaction_type == "expense"`: `account.balance -= amount`
  - Save updated account
- [x] Consider edge cases:
  - Credit accounts may have negative balances (debt)
  - Handle decimal precision correctly

### Task 0.6: Backend Tests
**File**: `backend/api/tests/test_accounts_endpoints.py`

- [x] Test `GET /accounts` with `tenant_id` parameter:
  - Returns only accounts shared with that tenant
  - Returns 403 if user not member of tenant
- [x] Test `POST /accounts` with `share_with`:
  - Atomic creation succeeds (account + share created)
  - Rollback on invalid tenant_id
  - Works without `share_with` (existing behavior)
- [x] Test transaction balance updates:
  - Income increases balance
  - Expense decreases balance

---

## Validation Commands

```bash
# Run backend tests
cd backend/api && pytest tests/test_accounts_endpoints.py -v

# Run all backend tests
cd backend/api && pytest -v

# Manual API testing (optional)
curl -X GET "http://localhost:8000/accounts?tenant_id=<uuid>" -H "Authorization: Bearer <token>"
```

---

## Notes
- Use SQLModel transaction context for atomic operations
- Ensure balance updates handle Decimal type correctly
- All queries must filter by user context for security
