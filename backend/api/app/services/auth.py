# backend/api/app/services/auth.py
# Auth-related service helpers relocated from routers/auth.py.
# Framework-agnostic: takes a plain AsyncSession as its session parameter.

from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID

from ..models import User, Membership
from ..schemas import MembershipStatus


async def resolve_membership_for_user(
    user: User,
    tenant_uuid: Optional[UUID],
    session: AsyncSession
) -> Optional[Membership]:
    """Get membership for user, handling preferred tenant logic.

    Logic:
    1. If tenant_uuid provided: return that specific membership
    2. If not provided and user has preferred_tenant_id: return preferred membership
    3. Otherwise: fall back to first active membership

    Returns None if no valid membership found.
    """
    if tenant_uuid:
        # Case 1: Explicit tenant provided
        membership_query = select(Membership).where(
            Membership.user_id == user.id,
            Membership.tenant_id == tenant_uuid
        )
        membership_query_result = await session.execute(membership_query)
        return membership_query_result.scalars().first()

    # Case 2: No explicit tenant - check preferred
    if user.preferred_tenant_id:
        membership_query = select(Membership).where(
            Membership.user_id == user.id,
            Membership.tenant_id == user.preferred_tenant_id,
            Membership.status == MembershipStatus.ACTIVE
        )
        membership_query_result = await session.execute(membership_query)
        membership = membership_query_result.scalars().first()

        if membership:
            return membership
        # If preferred tenant membership is invalid, fall through to default

    # Case 3: Fall back to first active membership
    membership_query = select(Membership).where(
        Membership.user_id == user.id,
        Membership.status == MembershipStatus.ACTIVE
    )
    membership_query_result = await session.execute(membership_query)
    return membership_query_result.scalars().first()
