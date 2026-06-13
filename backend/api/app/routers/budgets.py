# Budget CRUD router with multi-category spent calculation.
#
# Budgets are monthly spending limits scoped to a tenant. Each budget can
# be linked to one or more categories via the BudgetCategory join table.
# When a budget has no categories it acts as a "universal budget" tracking
# ALL tenant expense transactions for the month.
#
# Spent amounts are calculated on-read by aggregating expense transactions
# that match the budget's currency for the requested calendar month.

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    Budget,
    Currency,
)
from ..schemas import (
    BudgetCreate,
    BudgetRead,
    BudgetUpdate,
    ActiveContext,
)
from ..deps import get_db, get_active_context, require_owner
from ..services import budgets as budget_service

router = APIRouter(prefix="/budgets", tags=["budgets"])


# ---------------------
# Endpoints
# ---------------------

@router.get("", response_model=List[BudgetRead])
async def list_budgets(
    database_session: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
):
    """List all budgets for the active tenant with spent calculations.

    Returns every budget belonging to the tenant. For each budget the
    spent amount is computed by aggregating expense transactions that
    match the budget's currency in the specified calendar month.

    Query parameters month and year default to the current month when
    not provided, allowing the client to view historical data.

    Args:
        database_session: Async database session dependency.
        active_context: Authenticated user/tenant context from JWT.
        month: Calendar month for spent calculation (1-12, default current).
        year: Calendar year for spent calculation (default current).

    Returns:
        List of BudgetRead dicts with populated spent and categories.
    """
    tenant_id = active_context.active_tenant.id

    # Default to current month/year when not specified by the client
    current_datetime = datetime.now(timezone.utc).replace(tzinfo=None)
    effective_month = month if month is not None else current_datetime.month
    effective_year = year if year is not None else current_datetime.year

    # Fetch all budgets belonging to this tenant
    budget_query = (
        select(Budget)
        .where(Budget.tenant_id == tenant_id)
        .order_by(Budget.name)
    )
    budget_result = await database_session.execute(budget_query)
    budget_records = budget_result.scalars().all()

    # Build BudgetRead for each budget with categories and spent
    budget_read_list: List[dict] = []
    for budget_record in budget_records:
        budget_read = await budget_service.build_budget_read(
            database_session, budget_record, tenant_id, effective_month, effective_year
        )
        budget_read_list.append(budget_read)

    return budget_read_list


@router.get("/{budget_id}", response_model=BudgetRead)
async def get_budget(
    budget_id: UUID,
    database_session: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
):
    """Retrieve a single budget by ID with spent calculation.

    Verifies the budget exists and belongs to the active tenant before
    returning it. The spent amount is computed for the requested month.

    Args:
        budget_id: UUID of the budget to retrieve.
        database_session: Async database session dependency.
        active_context: Authenticated user/tenant context from JWT.
        month: Calendar month for spent calculation (default current).
        year: Calendar year for spent calculation (default current).

    Returns:
        BudgetRead dict with populated spent and categories.

    Raises:
        HTTPException 404 when budget not found or wrong tenant.
    """
    tenant_id = active_context.active_tenant.id

    # Default to current month/year when not specified
    current_datetime = datetime.now(timezone.utc).replace(tzinfo=None)
    effective_month = month if month is not None else current_datetime.month
    effective_year = year if year is not None else current_datetime.year

    # Fetch the budget ensuring tenant isolation
    budget_result = await database_session.execute(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.tenant_id == tenant_id,
        )
    )
    budget_record = budget_result.scalar_one_or_none()

    if not budget_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found",
        )

    return await budget_service.build_budget_read(
        database_session, budget_record, tenant_id, effective_month, effective_year
    )


@router.post("", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate,
    database_session: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(require_owner),
):
    """Create a new budget for the active tenant.

    Only users with the OWNER role can create budgets. If category_ids
    are provided they are validated to belong to the same tenant before
    linking. The response includes spent calculation for the current month.

    Args:
        payload: BudgetCreate schema with name, amount, currency, and
                 optional category_ids.
        database_session: Async database session dependency.
        active_context: Authenticated user/tenant context from JWT.

    Returns:
        BudgetRead dict for the newly created budget.

    Raises:
        HTTPException 403 when the user is not an OWNER.
        HTTPException 400 when category IDs are invalid.
    """
    # OWNER role is enforced by the require_owner dependency.
    tenant_id = active_context.active_tenant.id

    # Validate that all provided categories belong to this tenant
    if payload.category_ids:
        await budget_service.validate_category_ids_belong_to_tenant(
            database_session, payload.category_ids, tenant_id
        )

    # Create the budget record
    budget_record = Budget(
        tenant_id=tenant_id,
        name=payload.name,
        amount=payload.amount,
        currency=payload.currency or Currency.BRL,
        icon=payload.icon,
        color=payload.color,
    )
    database_session.add(budget_record)
    await database_session.flush()

    # Create BudgetCategory join rows if categories were specified
    if payload.category_ids:
        await budget_service.sync_budget_categories(
            database_session, budget_record.id, tenant_id, payload.category_ids
        )

    await database_session.commit()
    await database_session.refresh(budget_record)

    # Return the budget with spent calculation for the current month
    current_datetime = datetime.now(timezone.utc).replace(tzinfo=None)
    return await budget_service.build_budget_read(
        database_session,
        budget_record,
        tenant_id,
        current_datetime.month,
        current_datetime.year,
    )


@router.patch("/{budget_id}", response_model=BudgetRead)
async def update_budget(
    budget_id: UUID,
    payload: BudgetUpdate,
    database_session: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(require_owner),
):
    """Update an existing budget.

    Only users with the OWNER role can update budgets. When category_ids
    is provided in the payload, the entire category set is replaced (not
    merged). When category_ids is omitted, existing categories remain.

    Args:
        budget_id: UUID of the budget to update.
        payload: BudgetUpdate schema with optional fields.
        database_session: Async database session dependency.
        active_context: Authenticated user/tenant context from JWT.

    Returns:
        Updated BudgetRead dict with recalculated spent.

    Raises:
        HTTPException 403 when the user is not an OWNER.
        HTTPException 404 when budget not found.
        HTTPException 400 when category IDs are invalid.
    """
    # OWNER role is enforced by the require_owner dependency.
    tenant_id = active_context.active_tenant.id

    # Fetch the budget ensuring tenant isolation
    budget_result = await database_session.execute(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.tenant_id == tenant_id,
        )
    )
    budget_record = budget_result.scalar_one_or_none()

    if not budget_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found",
        )

    # Apply scalar field updates from the payload. Use exclude_unset so fields absent
    # from the request body are not touched, while fields explicitly set to None
    # (e.g. clearing an icon) are applied. category_ids is excluded here because it
    # requires special sync logic handled separately below.
    # Guard against None being passed for NOT NULL columns (e.g. name, amount, currency)
    # which would cause an IntegrityError at commit time. Only icon and color are
    # genuinely nullable database columns and may legitimately be cleared to null.
    NULLABLE_FIELDS = {'icon', 'color'}
    scalar_updates = payload.model_dump(exclude_unset=True, exclude={"category_ids"})
    for field_name, field_value in scalar_updates.items():
        if field_value is None and field_name not in NULLABLE_FIELDS:
            continue
        setattr(budget_record, field_name, field_value)

    # Update the modification timestamp
    budget_record.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Replace the category set when category_ids is explicitly provided.
    # When category_ids is None (omitted from payload), leave unchanged.
    if payload.category_ids is not None:
        await budget_service.validate_category_ids_belong_to_tenant(
            database_session, payload.category_ids, tenant_id
        )
        await budget_service.sync_budget_categories(
            database_session, budget_record.id, tenant_id, payload.category_ids
        )

    database_session.add(budget_record)
    await database_session.commit()
    await database_session.refresh(budget_record)

    # Return with recalculated spent for the current month
    current_datetime = datetime.now(timezone.utc).replace(tzinfo=None)
    return await budget_service.build_budget_read(
        database_session,
        budget_record,
        tenant_id,
        current_datetime.month,
        current_datetime.year,
    )


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: UUID,
    database_session: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(require_owner),
):
    """Delete a budget and its category associations.

    Only users with the OWNER role can delete budgets. The CASCADE
    foreign key on BudgetCategory automatically removes join rows
    when the budget is deleted.

    Args:
        budget_id: UUID of the budget to delete.
        database_session: Async database session dependency.
        active_context: Authenticated user/tenant context from JWT.

    Raises:
        HTTPException 403 when the user is not an OWNER.
        HTTPException 404 when budget not found.
    """
    # OWNER role is enforced by the require_owner dependency.
    tenant_id = active_context.active_tenant.id

    # Fetch the budget ensuring tenant isolation
    budget_result = await database_session.execute(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.tenant_id == tenant_id,
        )
    )
    budget_record = budget_result.scalar_one_or_none()

    if not budget_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found",
        )

    await database_session.delete(budget_record)
    await database_session.commit()
    return None
