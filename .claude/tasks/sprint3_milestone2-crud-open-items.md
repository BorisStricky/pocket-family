# Sprint 3 Milestone 2 - Account CRUD Open Items

## Issue: Account Deletion Fails for Shared Accounts

### Problem Summary

When attempting to delete a shared account from the family page, the backend throws a foreign key constraint violation error because the `accountshare` table still references the account. The CASCADE delete is not properly configured in the database schema.

**Error**: `ForeignKeyViolationError: update or delete on table "account" violates foreign key constraint "accountshare_account_id_fkey"`

**Affected URL**: `DELETE http://localhost:8000/accounts/{account_id}`

### Requirements

1. **Family Page Deletion** (`/app/:familyId/accounts/:accountId`):
   - Only allow deletion if this is the only family the account is shared with
   - Return error if account is shared with multiple families
   - Error message should guide user to delete from main accounts page

2. **Main/Global Page Deletion** (`/app/accounts/:accountId`):
   - Allow deletion regardless of share count
   - Properly cascade delete all AccountShare records

### Root Cause Analysis

From exploration, I found:
- Current deletion endpoint: `DELETE /accounts/{account_id}` in [backend/api/app/routers/accounts.py:382-402](backend/api/app/routers/accounts.py)
- The foreign key constraint `accountshare_account_id_fkey` is NOT set to CASCADE
- No share count validation before deletion
- Single endpoint serves both family and global contexts without distinction

## Implementation Plan

### Implementation Workflow

**CRITICAL**: Follow this order to ensure migrations are generated correctly:

1. DONE **Update Models First** (Step 1) - Define `ondelete` behavior in SQLModel classes
2. DONE **Generate Migration** (Step 2) - Run `alembic revision --autogenerate`
3. DONE **Manually Verify Migration** (Step 2) - Alembic often misses `ondelete` clauses, so manually edit the generated migration
4. DONE **Test Migration** (Step 2) - Test upgrade and downgrade locally
5. DONE **Update Backend Endpoint** (Step 3) - Add share count validation logic
6. **Update Frontend** (Steps 4-6) - Add query parameter and error handling

### Step 1: Update Models to Define Cascade Behavior
DONE

**File**: [backend/api/app/models.py](backend/api/app/models.py)

**Changes**:

#### AccountShare Model (lines 231-248)
- Update the `account_id` field to include `sa_column_kwargs={"ondelete": "CASCADE"}`
- This ensures future migrations maintain the CASCADE behavior

```python
account_id: UUID = Field(
    foreign_key="account.id",
    nullable=False,
    index=True,
    sa_column_kwargs={"ondelete": "CASCADE"}  # Add this
)
```

#### Transaction Model (line 206)
- Make `account_id` nullable (change from `nullable=False` to `nullable=True`)
- Add `sa_column_kwargs={"ondelete": "SET NULL"}` to preserve transactions when account is deleted

```python
account_id: Optional[UUID] = Field(
    default=None,  # Add default
    foreign_key="account.id",
    nullable=True,  # Changed from False
    index=True,
    sa_column_kwargs={"ondelete": "SET NULL"}  # Add this
)
```

**Rationale**: Transactions represent historical financial records that should be preserved even if the account is deleted. Setting account_id to NULL maintains data integrity while allowing users to keep their transaction history.

### Step 2: Generate and Edit Migration
DONE

**File**: Create new Alembic migration

**Actions**:
1. **Generate migration**: From `backend/api` directory, run:
   ```bash
   alembic revision --autogenerate -m "Add CASCADE to accountshare and SET NULL to transaction"
   ```

2. **CRITICAL - Manually verify migration**: Alembic's autogenerate often DOES NOT detect `ondelete` parameter changes. You MUST manually review and edit the generated migration file to ensure it includes:
   - Drop and recreate `accountshare_account_id_fkey` with `ondelete="CASCADE"`
   - Drop and recreate `transaction_account_id_fkey` with `ondelete="SET NULL"`
   - Alter `transaction.account_id` column to allow NULL values (this should be auto-detected)

3. **Expected migration operations**:
   ```python
   def upgrade() -> None:
       # Make transaction.account_id nullable (should be auto-detected)
       op.alter_column('transaction', 'account_id', nullable=True)

       # Drop existing foreign key constraints
       op.drop_constraint('accountshare_account_id_fkey', 'accountshare', type_='foreignkey')
       op.drop_constraint('transaction_account_id_fkey', 'transaction', type_='foreignkey')

       # Recreate with proper ondelete clauses
       op.create_foreign_key(
           'accountshare_account_id_fkey',
           'accountshare', 'account',
           ['account_id'], ['id'],
           ondelete='CASCADE'
       )
       op.create_foreign_key(
           'transaction_account_id_fkey',
           'transaction', 'account',
           ['account_id'], ['id'],
           ondelete='SET NULL'
       )

   def downgrade() -> None:
       # Reverse operations for rollback safety
       op.drop_constraint('accountshare_account_id_fkey', 'accountshare', type_='foreignkey')
       op.drop_constraint('transaction_account_id_fkey', 'transaction', type_='foreignkey')

       # Recreate original constraints without ondelete
       op.create_foreign_key('accountshare_account_id_fkey', 'accountshare', 'account', ['account_id'], ['id'])
       op.create_foreign_key('transaction_account_id_fkey', 'transaction', 'account', ['account_id'], ['id'])

       # Make transaction.account_id non-nullable again
       op.alter_column('transaction', 'account_id', nullable=False)
   ```

4. **Test migration locally**:
   ```bash
   alembic upgrade head    # Apply migration
   alembic downgrade -1    # Test rollback
   alembic upgrade head    # Reapply
   ```

### Step 3: Add Share Count Validation to Deletion Endpoint
DONE

**File**: [backend/api/app/routers/accounts.py:382-402](backend/api/app/routers/accounts.py)

**Changes**:
1. Add optional query parameter `from_family_context: bool = False`
2. Before deletion, query the number of AccountShare records for the account
3. If `from_family_context=True` AND share count > 1:
   - Return `409 Conflict` with error message: "This account is shared with multiple families and can only be deleted from the main accounts page"
4. Otherwise, proceed with deletion (CASCADE will handle shares)

**Logic Flow**:
```python
@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    from_family_context: bool = False,  # New parameter
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    # Existing validation (404, 403)
    account_record = await db.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=404)
    if account_record.user_id != user.id:
        raise HTTPException(status_code=403, detail="only owner can delete account")

    # NEW: Check share count if deleting from family context
    if from_family_context:
        share_count_query = select(func.count(AccountShare.id)).where(
            AccountShare.account_id == account_id
        )
        result = await db.execute(share_count_query)
        share_count = result.scalar_one()

        if share_count > 1:
            raise HTTPException(
                status_code=409,
                detail="This account is shared with multiple families and can only be deleted from the main accounts page"
            )

    # Existing deletion logic
    await db.delete(account_record)
    await db.commit()
    return
```

### Step 4: Update Frontend API Hook

**File**: [frontend/src/features/accounts/api/deleteAccount.ts](frontend/src/features/accounts/api/deleteAccount.ts)

**Changes**:
1. Add optional `fromFamilyContext` parameter to the API function
2. Append query parameter to the URL when true: `/accounts/{accountId}?from_family_context=true`

**Updated Function**:
```typescript
export async function deleteAccount(
  accountId: string,
  fromFamilyContext = false
): Promise<void> {
  const url = fromFamilyContext
    ? `/accounts/${accountId}?from_family_context=true`
    : `/accounts/${accountId}`;

  await apiFetch(url, { method: 'DELETE' });
}
```

### Step 5: Update useDeleteAccount Hook

**File**: [frontend/src/features/accounts/hooks/useDeleteAccount.ts](frontend/src/features/accounts/hooks/useDeleteAccount.ts)

**Changes**:
1. Hook already accepts `familyId` parameter to determine context
2. Pass `fromFamilyContext: true` to the API function when `familyId` is provided
3. This signals to backend that deletion is from family page

**Updated Hook**:
```typescript
export function useDeleteAccount(familyId?: string) {
  return useMutation({
    mutationFn: (accountId: string) =>
      deleteAccount(accountId, !!familyId),  // Pass true if familyId exists
    onSuccess: () => {
      // Existing invalidation logic
    }
  });
}
```

### Step 6: Improve Error Handling on Family Page

**File**: [frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx](frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx)

**Changes**:
1. Add error handling in the delete mutation's `onError` callback
2. Display user-friendly error message when 409 Conflict is returned
3. Guide user to navigate to main accounts page for deletion

**Error Handling**:
```typescript
const { mutate: deleteAccountMutation, isPending: isDeleting } = useDeleteAccount(familyId);

// In the delete confirmation handler:
onConfirm: () => {
  deleteAccountMutation(accountId, {
    onError: (error) => {
      if (error.status === 409) {
        // Show specific message for shared account conflict
        toast.error(
          "This account is shared with multiple families. " +
          "Please delete it from the main Accounts page."
        );
      } else {
        toast.error(error.message || "Failed to delete account");
      }
    }
  });
}
```

## Files to Modify (in order)

### Backend
1. [backend/api/app/models.py:206](backend/api/app/models.py) - **FIRST**: Update Transaction.account_id field (nullable + SET NULL)
2. [backend/api/app/models.py:237](backend/api/app/models.py) - **FIRST**: Update AccountShare.account_id field (CASCADE)
3. **THEN**: Generate migration with `alembic revision --autogenerate`
4. **New Alembic Migration** - `backend/api/alembic/versions/XXXX_add_cascade_and_set_null.py` - **Manually verify/edit** to include ondelete clauses
5. [backend/api/app/routers/accounts.py:382-402](backend/api/app/routers/accounts.py) - Add share count validation

### Frontend
4. [frontend/src/features/accounts/api/deleteAccount.ts](frontend/src/features/accounts/api/deleteAccount.ts) - Add query parameter
5. [frontend/src/features/accounts/hooks/useDeleteAccount.ts](frontend/src/features/accounts/hooks/useDeleteAccount.ts) - Pass context flag
6. [frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx](frontend/src/features/accounts/pages/FamilyAccountDetailPage.tsx) - Add error handling

## Testing Strategy

### Backend Tests
**File**: [backend/api/tests/test_accounts.py](backend/api/tests/test_accounts.py)

1. **Test CASCADE deletion** - Verify AccountShare records are deleted when account is deleted
2. **Test SET NULL behavior** - Verify Transaction.account_id is set to NULL when account is deleted
3. **Test family context validation** - Verify 409 error when deleting shared account with `from_family_context=true`
4. **Test global context deletion** - Verify shared account can be deleted without context flag

**Test Cases**:
```python
async def test_delete_account_cascades_shares():
    """Verify AccountShare records are deleted when account is deleted"""
    # Create account + 2 shares
    # Delete account
    # Assert shares no longer exist

async def test_delete_account_orphans_transactions():
    """Verify transactions are preserved but orphaned when account is deleted"""
    # Create account + 3 transactions
    # Delete account
    # Assert transactions still exist
    # Assert transaction.account_id is NULL for all 3 transactions

async def test_delete_shared_account_from_family_context_fails():
    """Verify 409 error when deleting multi-shared account from family context"""
    # Create account + 2 shares
    # DELETE /accounts/{id}?from_family_context=true
    # Assert 409 status code

async def test_delete_shared_account_from_main_context_succeeds():
    """Verify multi-shared account can be deleted from main context"""
    # Create account + 2 shares
    # DELETE /accounts/{id} (no query param)
    # Assert 204 status code
    # Assert shares deleted
    # Assert any linked transactions have account_id=NULL
```

### Frontend Tests
**File**: [frontend/src/features/accounts/hooks/useDeleteAccount.test.ts](frontend/src/features/accounts/hooks/useDeleteAccount.test.ts)

1. **Test query parameter** - Verify `from_family_context=true` is sent when familyId is provided
2. **Test error handling** - Verify 409 error displays appropriate message

### Manual Testing

#### Test 1: Shared Account Deletion from Family Page
1. Create an account and share it with 2+ families
2. Navigate to family page (`/app/:familyId/accounts/:accountId`)
3. Attempt deletion - should see 409 error with message "This account is shared with multiple families..."
4. Verify account still exists

#### Test 2: Shared Account Deletion from Main Page
1. Using the same shared account from Test 1
2. Navigate to main accounts page (`/app/accounts/:accountId`)
3. Attempt deletion - should succeed with 204 status
4. Verify all AccountShare records are deleted (CASCADE)

#### Test 3: Account with Transactions Deletion
1. Create an account and add 3+ transactions to it
2. Navigate to main accounts page (`/app/accounts/:accountId`)
3. Delete the account
4. Query transactions in database - verify they still exist with `account_id = NULL`
5. Verify account no longer exists

#### Test 4: Combined Scenario (Shares + Transactions)
1. Create an account, share it with 1 family, add 2 transactions
2. Delete from family page - should succeed (only 1 share)
3. Verify AccountShare deleted and transactions orphaned

## Edge Cases Handled

1. **Account with no shares** - Can be deleted from either context
2. **Account with 1 share** - Can be deleted from family context (it's the only family)
3. **Account with multiple shares** - Can only be deleted from main page
4. **Account with transactions** - Transactions are preserved with account_id set to NULL
5. **Account with shares AND transactions** - Shares deleted (CASCADE), transactions orphaned (SET NULL)
6. **Non-owner attempting deletion** - Existing 403 error still applies
7. **Account doesn't exist** - Existing 404 error still applies

## Orphaned Transactions Handling

When an account is deleted, transactions linked to it will have `account_id = NULL`. This preserves historical data but requires consideration:

### Backend Implications
- **Query Handling**: Transactions with NULL account_id should still be returned in transaction list queries
- **Filtering**: When filtering by account_id, explicitly check for NULL values if needed
- **Validation**: Transaction creation still requires account_id, but existing transactions can have NULL

### Frontend Implications (Future Enhancement)
- **Display**: Orphaned transactions (account_id = NULL) should show "Deleted Account" or similar indicator
- **Filtering**: Add filter option to show/hide orphaned transactions
- **Account Detail Page**: Don't include orphaned transactions in account-specific views
- **Transaction List**: Include orphaned transactions in global transaction views with visual indicator

**Note**: Frontend changes for orphaned transaction display are NOT part of this fix and can be addressed in a future enhancement. The current fix focuses on preventing the deletion error and preserving data integrity.

## Database Migration Safety

The migration will:
1. Be reversible (downgrade drops CASCADE/SET NULL and recreates original constraints)
2. Not affect existing data (only modifies constraint behavior)
3. Prevent future foreign key errors by properly handling related records
4. Preserve transaction history by orphaning rather than deleting

## Success Criteria

- ✅ No more foreign key constraint violation errors when deleting accounts
- ✅ Family page deletion blocked for multi-shared accounts with clear error message
- ✅ Main page deletion works regardless of share count
- ✅ AccountShare records automatically deleted when account is deleted (CASCADE)
- ✅ Transaction records preserved with account_id set to NULL when account is deleted (SET NULL)
- ✅ Orphaned transactions remain queryable and maintain their historical data
- ✅ All existing tests pass
- ✅ New tests validate share count logic, CASCADE behavior, and SET NULL behavior
