from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import select, delete
from typing import List, Optional, Any
from uuid import UUID
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_

from ..models import Transaction, Account, Category, Membership, MembershipStatus, TransactionSource, CategoryKind, AccountShare
from ..schemas import TransactionCreate, TransactionRead, TransactionUpdate, ActiveContext
from ..deps import get_db, get_current_user, get_active_context

router = APIRouter(prefix="/transactions", tags=["transactions"])


async def _fetch_transaction_with_names(db: AsyncSession, tenant_id: UUID, transaction_id: UUID) -> Optional[dict]:
    """Fetch a single transaction joined with account and optional category names.

    Returns a dict shaped to match TransactionRead or None when not found.
    """
    query = (
        select(
            Transaction,
            Account.name.label("account_name"),
            Category.name.label("category_name"),
        )
        .outerjoin(Account, Account.id == Transaction.account_id)
        .outerjoin(Category, Category.id == Transaction.category_id)
        .where(Transaction.tenant_id == tenant_id, Transaction.id == transaction_id)
    )
    result = await db.execute(query)
    row = result.first()
    if not row:
        return None
    transaction: Transaction = row[0]
    return {
        "id": transaction.id,
        "tenant_id": transaction.tenant_id,
        "account_id": transaction.account_id,
        "account_name": row.account_name,
        "category_id": transaction.category_id,
        "category_name": row.category_name,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "transaction_date": transaction.transaction_date,
        "transaction_type": transaction.transaction_type,
        "description": transaction.description,
        "created_by": transaction.created_by,
        "created_at": transaction.created_at,
        "updated_at": transaction.updated_at,
        "reconciled": transaction.reconciled,
        "source": transaction.source,
    }


async def _rows_to_transaction_reads(rows: List[Any]) -> List[dict]:
    """Convert executed joined rows into list of dicts matching TransactionRead."""
    out: List[dict] = []
    for row in rows:
        transaction: Transaction = row[0]
        out.append({
            "id": transaction.id,
            "tenant_id": transaction.tenant_id,
            "account_id": transaction.account_id,
            "account_name": row.account_name,
            "category_id": transaction.category_id,
            "category_name": row.category_name,
            "amount": transaction.amount,
            "currency": transaction.currency,
            "transaction_date": transaction.transaction_date,
            "transaction_type": transaction.transaction_type,
            "description": transaction.description,
            "created_by": transaction.created_by,
            "created_at": transaction.created_at,
            "updated_at": transaction.updated_at,
            "reconciled": transaction.reconciled,
            "source": transaction.source,
        })
    return out


@router.post("", response_model=TransactionRead)
async def create_transaction(payload: TransactionCreate, db: AsyncSession = Depends(get_db), active_context: ActiveContext = Depends(get_active_context)):
    """Create a transaction within a tenant and update the associated account balance.

    The account balance is updated based on the transaction_type:
    - INCOME: increases the account balance
    - EXPENSE: decreases the account balance

    Args:
        payload: TransactionCreate schema containing tenant and account context and amounts.
        db: Async DB session.
        user: Current authenticated user creating the transaction.

    Returns:
        The created Transaction record.

    Raises:
        HTTPException 404 when the account does not exist.
        HTTPException 403 when the user is not an active member of the tenant.
    """
    user = active_context.active_user
    tenant = active_context.active_tenant

    # Validate account exists
    account = await db.get(Account, payload.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="account not found")

    try:
        # Create transaction record
        transaction_record = Transaction(
            tenant_id=tenant.id,
            account_id=payload.account_id,
            category_id=payload.category_id,
            amount=payload.amount,
            currency=payload.currency,
            transaction_date=payload.transaction_date,
            transaction_type=payload.transaction_type,
            description=payload.description,
            created_by=user.id,
            source=payload.source or TransactionSource.MANUAL,
        )
        db.add(transaction_record)

        # Update account balance based on transaction type
        # INCOME increases balance, EXPENSE decreases balance
        if payload.transaction_type == CategoryKind.INCOME:
            account.balance += payload.amount
        elif payload.transaction_type == CategoryKind.EXPENSE:
            account.balance -= payload.amount

        db.add(account)

        # Commit both transaction and account balance update atomically
        await db.commit()
        await db.refresh(transaction_record)
        await db.refresh(account)

    except Exception as error:
        # Rollback on any error to maintain consistency
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create transaction: {str(error)}"
        )

    # Return with names using a joined query
    transaction_read = await _fetch_transaction_with_names(db, tenant.id, transaction_record.id)
    return transaction_read


@router.get("", response_model=List[TransactionRead])
async def list_transactions(
    tenant_id: Optional[UUID] = Query(None),
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    category_id: Optional[UUID] = Query(None),
    account_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    scope: str = Query("tenant", regex="^(tenant|global)$"),
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context)
):
    """List transactions for a tenant or globally across all user's tenants with optional filtering.

    Args:
        start: Optional start date to filter transactions (inclusive).
        end: Optional end date to filter transactions (inclusive).
        category_id: Optional category id to filter by.
        account_id: Optional account id to filter by.
        search: Optional search term for case-insensitive full-text search across description field.
        scope: "tenant" (default) to filter by active tenant, "global" to query all user's tenants.
        db: Async DB session.
        active_context: Current authenticated user and tenant context.

    Returns:
        List of Transaction records matching the filters and scope.

    Raises:
        HTTPException 403 when the user is not a member of the requested tenant.
    """
    user = active_context.active_user
    tenant = active_context.active_tenant

    # Build a joined query to get account_name and category_name
    query = (
        select(
            Transaction,
            Account.name.label("account_name"),
            Category.name.label("category_name"),
        )
        .outerjoin(Account, Account.id == Transaction.account_id)
        .outerjoin(Category, Category.id == Transaction.category_id)
    )

    # Apply tenant filtering based on scope
    if scope == "global":
        # Query transactions across all tenants where user is an active member
        # First get all tenant_ids for this user
        memberships_query = select(Membership.tenant_id).where(
            Membership.user_id == user.id,
            Membership.status == MembershipStatus.ACTIVE
        )
        memberships_result = await db.execute(memberships_query)
        user_tenant_ids = [row[0] for row in memberships_result.all()]

        # Filter transactions by user's tenant IDs
        if user_tenant_ids:
            query = query.where(Transaction.tenant_id.in_(user_tenant_ids))
        else:
            # User has no active memberships, return empty list
            return []
    else:
        # Default: filter by active tenant only
        query = query.where(Transaction.tenant_id == tenant.id)

    # Apply optional filters
    if start:
        query = query.where(Transaction.transaction_date >= start)
    if end:
        query = query.where(Transaction.transaction_date <= end)
    if category_id:
        query = query.where(Transaction.category_id == category_id)
    if account_id:
        query = query.where(Transaction.account_id == account_id)
    if search:
        # Apply case-insensitive full-text search against description field
        # using SQL ILIKE pattern matching to filter at database level for efficiency
        search_pattern = f"%{search}%"
        query = query.where(Transaction.description.ilike(search_pattern))

    query = query.order_by(Transaction.transaction_date.desc())

    result = await db.execute(query)
    rows = result.all()
    return await _rows_to_transaction_reads(rows)


@router.get("/{transaction_id}", response_model=TransactionRead)
async def get_transaction(transaction_id: UUID, db: AsyncSession = Depends(get_db), active_context: ActiveContext = Depends(get_active_context)):
    """Retrieve a single transaction if the requester belongs to the same tenant.

    Args:
        transaction_id: UUID of the transaction.
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        The Transaction record when permitted.

    Raises:
        HTTPException 404 when transaction not found.
        HTTPException 403 when user is not a member of the transaction's tenant.
    """
    user = active_context.active_user
    tenant = active_context.active_tenant

    transaction_read = await _fetch_transaction_with_names(db, tenant.id, transaction_id)

    if not transaction_read:
        raise HTTPException(status_code=404)

    return transaction_read


@router.patch("/{transaction_id}", response_model=TransactionRead)
async def update_transaction(transaction_id: UUID, payload: TransactionUpdate, db: AsyncSession = Depends(get_db), active_context: ActiveContext = Depends(get_active_context)):
    """Update a transaction. Only the creator may modify their transaction.

    Args:
        transaction_id: UUID of the transaction to update.
        payload: TransactionUpdate schema with optional fields.
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        The updated Transaction record.

    Raises:
        HTTPException 404 when transaction not found.
        HTTPException 403 when requester is not the creator.
    """
    user = active_context.active_user
    tenant = active_context.active_tenant

    transaction_query = select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.tenant_id == tenant.id #tenant membership already verified in the active context
    )
    transaction_query_result = await db.execute(transaction_query)
    transaction_record = transaction_query_result.scalars().first()

    if not transaction_record:
        raise HTTPException(status_code=404)
    if transaction_record.created_by != user.id:
        raise HTTPException(status_code=403)

    # Validate account_id update if provided
    # Ensures multi-tenant safety by verifying account ownership
    if payload.account_id is not None:
        # Validate that new account exists
        new_account = await db.get(Account, payload.account_id)
        if not new_account:
            raise HTTPException(status_code=404, detail="Account not found")

        # Ensure account belongs to current user to prevent cross-user data manipulation
        if new_account.user_id != user.id:
            raise HTTPException(
                status_code=403,
                detail="Cannot assign transaction to another user's account"
            )

        # Update the account_id
        transaction_record.account_id = payload.account_id

    if payload.category_id is not None:
        transaction_record.category_id = payload.category_id
    if payload.amount is not None:
        transaction_record.amount = payload.amount
    if payload.currency is not None:
        transaction_record.currency = payload.currency
    if payload.transaction_date is not None:
        transaction_record.transaction_date = payload.transaction_date
    if payload.transaction_type is not None:
        transaction_record.transaction_type = payload.transaction_type
    if payload.description is not None:
        transaction_record.description = payload.description
    if payload.reconciled is not None:
        transaction_record.reconciled = payload.reconciled
    db.add(transaction_record)
    await db.commit()
    await db.refresh(transaction_record)
    transaction_read = await _fetch_transaction_with_names(db, tenant.id, transaction_record.id)
    return transaction_read


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(transaction_id: UUID, db: AsyncSession = Depends(get_db), active_context: ActiveContext = Depends(get_active_context)):
    """Delete a transaction. Only the creator may delete their transaction.

    Args:
        transaction_id: UUID of the transaction to delete.
        db: Async DB session.
        user: Current authenticated user.

    Raises:
        HTTPException 404 when transaction not found.
        HTTPException 403 when requester is not the creator.
    """
    user = active_context.active_user
    tenant = active_context.active_tenant

    transaction_query = select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.tenant_id == tenant.id #tenant membership already verified in the active context
    )
    transaction_query_result = await db.execute(transaction_query)
    transaction_record = transaction_query_result.scalars().first()
    
    if not transaction_record:
        raise HTTPException(status_code=404)
    if transaction_record.created_by != user.id:
        raise HTTPException(status_code=403)
    await db.execute(delete(Transaction).where(Transaction.id == transaction_id))
    await db.commit()
    return
