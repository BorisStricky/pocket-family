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

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, extract
from sqlalchemy.orm import aliased

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
