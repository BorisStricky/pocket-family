# backend/api/app/services/budgets.py
# Budget-related service helpers relocated from routers/budgets.py.
#
# Budgets are monthly spending limits scoped to a tenant. Each budget can
# be linked to one or more categories via the BudgetCategory join table.
# When a budget has no categories it acts as a "universal budget" tracking
# ALL tenant expense transactions for the month.
#
# Spent amounts are calculated on-read by aggregating expense transactions
# that match the budget's currency for the requested calendar month.
#
# All functions are framework-agnostic: they take a plain AsyncSession as their
# first parameter (named ``session``) so routers, workers, and tests can reuse them.

from fastapi import HTTPException, status
from sqlmodel import select, delete
from typing import List
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, extract
from sqlalchemy.orm import aliased

from ..schemas import BudgetCreate, BudgetUpdate

from ..models import (
    Budget,
    BudgetCategory,
    Category,
    Transaction,
    CategoryKind,
    Currency,
)


async def fetch_categories_for_budget(
    session: AsyncSession,
    budget_id: UUID,
    tenant_id: UUID,
) -> List[dict]:
    """Load all categories linked to a budget via the join table.

    Joins BudgetCategory with Category (and its optional parent) to produce
    dicts matching the CategoryRead schema. Results are filtered by tenant_id
    to enforce multi-tenant isolation.

    Args:
        session: Active async database session.
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
    category_result = await session.execute(category_query)
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


async def calculate_spent_for_budget(
    session: AsyncSession,
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
        session: Active async database session.
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

    spent_result = await session.execute(spent_query)
    return spent_result.scalar_one()


async def build_budget_read(
    session: AsyncSession,
    budget_record: Budget,
    tenant_id: UUID,
    month: int,
    year: int,
) -> dict:
    """Assemble a BudgetRead-shaped dict for a single budget.

    Loads the budget's categories and calculates spent for the given month.

    Args:
        session: Active async database session.
        budget_record: The Budget ORM instance.
        tenant_id: Tenant context for isolation filtering.
        month: Calendar month for spent calculation.
        year: Calendar year for spent calculation.

    Returns:
        Dict matching BudgetRead schema fields.
    """
    # Load categories linked to this budget
    category_list = await fetch_categories_for_budget(
        session, budget_record.id, tenant_id
    )

    # Extract category IDs for the spent calculation query
    linked_category_ids = [category_entry["id"] for category_entry in category_list]

    # Calculate how much has been spent against this budget
    spent_amount = await calculate_spent_for_budget(
        session,
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


async def validate_category_ids_belong_to_tenant(
    session: AsyncSession,
    category_ids: List[UUID],
    tenant_id: UUID,
) -> None:
    """Verify all provided category IDs belong to the given tenant.

    Raises 400 if any category does not exist or belongs to a different
    tenant. This prevents cross-tenant category linkage which would
    violate multi-tenant isolation.

    Args:
        session: Active async database session.
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
    category_result = await session.execute(category_query)
    found_categories = category_result.scalars().all()

    if len(found_categories) != len(category_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more category IDs are invalid or do not belong to this tenant",
        )


async def sync_budget_categories(
    session: AsyncSession,
    budget_id: UUID,
    tenant_id: UUID,
    category_ids: List[UUID],
) -> None:
    """Replace all BudgetCategory rows for a budget with a new set.

    Deletes existing associations and inserts new ones. This full-replacement
    approach is simpler and safer than diffing, especially when the category
    set is typically small.

    Args:
        session: Active async database session.
        budget_id: The budget to update associations for.
        tenant_id: Tenant context (set on each BudgetCategory row).
        category_ids: New set of category UUIDs to associate.
    """
    # Remove all existing category associations for this budget
    delete_query = delete(BudgetCategory).where(
        BudgetCategory.budget_id == budget_id,
        BudgetCategory.tenant_id == tenant_id,
    )
    await session.execute(delete_query)

    # Insert new category associations
    for category_id in category_ids:
        budget_category_record = BudgetCategory(
            tenant_id=tenant_id,
            budget_id=budget_id,
            category_id=category_id,
        )
        session.add(budget_category_record)


# ---------------------------------------------------------------------------
# Fetch + read queries
#
# These centralize the "load this budget or 404 (scoped to tenant)" and the
# tenant-scoped listing blocks that previously lived inline in the handlers.
# They raise HTTPException so a handler stays a thin orchestrator; they never
# commit.
# ---------------------------------------------------------------------------

async def get_budget_or_404(
    session: AsyncSession,
    budget_id: UUID,
    tenant_id: UUID,
) -> Budget:
    """Load a budget by id scoped to the tenant, raising 404 if absent.

    The tenant_id filter is part of the lookup (not a separate check) so a
    budget belonging to another tenant is indistinguishable from a missing one
    — this preserves multi-tenant isolation and avoids leaking existence.

    Args:
        session: Active async database session.
        budget_id: UUID of the budget to load.
        tenant_id: Active tenant context for isolation filtering.

    Returns:
        The matching Budget ORM instance.

    Raises:
        HTTPException 404 when no budget matches the id within the tenant.
    """
    budget_result = await session.execute(
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
    return budget_record


async def list_budgets_for_tenant(
    session: AsyncSession,
    tenant_id: UUID,
) -> List[Budget]:
    """Return every budget belonging to the tenant, ordered by name.

    Args:
        session: Active async database session.
        tenant_id: Active tenant context for isolation filtering.

    Returns:
        List of Budget ORM instances ordered by name. The caller maps each
        through build_budget_read for spent/category enrichment.
    """
    budget_query = (
        select(Budget)
        .where(Budget.tenant_id == tenant_id)
        .order_by(Budget.name)
    )
    budget_result = await session.execute(budget_query)
    return budget_result.scalars().all()


# ---------------------------------------------------------------------------
# Persistence (build / add / delete records — pure staging).
#
# These never call flush or commit. They stage work on the request-scoped
# session; the calling handler owns the unit-of-work boundary (commit / rollback
# / refresh) so a budget row plus its category links land atomically under one
# commit. See backend/CLAUDE.md "Transaction ownership".
# ---------------------------------------------------------------------------

# Fields that map to nullable DB columns and may legitimately be cleared to None.
# name/amount/currency are NOT NULL, so a None for them is ignored to avoid an
# IntegrityError at commit time.
_NULLABLE_BUDGET_FIELDS = {"icon", "color"}


async def create_budget(
    session: AsyncSession,
    tenant_id: UUID,
    payload: BudgetCreate,
) -> Budget:
    """Stage a new budget and its category links (build + add only — no commit).

    Validates that any provided category_ids belong to the tenant before staging
    the join rows. Budget.id is a client-side uuid4 default, so the category
    links can reference it without an intervening flush. The handler owns the
    single commit that lands the budget row and its links atomically.

    Args:
        session: Active async database session.
        tenant_id: Active tenant context (set as the budget's tenant).
        payload: BudgetCreate with name, amount, currency, optional category_ids.

    Returns:
        The staged Budget ORM instance.

    Raises:
        HTTPException 400 when one or more category IDs are invalid.
    """
    # Validate that all provided categories belong to this tenant before staging.
    if payload.category_ids:
        await validate_category_ids_belong_to_tenant(
            session, payload.category_ids, tenant_id
        )

    budget_record = Budget(
        tenant_id=tenant_id,
        name=payload.name,
        amount=payload.amount,
        currency=payload.currency or Currency.BRL,
        icon=payload.icon,
        color=payload.color,
    )
    session.add(budget_record)

    # Create BudgetCategory join rows if categories were specified.
    if payload.category_ids:
        await sync_budget_categories(
            session, budget_record.id, tenant_id, payload.category_ids
        )

    return budget_record


async def apply_budget_update(
    session: AsyncSession,
    budget_record: Budget,
    tenant_id: UUID,
    payload: BudgetUpdate,
) -> Budget:
    """Apply a partial update to a budget in place (no commit).

    Scalar fields are applied with exclude_unset so absent fields are untouched;
    None is ignored for NOT NULL columns (name/amount/currency) and only allowed
    to clear the nullable icon/color columns. When category_ids is explicitly
    provided (not None) the entire category set is replaced after validation;
    when omitted the existing categories remain unchanged.

    Args:
        session: Active async database session.
        budget_record: The Budget ORM instance to mutate.
        tenant_id: Active tenant context for category validation/sync.
        payload: BudgetUpdate with optional fields.

    Returns:
        The updated Budget ORM instance.

    Raises:
        HTTPException 400 when provided category IDs are invalid.
    """
    scalar_updates = payload.model_dump(exclude_unset=True, exclude={"category_ids"})
    for field_name, field_value in scalar_updates.items():
        if field_value is None and field_name not in _NULLABLE_BUDGET_FIELDS:
            continue
        setattr(budget_record, field_name, field_value)

    # Update the modification timestamp.
    budget_record.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Replace the category set when category_ids is explicitly provided.
    if payload.category_ids is not None:
        await validate_category_ids_belong_to_tenant(
            session, payload.category_ids, tenant_id
        )
        await sync_budget_categories(
            session, budget_record.id, tenant_id, payload.category_ids
        )

    session.add(budget_record)
    return budget_record


async def delete_budget(session: AsyncSession, budget_record: Budget) -> None:
    """Stage a budget for deletion (no commit).

    The CASCADE foreign key on BudgetCategory removes the join rows when the
    budget is deleted, so only the budget record needs to be staged here.
    """
    await session.delete(budget_record)
