import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import select, delete
from typing import List, Optional, Any
from uuid import UUID
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_

from ..models import Transaction, Account, Category, Membership, MembershipRole, MembershipStatus, TransactionSource, TransactionType, CategoryKind, AccountShare, User, Tenant
from ..schemas import TransactionCreate, TransactionRead, TransactionUpdate, ActiveContext
from ..deps import get_db, get_current_user, get_active_context

router = APIRouter(prefix="/transactions", tags=["transactions"])

# Hard upper bound on how many transactions a single list request may return.
# This is both the default and the maximum, so the read path is always bounded —
# the grid/dashboard/reports cannot accidentally pull an unbounded result set
# (Performance P-1). Clients page through older rows with ?offset=.
MAX_TRANSACTIONS_PAGE_SIZE = 500


async def _authorize_account_for_tenant(
    db: AsyncSession,
    account_id: UUID,
    active_user: User,
    active_tenant: Tenant,
) -> Account:
    """Return the account only if it is writable from the active tenant context.

    Access rule (mirrors imports.py /imports/execute): the active user must own
    the account directly, OR the account must be shared with the active tenant
    via an AccountShare record. Without this guard any authenticated member could
    POST a transaction against an arbitrary account UUID and mutate another user's
    balance (cross-tenant write — Security C-1).

    Raises:
        HTTPException 404 when the account does not exist.
        HTTPException 403 when the account is not accessible from the active tenant.
    """
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="account not found")

    # Owner access is always permitted.
    if account.user_id == active_user.id:
        return account

    # Otherwise the account must be explicitly shared with the active tenant.
    share_result = await db.execute(
        select(AccountShare).where(
            AccountShare.account_id == account.id,
            AccountShare.tenant_id == active_tenant.id,
        )
    )
    if share_result.scalars().first() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not accessible from the active family",
        )
    return account


def _balance_delta(transaction_type: "CategoryKind | TransactionType", amount: Decimal) -> Decimal:
    """Compute the signed balance delta a transaction applies to its account.

    INCOME increases the balance, EXPENSE decreases it. Reversing a transaction's
    effect is simply applying the negation of this delta.
    """
    if transaction_type == CategoryKind.INCOME:
        return amount
    if transaction_type == CategoryKind.EXPENSE:
        return -amount
    # Defensive default: unknown types apply no balance change.
    return Decimal("0")


async def _fetch_transaction_with_names(db: AsyncSession, tenant_id: UUID, transaction_id: UUID) -> Optional[dict]:
    """Fetch a single transaction joined with account and optional category names.

    Returns a dict shaped to match TransactionRead or None when not found.
    """
    query = (
        select(
            Transaction,
            Account.name.label("account_name"),
            Account.icon.label("account_icon"),
            Account.color.label("account_color"),
            Category.name.label("category_name"),
            # Resolve icon and color from Category for visual display in the UI
            Category.icon.label("category_icon"),
            Category.color.label("category_color"),
            # Resolve the creator's display name for the response payload
            User.name.label("created_by_name"),
        )
        .outerjoin(Account, Account.id == Transaction.account_id)
        .outerjoin(Category, Category.id == Transaction.category_id)
        .outerjoin(User, User.id == Transaction.created_by)
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
        "account_icon": row.account_icon,
        "account_color": row.account_color,
        "category_id": transaction.category_id,
        "category_name": row.category_name,
        "category_icon": row.category_icon,
        "category_color": row.category_color,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "transaction_date": transaction.transaction_date,
        "transaction_type": transaction.transaction_type,
        "description": transaction.description,
        "created_by": transaction.created_by,
        # Include the creator's display name resolved from the User join
        "created_by_name": row.created_by_name,
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
            "account_icon": row.account_icon,
            "account_color": row.account_color,
            "category_id": transaction.category_id,
            "category_name": row.category_name,
            "category_icon": row.category_icon,
            "category_color": row.category_color,
            "amount": transaction.amount,
            "currency": transaction.currency,
            "transaction_date": transaction.transaction_date,
            "transaction_type": transaction.transaction_type,
            "description": transaction.description,
            "created_by": transaction.created_by,
            # Include the creator's display name resolved from the User join
            "created_by_name": row.created_by_name,
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

    # Viewers have read-only access to the family's data; only members and owners may write.
    if active_context.active_membership.role == MembershipRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot create transactions",
        )

    # Validate the account exists AND is writable from the active tenant context.
    # This blocks the cross-tenant write where any member could post against an
    # arbitrary account UUID and mutate another user's balance (Security C-1).
    account = await _authorize_account_for_tenant(db, payload.account_id, user, tenant)

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
        account.balance += _balance_delta(payload.transaction_type, payload.amount)

        db.add(account)

        # Commit both transaction and account balance update atomically
        await db.commit()
        await db.refresh(transaction_record)
        await db.refresh(account)

    except Exception as error:
        # Rollback on any error to maintain consistency
        await db.rollback()
        logger = logging.getLogger(__name__)
        logger.exception("Failed to create transaction")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create transaction"
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
    limit: int = Query(MAX_TRANSACTIONS_PAGE_SIZE, ge=1, le=MAX_TRANSACTIONS_PAGE_SIZE),
    offset: int = Query(0, ge=0),
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
        limit: Max rows to return. Bounded by MAX_TRANSACTIONS_PAGE_SIZE so a single
            request can never trigger an unbounded scan/serialization (Performance P-1).
        offset: Number of rows to skip, for cursor-less pagination.
        db: Async DB session.
        active_context: Current authenticated user and tenant context.

    Returns:
        List of Transaction records matching the filters and scope.

    Raises:
        HTTPException 403 when the user is not a member of the requested tenant.
    """
    user = active_context.active_user
    tenant = active_context.active_tenant

    # Build a joined query to get account/category name, icon, color and created_by_name
    query = (
        select(
            Transaction,
            Account.name.label("account_name"),
            Account.icon.label("account_icon"),
            Account.color.label("account_color"),
            Category.name.label("category_name"),
            # Resolve icon and color from Category for visual display in the UI
            Category.icon.label("category_icon"),
            Category.color.label("category_color"),
            # Resolve the creator's display name so the frontend can show who created each transaction
            User.name.label("created_by_name"),
        )
        .outerjoin(Account, Account.id == Transaction.account_id)
        .outerjoin(Category, Category.id == Transaction.category_id)
        .outerjoin(User, User.id == Transaction.created_by)
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

    # Most-recent first, then bound the result window. ORDER BY before LIMIT keeps
    # the newest transactions visible even when the result set is truncated.
    query = query.order_by(Transaction.transaction_date.desc())
    query = query.offset(offset).limit(limit)

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

    # Viewers have read-only access to the family's data.
    if active_context.active_membership.role == MembershipRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot modify transactions",
        )

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

    # Capture the transaction's CURRENT effect on its account before applying any
    # changes. Editing amount/type/account must reverse the old effect and apply
    # the new one, otherwise the account balance drifts permanently (money-
    # correctness defect — Blocker 2).
    previous_account_id = transaction_record.account_id
    previous_delta = _balance_delta(transaction_record.transaction_type, transaction_record.amount)

    # Validate account_id update if provided. Use the shared authorization guard
    # so a transaction can only be reassigned to an account that is writable from
    # the active tenant (owner or AccountShare) — never an arbitrary UUID.
    if payload.account_id is not None:
        await _authorize_account_for_tenant(db, payload.account_id, user, tenant)
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

    # Re-balance the affected account(s) in this same DB transaction.
    new_account_id = transaction_record.account_id
    new_delta = _balance_delta(transaction_record.transaction_type, transaction_record.amount)

    if previous_account_id == new_account_id:
        # Same account: apply only the net change so we don't double-count.
        if new_account_id is not None and new_delta != previous_delta:
            account = await db.get(Account, new_account_id)
            if account is not None:
                account.balance += new_delta - previous_delta
                db.add(account)
    else:
        # Account changed: fully reverse from the old account, fully apply to the new.
        if previous_account_id is not None:
            previous_account = await db.get(Account, previous_account_id)
            if previous_account is not None:
                previous_account.balance -= previous_delta
                db.add(previous_account)
        if new_account_id is not None:
            new_account = await db.get(Account, new_account_id)
            if new_account is not None:
                new_account.balance += new_delta
                db.add(new_account)

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

    # Viewers have read-only access to the family's data.
    if active_context.active_membership.role == MembershipRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot delete transactions",
        )

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

    # Reverse this transaction's effect on its account before deleting, so the
    # account balance stays correct (Blocker 2). account_id may be None when the
    # owning account was already deleted (SET NULL) — nothing to reverse then.
    if transaction_record.account_id is not None:
        account = await db.get(Account, transaction_record.account_id)
        if account is not None:
            account.balance -= _balance_delta(
                transaction_record.transaction_type, transaction_record.amount
            )
            db.add(account)

    await db.execute(delete(Transaction).where(Transaction.id == transaction_id))
    await db.commit()
    return
