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
from sqlmodel import select, delete
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, extract
from sqlalchemy.orm import aliased

from ..models import (
    Budget,
    BudgetCategory,
    Category,
    Transaction,
    CategoryKind,
    MembershipRole,
    Currency,
)
from ..schemas import (
    BudgetCreate,
    BudgetRead,
    BudgetUpdate,
    CategoryRead,
    ActiveContext,
)
from ..deps import get_db, get_active_context

router = APIRouter(prefix="/budgets", tags=["budgets"])


async def _fetch_categories_for_budget(
    database_session: AsyncSession,
    budget_id: UUID,
    tenant_id: UUID,
) -> List[dict]:
    """Load all categories linked to a budget via the join table.

    Joins BudgetCategory with Category (and its optional parent) to produce
    dicts matching the CategoryRead schema. Results are filtered by tenant_id
    to enforce multi-tenant isolation.

    Args:
        database_session: Active async database session.
        budget_id: The budget whose categories to load.
        tenant_id: Tenant context for isolation filtering.

    Returns:
        List of dicts shaped to match CategoryRead.
    """
    ParentCategory = aliased(Category)
    category_query = (
        select(Category, ParentCategory.name.label("parent_name"))
        .join(BudgetCategory, BudgetCategory.category_id == Category.id)
        .outerjoin(ParentCategory, ParentCategory.id == Category.parent_id)
        .where(
            BudgetCategory.budget_id == budget_id,
            BudgetCategory.tenant_id == tenant_id,
        )
        .order_by(Category.name)
    )
    category_result = await database_session.execute(category_query)
    category_rows = category_result.all()

    category_list: List[dict] = []
    for row in category_rows:
        category_record: Category = row[0]
        category_list.append({
            "id": category_record.id,
            "tenant_id": category_record.tenant_id,
            "name": category_record.name,
            "kind": category_record.kind,
            "parent_id": category_record.parent_id,
            "parent_name": row.parent_name,
            "icon": category_record.icon,
            "color": category_record.color,
            "created_at": category_record.created_at,
            "updated_at": category_record.updated_at,
        })
    return category_list


async def _calculate_spent_for_budget(
    database_session: AsyncSession,
    tenant_id: UUID,
    budget_currency: Currency,
    category_ids: List[UUID],
    month: int,
    year: int,
) -> Decimal:
    """Calculate total expense spending for a budget in a given month.

    Aggregates expense transactions filtered by the budget's currency and
    the requested calendar month. When category_ids is empty (universal
    budget), ALL tenant expense transactions matching the currency are
    summed. Otherwise only transactions in the specified categories count.

    Args:
        database_session: Active async database session.
        tenant_id: Tenant context for isolation filtering.
        budget_currency: Only sum transactions matching this currency.
        category_ids: Category UUIDs to filter by. Empty means all.
        month: Calendar month (1-12).
        year: Calendar year.

    Returns:
        Total spent as a Decimal, defaulting to 0.00 when no transactions.
    """
    spent_query = select(func.coalesce(func.sum(Transaction.amount), Decimal("0.00"))).where(
        Transaction.tenant_id == tenant_id,
        Transaction.transaction_type == CategoryKind.EXPENSE,
        Transaction.currency == budget_currency,
        extract("month", Transaction.transaction_date) == month,
        extract("year", Transaction.transaction_date) == year,
    )

    # If the budget has specific categories, filter to only those categories.
    # Otherwise (universal budget), sum ALL tenant expense transactions.
    if category_ids:
        spent_query = spent_query.where(Transaction.category_id.in_(category_ids))

    spent_result = await database_session.execute(spent_query)
    return spent_result.scalar_one()


async def _build_budget_read(
    database_session: AsyncSession,
    budget_record: Budget,
    tenant_id: UUID,
    month: int,
    year: int,
) -> dict:
    """Assemble a BudgetRead-shaped dict for a single budget.

    Loads the budget's categories and calculates spent for the given month.

    Args:
        database_session: Active async database session.
        budget_record: The Budget ORM instance.
        tenant_id: Tenant context for isolation filtering.
        month: Calendar month for spent calculation.
        year: Calendar year for spent calculation.

    Returns:
        Dict matching BudgetRead schema fields.
    """
    # Load categories linked to this budget
    category_list = await _fetch_categories_for_budget(
        database_session, budget_record.id, tenant_id
    )

    # Extract category IDs for the spent calculation query
    linked_category_ids = [category_entry["id"] for category_entry in category_list]

    # Calculate how much has been spent against this budget
    spent_amount = await _calculate_spent_for_budget(
        database_session,
        tenant_id,
        budget_record.currency,
        linked_category_ids,
        month,
        year,
    )

    return {
        "id": budget_record.id,
        "tenant_id": budget_record.tenant_id,
        "name": budget_record.name,
        "amount": budget_record.amount,
        "currency": budget_record.currency,
        "categories": category_list,
        "spent": spent_amount,
        "month": month,
        "year": year,
        "icon": budget_record.icon,
        "color": budget_record.color,
        "created_at": budget_record.created_at,
        "updated_at": budget_record.updated_at,
    }


async def _validate_category_ids_belong_to_tenant(
    database_session: AsyncSession,
    category_ids: List[UUID],
    tenant_id: UUID,
) -> None:
    """Verify all provided category IDs belong to the given tenant.

    Raises 400 if any category does not exist or belongs to a different
    tenant. This prevents cross-tenant category linkage which would
    violate multi-tenant isolation.

    Args:
        database_session: Active async database session.
        category_ids: UUIDs to validate.
        tenant_id: Expected tenant owner of the categories.

    Raises:
        HTTPException 400 when one or more categories are invalid.
    """
    if not category_ids:
        return

    category_query = select(Category).where(
        Category.id.in_(category_ids),
        Category.tenant_id == tenant_id,
    )
    category_result = await database_session.execute(category_query)
    found_categories = category_result.scalars().all()

    if len(found_categories) != len(category_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more category IDs are invalid or do not belong to this tenant",
        )


async def _sync_budget_categories(
    database_session: AsyncSession,
    budget_id: UUID,
    tenant_id: UUID,
    category_ids: List[UUID],
) -> None:
    """Replace all BudgetCategory rows for a budget with a new set.

    Deletes existing associations and inserts new ones. This full-replacement
    approach is simpler and safer than diffing, especially when the category
    set is typically small.

    Args:
        database_session: Active async database session.
        budget_id: The budget to update associations for.
        tenant_id: Tenant context (set on each BudgetCategory row).
        category_ids: New set of category UUIDs to associate.
    """
    # Remove all existing category associations for this budget
    delete_query = delete(BudgetCategory).where(
        BudgetCategory.budget_id == budget_id,
        BudgetCategory.tenant_id == tenant_id,
    )
    await database_session.execute(delete_query)

    # Insert new category associations
    for category_id in category_ids:
        budget_category_record = BudgetCategory(
            tenant_id=tenant_id,
            budget_id=budget_id,
            category_id=category_id,
        )
        database_session.add(budget_category_record)


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
        budget_read = await _build_budget_read(
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

    return await _build_budget_read(
        database_session, budget_record, tenant_id, effective_month, effective_year
    )


@router.post("", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate,
    database_session: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
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
    # Only owners can create budgets
    if active_context.active_membership.role != MembershipRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can create budgets",
        )

    tenant_id = active_context.active_tenant.id

    # Validate that all provided categories belong to this tenant
    if payload.category_ids:
        await _validate_category_ids_belong_to_tenant(
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
        await _sync_budget_categories(
            database_session, budget_record.id, tenant_id, payload.category_ids
        )

    await database_session.commit()
    await database_session.refresh(budget_record)

    # Return the budget with spent calculation for the current month
    current_datetime = datetime.now(timezone.utc).replace(tzinfo=None)
    return await _build_budget_read(
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
    active_context: ActiveContext = Depends(get_active_context),
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
    # Only owners can update budgets
    if active_context.active_membership.role != MembershipRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can update budgets",
        )

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
    scalar_updates = payload.model_dump(exclude_unset=True, exclude={"category_ids"})
    for field_name, field_value in scalar_updates.items():
        setattr(budget_record, field_name, field_value)

    # Update the modification timestamp
    budget_record.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Replace the category set when category_ids is explicitly provided.
    # When category_ids is None (omitted from payload), leave unchanged.
    if payload.category_ids is not None:
        await _validate_category_ids_belong_to_tenant(
            database_session, payload.category_ids, tenant_id
        )
        await _sync_budget_categories(
            database_session, budget_record.id, tenant_id, payload.category_ids
        )

    database_session.add(budget_record)
    await database_session.commit()
    await database_session.refresh(budget_record)

    # Return with recalculated spent for the current month
    current_datetime = datetime.now(timezone.utc).replace(tzinfo=None)
    return await _build_budget_read(
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
    active_context: ActiveContext = Depends(get_active_context),
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
    # Only owners can delete budgets
    if active_context.active_membership.role != MembershipRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can delete budgets",
        )

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
