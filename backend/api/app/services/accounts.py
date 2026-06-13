# backend/api/app/services/accounts.py
# Account-related service helpers relocated from routers/accounts.py.
# These functions interact with the database directly and are framework-agnostic
# (they take a plain AsyncSession), so routers, workers, and tests can all reuse them.

from fastapi import HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User, Account, AccountShare, Membership, MembershipRole, MembershipStatus, ShareVisibility, Tenant


async def authorize_share_target(session: AsyncSession, user, target_tenant_id) -> Membership:
    """Authorize sharing an account INTO a target tenant (family).

    Centralizes the rule used by both account-sharing paths: the actor must be an
    ACTIVE member of the target tenant and must not be a VIEWER (viewers are
    read-only and may not introduce accounts into a family). Returns the validated
    active Membership.

    Raises:
        HTTPException 404 if the target tenant does not exist.
        HTTPException 403 if the user is not an active member of it.
        HTTPException 403 if the user's role in it is VIEWER.
    """
    # Validate the target tenant exists. We return 404 (rather than silently
    # proceeding) so a caller can't share into a non-existent family.
    target_tenant = await session.get(Tenant, target_tenant_id)
    if not target_tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target tenant not found",
        )

    # Validate the user is an ACTIVE member of the target tenant. Sharing into a
    # family the actor doesn't belong to is the broken-access-control gap we close.
    membership_check_query = select(Membership).where(
        Membership.user_id == user.id,
        Membership.tenant_id == target_tenant_id,
        Membership.status == MembershipStatus.ACTIVE,
    )
    membership_check_result = await session.execute(membership_check_query)
    target_membership = membership_check_result.scalars().first()

    if not target_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an active member of the target tenant",
        )

    # Viewers have read-only access and may not share accounts into the family.
    if target_membership.role == MembershipRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot share accounts with a family",
        )

    return target_membership


async def build_account_read(session: AsyncSession, account: Account, requestor) -> dict:
    """Serialize an Account for API responses, masking balance when appropriate.

    If the requestor is the account owner the balance is included. Otherwise the
    function checks tenant-based AccountShare records to decide if the
    balance should be visible to the requestor (based on the requestor's active
    memberships/tenants).

    Additionally this function now includes the owner's user_name so the
    frontend can display the account owner without extra queries.
    """
    # Resolve owner's display name
    owner = await session.get(User, account.user_id)
    user_name = owner.name if owner and owner.name else ""

    # Determine visibility of balance
    if account.user_id == requestor.id:
        balance_decimal = account.balance
    else:
        # find user's active memberships
        membership_query_result = await session.execute(select(Membership).where(Membership.user_id == requestor.id, Membership.status == MembershipStatus.ACTIVE))
        membership_records = membership_query_result.scalars().all()
        tenant_ids = [m.tenant_id for m in membership_records] if membership_records else []
        balance_decimal = None
        if tenant_ids:
            share_query = select(AccountShare).where(AccountShare.account_id == account.id, AccountShare.tenant_id.in_(tenant_ids))
            share_query_result = await session.execute(share_query)
            share = share_query_result.scalars().first()
            if share and share.visibility == ShareVisibility.VISIBLE:
                balance_decimal = account.balance

    return {
        "id": account.id,
        "user_id": account.user_id,
        "user_name": user_name,
        "name": account.name,
        "type": account.type,
        "currency": account.currency,
        "balance": balance_decimal,
        "icon": account.icon,
        "color": account.color,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }


async def build_account_share_read(session: AsyncSession, share: AccountShare) -> dict:
    """Serialize an AccountShare for API responses, including tenant name.

    Fetches the tenant (family) name to provide a human-readable display name
    instead of just the tenant UUID, improving the frontend user experience.

    Args:
        session: Database session for fetching related tenant data.
        share: AccountShare record to serialize.

    Returns:
        Dictionary with all share fields plus tenant_name for display.
    """
    # Fetch the tenant to get its name
    tenant = await session.get(Tenant, share.tenant_id)
    tenant_name = tenant.name if tenant and tenant.name else ""

    return {
        "id": share.id,
        "account_id": share.account_id,
        "tenant_id": share.tenant_id,
        "tenant_name": tenant_name,
        "visibility": share.visibility,
        "granted_by": share.granted_by,
        "granted_at": share.granted_at,
    }


async def can_access_account(session: AsyncSession, account: Account, requestor) -> bool:
    """Return True when the requestor is allowed to view the given account.

    Access is granted only to the account owner, or to a user who is an active
    member of a tenant the account has been shared with via AccountShare. This
    prevents an IDOR where any authenticated user could read another user's
    account metadata and owner PII by guessing/iterating UUIDs (Security H-1).
    """
    # Owner always has access.
    if account.user_id == requestor.id:
        return True

    # Otherwise require an AccountShare to one of the requestor's active tenants.
    membership_query_result = await session.execute(
        select(Membership.tenant_id).where(
            Membership.user_id == requestor.id,
            Membership.status == MembershipStatus.ACTIVE,
        )
    )
    tenant_ids = [row[0] for row in membership_query_result.all()]
    if not tenant_ids:
        return False

    share_query_result = await session.execute(
        select(AccountShare.id).where(
            AccountShare.account_id == account.id,
            AccountShare.tenant_id.in_(tenant_ids),
        )
    )
    return share_query_result.first() is not None
