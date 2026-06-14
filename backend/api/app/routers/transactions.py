import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas import TransactionCreate, TransactionRead, TransactionUpdate, ActiveContext
from ..deps import get_db, get_active_context, require_writer
from ..services import transactions as transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions"])

# Hard upper bound on how many transactions a single list request may return.
# This is both the default and the maximum, so the read path is always bounded —
# the grid/dashboard/reports cannot accidentally pull an unbounded result set
# (Performance P-1). Clients page through older rows with ?offset=.
MAX_TRANSACTIONS_PAGE_SIZE = 500


@router.post("", response_model=TransactionRead)
async def create_transaction(payload: TransactionCreate, db: AsyncSession = Depends(get_db), active_context: ActiveContext = Depends(require_writer)):
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

    # Viewers are blocked by the require_writer dependency; only members/owners reach here.

    # Validate the account exists AND is writable from the active tenant context.
    # This blocks the cross-tenant write where any member could post against an
    # arbitrary account UUID and mutate another user's balance (Security C-1).
    account = await transaction_service.authorize_account_for_tenant(db, payload.account_id, user, tenant)

    try:
        # Stage the transaction insert AND the account balance change together,
        # then commit once so both land atomically (or roll back together).
        transaction_record = await transaction_service.create_transaction(
            db, active_user=user, active_tenant=tenant, account=account, payload=payload
        )

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
    transaction_read = await transaction_service.build_transaction_read(db, tenant.id, transaction_record.id)
    return transaction_read


@router.get("", response_model=List[TransactionRead])
async def list_transactions(
    tenant_id: Optional[UUID] = Query(None),
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    category_id: Optional[UUID] = Query(None),
    account_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    scope: str = Query("tenant", pattern="^(tenant|global)$"),
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

    # All query construction, scope/tenant filtering, ordering and the bounded
    # window live in the service; the handler just resolves context and delegates.
    return await transaction_service.list_transactions(
        db,
        active_user=user,
        active_tenant=tenant,
        scope=scope,
        start=start,
        end=end,
        category_id=category_id,
        account_id=account_id,
        search=search,
        limit=limit,
        offset=offset,
    )


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

    transaction_read = await transaction_service.build_transaction_read(db, tenant.id, transaction_id)

    if not transaction_read:
        raise HTTPException(status_code=404)

    return transaction_read


@router.patch("/{transaction_id}", response_model=TransactionRead)
async def update_transaction(transaction_id: UUID, payload: TransactionUpdate, db: AsyncSession = Depends(get_db), active_context: ActiveContext = Depends(require_writer)):
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

    # Viewers are blocked by the require_writer dependency; only members/owners reach here.

    transaction_record = await transaction_service.get_transaction_for_tenant(db, tenant.id, transaction_id)

    if not transaction_record:
        raise HTTPException(status_code=404)
    if transaction_record.created_by != user.id:
        raise HTTPException(status_code=403)

    # The service applies the field updates and re-balances affected account(s);
    # the row mutation and the balance change are staged together so the single
    # commit below keeps them atomic.
    await transaction_service.apply_transaction_update(
        db,
        transaction_record=transaction_record,
        payload=payload,
        active_user=user,
        active_tenant=tenant,
    )

    await db.commit()
    await db.refresh(transaction_record)
    transaction_read = await transaction_service.build_transaction_read(db, tenant.id, transaction_record.id)
    return transaction_read


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(transaction_id: UUID, db: AsyncSession = Depends(get_db), active_context: ActiveContext = Depends(require_writer)):
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

    # Viewers are blocked by the require_writer dependency; only members/owners reach here.

    transaction_record = await transaction_service.get_transaction_for_tenant(db, tenant.id, transaction_id)

    if not transaction_record:
        raise HTTPException(status_code=404)
    if transaction_record.created_by != user.id:
        raise HTTPException(status_code=403)

    # The service reverses the balance effect and stages the row deletion; the
    # single commit below makes the reversal and the delete atomic.
    await transaction_service.delete_transaction(db, transaction_record)
    await db.commit()
    return
