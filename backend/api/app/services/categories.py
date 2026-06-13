# backend/api/app/services/categories.py
# Category-related service helpers relocated from routers/categories.py.
# Framework-agnostic: takes a plain AsyncSession as its first parameter.

from sqlmodel import select
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from ..models import Category


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
