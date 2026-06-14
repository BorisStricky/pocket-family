# backend/api/app/services/categories.py
# Category-related service helpers relocated from routers/categories.py.
# Framework-agnostic: takes a plain AsyncSession as its first parameter. These
# functions do ALL DB access (select/get/add/delete), record building, and
# business-rule / authorization checks. They NEVER call commit/flush/rollback —
# the router owns the transaction boundary (see backend/CLAUDE.md
# "Transaction ownership").

from sqlmodel import select
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from ..models import Category, Transaction
from ..schemas import CategoryCreate, CategoryUpdate


async def build_category_read(session: AsyncSession, category_id: UUID, tenant_id: UUID) -> Optional[dict]:
    """Fetch a single category joined with its parent's name.

    Returns a dict shaped to match CategoryRead or None when not found.
    """
    Parent = aliased(Category)
    query = (
        select(Category, Parent.name.label("parent_name"))
        .outerjoin(Parent, Parent.id == Category.parent_id)
        .where(Category.id == category_id, Category.tenant_id == tenant_id)
    )
    result = await session.execute(query)
    row = result.first()
    if not row:
        return None
    category: Category = row[0]
    return {
        "id": category.id,
        "tenant_id": category.tenant_id,
        "name": category.name,
        "kind": category.kind,
        "parent_id": category.parent_id,
        "parent_name": row.parent_name,
        "icon": category.icon,
        "color": category.color,
        "created_at": category.created_at,
        "updated_at": category.updated_at,
    }


async def list_categories_for_tenant(session: AsyncSession, tenant_id: UUID) -> List[dict]:
    """Return all categories for a tenant, each enriched with its parent's name.

    The tenant filter is the multi-tenant isolation boundary and must always be
    present. Results are ordered by name (preserving the router's prior ordering).
    """
    Parent = aliased(Category)
    query = (
        select(Category, Parent.name.label("parent_name"))
        .outerjoin(Parent, Parent.id == Category.parent_id)
        .where(Category.tenant_id == tenant_id)
        .order_by(Category.name)
    )
    result = await session.execute(query)
    rows = result.all()
    categories_out: List[dict] = []
    for row in rows:
        category: Category = row[0]
        categories_out.append({
            "id": category.id,
            "tenant_id": category.tenant_id,
            "name": category.name,
            "kind": category.kind,
            "parent_id": category.parent_id,
            "parent_name": row.parent_name,
            "icon": category.icon,
            "color": category.color,
            "created_at": category.created_at,
            "updated_at": category.updated_at,
        })
    return categories_out


# ---------------------------------------------------------------------------
# Fetch + authorization helpers
#
# Centralize the repeated "load this category or 404 / verify it belongs to the
# active tenant" blocks. They raise HTTPException so a handler stays a thin
# orchestrator; they never commit.
# ---------------------------------------------------------------------------


async def authorize_category_in_tenant(
    session: AsyncSession, category_id: UUID, tenant_id: UUID, forbidden_detail: str
) -> Category:
    """Load a category and assert it belongs to the active tenant.

    Returns the validated category. Raises 404 if it does not exist, or 403 if it
    exists but belongs to another tenant (cross-tenant access is forbidden — the
    #1 multi-tenant isolation invariant). The 403 detail string is supplied by the
    caller so each endpoint preserves its exact, historically-asserted message.
    """
    category_record = await session.get(Category, category_id)
    if not category_record:
        raise HTTPException(status_code=404)
    if category_record.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=forbidden_detail)
    return category_record


# ---------------------------------------------------------------------------
# Persistence + business rules (build / add / delete records — pure staging).
# These never call flush or commit; the calling handler owns the unit of work.
# ---------------------------------------------------------------------------


async def create_category(session: AsyncSession, tenant_id: UUID, payload: CategoryCreate) -> Category:
    """Stage a new category within the given tenant (build + add only — no commit).

    The tenant_id is derived from the active context by the handler, never from
    the client body, to preserve tenant isolation. The returned record already
    carries its id (client-side uuid4 default) so the handler can build its read
    DTO after the commit without a flush.
    """
    category_record = Category(
        tenant_id=tenant_id,
        name=payload.name,
        parent_id=payload.parent_id,
        kind=payload.kind,
        icon=payload.icon,
        color=payload.color,
    )
    session.add(category_record)
    return category_record


# Fields that map to nullable DB columns and may legitimately be cleared to None.
# icon, color, and parent_id are genuinely nullable; name/kind are NOT NULL and a
# None there would raise an IntegrityError at commit time, so they are skipped.
_NULLABLE_CATEGORY_FIELDS = {"icon", "color", "parent_id"}


async def apply_category_update(
    session: AsyncSession, category_record: Category, payload: CategoryUpdate
) -> Category:
    """Apply a partial update to a category in place (build + add only — no commit).

    Uses exclude_unset so fields absent from the request body are not touched,
    while fields explicitly set to None (e.g. clearing an icon) are applied — but
    only for genuinely nullable columns.
    """
    for field_name, field_value in payload.model_dump(exclude_unset=True).items():
        if field_value is None and field_name not in _NULLABLE_CATEGORY_FIELDS:
            continue
        setattr(category_record, field_name, field_value)
    session.add(category_record)
    return category_record


async def assert_category_has_no_children(
    session: AsyncSession, category_id: UUID, tenant_id: UUID
) -> None:
    """Guard deletion: a category with child categories cannot be deleted.

    Raises 409 if any child category exists within the same tenant; the caller
    must delete child categories first. The tenant filter keeps the check scoped
    to the active tenant.
    """
    child_check = await session.execute(
        select(Category).where(
            Category.parent_id == category_id,
            Category.tenant_id == tenant_id,
        )
    )
    if child_check.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete category with subcategories. Delete child categories first.",
        )


async def reassign_or_block_transactions(
    session: AsyncSession,
    category_record: Category,
    tenant_id: UUID,
    reassign_to: Optional[UUID],
) -> None:
    """Handle transactions that reference a category about to be deleted.

    If the category has no transactions, this is a no-op. Otherwise a
    reassignment target must be provided and validated, and every referencing
    transaction is re-pointed at it (staged via session.add — no commit). All
    queries filter by tenant_id to preserve isolation.

    Raises:
        400 if the category has transactions but no reassign_to was provided.
        404 if reassign_to does not exist.
        403 if reassign_to belongs to a different tenant.
        400 if reassign_to is of a different kind than the category being deleted.
    """
    category_id = category_record.id

    # Does the category have any transactions at all? (limit(1) — existence only.)
    transaction_check = await session.execute(
        select(Transaction)
        .where(
            Transaction.category_id == category_id,
            Transaction.tenant_id == tenant_id,
        )
        .limit(1)
    )
    has_transactions = transaction_check.first() is not None

    if not has_transactions:
        return

    if not reassign_to:
        # Category has transactions but no reassignment target provided.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category has transactions. Provide reassign_to parameter to reassign transactions before deletion.",
        )

    # Validate reassign_to category exists and belongs to the same tenant.
    reassign_category = await session.get(Category, reassign_to)
    if not reassign_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reassignment category not found",
        )
    if reassign_category.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reassignment category must belong to the same tenant",
        )
    if reassign_category.kind != category_record.kind:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Reassignment category must be of the same kind ({category_record.kind})",
        )

    # Reassign all referencing transactions to the new category (staged only).
    result = await session.execute(
        select(Transaction).where(
            Transaction.category_id == category_id,
            Transaction.tenant_id == tenant_id,
        )
    )
    transactions_to_update = result.scalars().all()
    for transaction in transactions_to_update:
        transaction.category_id = reassign_to
        session.add(transaction)


async def delete_category_record(session: AsyncSession, category_record: Category) -> None:
    """Stage a category for deletion (no commit)."""
    await session.delete(category_record)


async def count_transactions_for_category(
    session: AsyncSession, category_id: UUID, tenant_id: UUID
) -> int:
    """Return the number of transactions referencing a category within a tenant.

    The tenant filter keeps the count scoped to the active tenant (isolation).
    """
    result = await session.execute(
        select(func.count(Transaction.id)).where(
            Transaction.category_id == category_id,
            Transaction.tenant_id == tenant_id,
        )
    )
    return result.scalar_one()
