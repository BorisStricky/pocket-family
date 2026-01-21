from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from ..models import Category, MembershipRole
from ..schemas import CategoryCreate, CategoryRead, CategoryUpdate, ActiveContext
from ..deps import get_db, get_active_context

router = APIRouter(prefix="/categories", tags=["categories"]) 


async def _fetch_category_with_parent(db: AsyncSession, category_id: UUID, tenant_id: UUID) -> Optional[dict]:
    """Fetch a single category joined with its parent's name.

    Returns a dict shaped to match CategoryRead or None when not found.
    """
    Parent = aliased(Category)
    query = (
        select(Category, Parent.name.label("parent_name"))
        .outerjoin(Parent, Parent.id == Category.parent_id)
        .where(Category.id == category_id, Category.tenant_id == tenant_id)
    )
    result = await db.execute(query)
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
        "created_at": category.created_at,
        "updated_at": category.updated_at,
    }


@router.post("", response_model=CategoryRead)
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """Create a new category within the active tenant.

    Tenant and membership are derived from the access token via
    `get_active_context`. Mutation operations require the requester to be
    an OWNER of the tenant (enforced via the active membership role).
    """
    # Enforce role-based authorization: only owners may create categories.
    if active_context.active_membership.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only owners can create categories")

    category_record = Category(
        tenant_id=active_context.active_tenant.id,
        name=payload.name,
        parent_id=payload.parent_id,
        kind=payload.kind,
    )
    db.add(category_record)
    await db.commit()
    await db.refresh(category_record)
    # Return with parent_name using a joined query
    category_read = await _fetch_category_with_parent(db, category_record.id, active_context.active_tenant.id)
    return category_read


@router.get("", response_model=List[CategoryRead])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """List categories for the active tenant.

    No additional membership lookup is required because `get_active_context`
    already validated the membership and returned the active tenant.
    """
    Parent = aliased(Category)
    query = (
        select(Category, Parent.name.label("parent_name"))
        .outerjoin(Parent, Parent.id == Category.parent_id)
        .where(Category.tenant_id == active_context.active_tenant.id)
        .order_by(Category.name)
    )
    result = await db.execute(query)
    rows = result.all()
    out: List[dict] = []
    for row in rows:
        category: Category = row[0]
        out.append({
            "id": category.id,
            "tenant_id": category.tenant_id,
            "name": category.name,
            "kind": category.kind,
            "parent_id": category.parent_id,
            "parent_name": row.parent_name,
            "created_at": category.created_at,
            "updated_at": category.updated_at,
        })
    return out


@router.get("/{category_id}", response_model=CategoryRead)
async def get_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """Retrieve a category by id if it belongs to the active tenant."""
    category_read = await _fetch_category_with_parent(db, category_id, active_context.active_tenant.id)
    if not category_read:
        raise HTTPException(status_code=404)
    return category_read


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """Update an existing category within the active tenant.

    Only OWNERs may perform mutations.
    """
    category_record = await db.get(Category, category_id)
    if not category_record:
        raise HTTPException(status_code=404)
    if category_record.tenant_id != active_context.active_tenant.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only change categories within the active tenant")

    # Enforce owner role for updates
    if active_context.active_membership.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only owners can update categories")

    if payload.name is not None:
        category_record.name = payload.name
    if payload.kind is not None:
        category_record.kind = payload.kind
    if payload.parent_id is not None:
        category_record.parent_id = payload.parent_id
    db.add(category_record)
    await db.commit()
    await db.refresh(category_record)
    # Return with parent_name using a joined query
    category_read = await _fetch_category_with_parent(db, category_record.id, active_context.active_tenant.id)
    return category_read


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    active_context: ActiveContext = Depends(get_active_context),
):
    """Delete a category if it belongs to the active tenant and the user is an OWNER."""
    category_record = await db.get(Category, category_id)
    if not category_record:
        raise HTTPException(status_code=404)
    if category_record.tenant_id != active_context.active_tenant.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    # Enforce owner role for deletes
    if active_context.active_membership.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only owners can delete categories")

    await db.delete(category_record)
    await db.commit()
    return
