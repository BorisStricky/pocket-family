# backend/api/app/routers/categories.py
#
# HTTP boundary for /categories. Handlers stay thin: they resolve dependencies
# (including role gates via require_owner / get_active_context), call
# services/categories.py for all queries / record building / business rules, and
# own only the transaction boundary (commit / refresh). No raw SQL or
# session.add/get/delete lives here — that is the service layer's job.
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas import CategoryCreate, CategoryRead, CategoryUpdate, ActiveContext
from ..deps import get_db, get_active_context, require_owner
from ..services import categories as category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.post("", response_model=CategoryRead)
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(require_owner),
):
    """Create a new category within the active tenant.

    Tenant and membership are derived from the access token via
    `require_owner`, which both resolves the active context and enforces that
    the requester is an OWNER of the tenant (otherwise 403).
    """
    category_record = await category_service.create_category(
        db, active_context.active_tenant.id, payload
    )
    await db.commit()
    await db.refresh(category_record)
    # Return with parent_name using a joined query
    return await category_service.build_category_read(
        db, category_record.id, active_context.active_tenant.id
    )


@router.get("", response_model=List[CategoryRead])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """List categories for the active tenant.

    No additional membership lookup is required because `get_active_context`
    already validated the membership and returned the active tenant.
    """
    return await category_service.list_categories_for_tenant(
        db, active_context.active_tenant.id
    )


@router.get("/{category_id}", response_model=CategoryRead)
async def get_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """Retrieve a category by id if it belongs to the active tenant."""
    category_read = await category_service.build_category_read(
        db, category_id, active_context.active_tenant.id
    )
    if not category_read:
        raise HTTPException(status_code=404)
    return category_read


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(require_owner),
):
    """Update an existing category within the active tenant.

    Only OWNERs may perform mutations (enforced by `require_owner`).
    """
    category_record = await category_service.authorize_category_in_tenant(
        db,
        category_id,
        active_context.active_tenant.id,
        forbidden_detail="You can only change categories within the active tenant",
    )
    await category_service.apply_category_update(db, category_record, payload)
    await db.commit()
    await db.refresh(category_record)
    # Return with parent_name using a joined query
    return await category_service.build_category_read(
        db, category_record.id, active_context.active_tenant.id
    )


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    reassign_to: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(require_owner),
):
    """Delete a category if it belongs to the active tenant and the user is an OWNER.

    The OWNER role requirement is enforced by `require_owner`. Before deletion,
    this also validates:
    - Category has no child categories (returns 409 if it does)
    - If category has transactions, reassign_to must be provided

    If reassign_to is provided, all transactions using this category will be
    reassigned to the specified category before deletion. The whole unit of work
    (reassignment + delete) lands in a single commit.
    """
    tenant_id = active_context.active_tenant.id

    category_record = await category_service.authorize_category_in_tenant(
        db, category_id, tenant_id, forbidden_detail="forbidden"
    )

    # Cannot delete a parent that still has child categories.
    await category_service.assert_category_has_no_children(db, category_id, tenant_id)

    # Reassign (or block on) any transactions that reference this category.
    await category_service.reassign_or_block_transactions(
        db, category_record, tenant_id, reassign_to
    )

    # All validations passed, safe to delete.
    await category_service.delete_category_record(db, category_record)
    await db.commit()
    return


@router.get("/{category_id}/transaction-count", response_model=int)
async def get_category_transaction_count(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """Get the count of transactions using this category.

    Returns the number of transactions that reference this category.
    Used by the frontend to determine if a category can be safely deleted
    or if transaction reassignment is required.
    """
    # First verify the category exists and belongs to the active tenant.
    await category_service.authorize_category_in_tenant(
        db, category_id, active_context.active_tenant.id, forbidden_detail="forbidden"
    )
    return await category_service.count_transactions_for_category(
        db, category_id, active_context.active_tenant.id
    )
