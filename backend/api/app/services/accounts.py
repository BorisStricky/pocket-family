# backend/api/app/services/accounts.py
# Account-related service helpers relocated from routers/accounts.py.
# These functions interact with the database directly and are framework-agnostic
# (they take a plain AsyncSession), so routers, workers, and tests can all reuse them.

from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User, Account, AccountShare, Membership, MembershipRole, MembershipStatus, ShareVisibility, Tenant
from ..schemas import AccountCreate, AccountUpdate, AccountShareUpdate


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


# ---------------------------------------------------------------------------
# Fetch + authorization helpers
#
# These centralize the repeated "load this record or 404 / verify ownership"
# blocks that previously lived inline in every accounts handler. They raise
# HTTPException so a handler stays a thin orchestrator; they never commit.
# ---------------------------------------------------------------------------

# A single owner-guard message. The previous inline checks used six slightly
# different strings ("only owner can update account", "only account owner can
# share", ...); none were asserted by tests, so they are unified here.
_OWNER_ONLY_DETAIL = "only the account owner may perform this action"


async def get_account_or_404(session: AsyncSession, account_id: UUID) -> Account:
    """Load an account by id, raising 404 if it does not exist."""
    account_record = await session.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return account_record


async def authorize_account_owner(session: AsyncSession, account_id: UUID, user: User) -> Account:
    """Load an account and assert the caller owns it.

    Account mutations (and share management) are authorized purely by ownership,
    not by family/tenant role (see the user-scoped invariant in north_star §9).
    Returns the owned account; raises 404 if missing, 403 if the caller is not
    the owner.
    """
    account_record = await get_account_or_404(session, account_id)
    if account_record.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_OWNER_ONLY_DETAIL)
    return account_record


async def authorize_active_member(session: AsyncSession, user: User, tenant_id: UUID) -> Membership:
    """Assert the caller is an ACTIVE member (any role) of the given tenant.

    Used by the family-scoped account listing: viewers are allowed to *see*
    accounts shared into a family, so unlike authorize_share_target this does
    not exclude the VIEWER role. Returns the membership; raises 403 otherwise.
    """
    membership_check_query = select(Membership).where(
        Membership.user_id == user.id,
        Membership.tenant_id == tenant_id,
        Membership.status == MembershipStatus.ACTIVE,
    )
    membership_check_result = await session.execute(membership_check_query)
    membership_record = membership_check_result.scalars().first()
    if not membership_record:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an active member of the specified tenant",
        )
    return membership_record


async def get_account_share_or_404(session: AsyncSession, account_id: UUID, tenant_id: UUID) -> AccountShare:
    """Load the share linking an account to a tenant, raising 404 if absent."""
    share_query = select(AccountShare).where(
        AccountShare.account_id == account_id,
        AccountShare.tenant_id == tenant_id,
    )
    share_query_result = await session.execute(share_query)
    account_share_record = share_query_result.scalars().first()
    if not account_share_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return account_share_record


# ---------------------------------------------------------------------------
# Read queries (return ORM records; the handler maps them through build_*_read)
# ---------------------------------------------------------------------------

async def list_accounts_owned_by_user(session: AsyncSession, user_id: UUID) -> List[Account]:
    """Return every account personally owned by the user."""
    result = await session.execute(select(Account).where(Account.user_id == user_id))
    return result.scalars().all()


async def list_accounts_shared_with_tenant(session: AsyncSession, tenant_id: UUID) -> List[Account]:
    """Return accounts shared into a tenant (family) via AccountShare."""
    shared_accounts_query = (
        select(Account)
        .join(AccountShare, AccountShare.account_id == Account.id)
        .where(AccountShare.tenant_id == tenant_id)
    )
    result = await session.execute(shared_accounts_query)
    return result.scalars().all()


async def list_shares_for_account(session: AsyncSession, account_id: UUID) -> List[AccountShare]:
    """Return every share record for a given account."""
    result = await session.execute(
        select(AccountShare).where(AccountShare.account_id == account_id)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Persistence (build / add / delete records — pure staging).
#
# These never call flush or commit. They stage work on the request-scoped
# session; the calling handler owns every unit-of-work boundary call (flush
# when a multi-step sequence needs ordering, then the single commit) so the
# operation stays atomic. See backend/CLAUDE.md "Transaction ownership".
# ---------------------------------------------------------------------------

async def create_account(session: AsyncSession, user: User, payload: AccountCreate) -> Account:
    """Stage a new personal account (build + add only — no flush, no commit).

    Pure staging: the handler owns the unit of work (flush / commit). The returned
    record already carries its id because Account.id is a client-side uuid4 default,
    so a follow-up share insert can reference account_record.id without a flush.
    """
    account_record = Account(
        user_id=user.id,
        name=payload.name,
        type=payload.type,
        currency=payload.currency,
        balance=payload.balance or 0,
        icon=payload.icon,
        color=payload.color,
    )
    session.add(account_record)
    return account_record


async def create_share(
    session: AsyncSession,
    account_id: UUID,
    tenant_id: UUID,
    visibility: ShareVisibility,
    granted_by_user_id: UUID,
) -> AccountShare:
    """Stage a new AccountShare, enforcing one share per (account, tenant).

    Pure staging (build + add — no flush, no commit); the handler owns the unit
    of work. The single share-creation point, used by both the create-time path
    (create_account) and the dedicated /shares endpoint. Raises 409 if a share
    already exists for the pair. Authorization (ownership + target-tenant
    membership) is the handler's job. On a brand-new account the uniqueness check
    simply finds nothing — cheap, and it keeps the one-share-per-(account, tenant)
    invariant enforced in one place.
    """
    existing_share_query = select(AccountShare).where(
        AccountShare.account_id == account_id,
        AccountShare.tenant_id == tenant_id,
    )
    existing_share_result = await session.execute(existing_share_query)
    if existing_share_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="share for this account and tenant already exists",
        )

    account_share_record = AccountShare(
        account_id=account_id,
        tenant_id=tenant_id,
        visibility=visibility,
        granted_by=granted_by_user_id,
    )
    session.add(account_share_record)
    return account_share_record


# Fields that map to nullable DB columns and may legitimately be cleared to None.
_NULLABLE_ACCOUNT_FIELDS = {"icon", "color"}


async def apply_account_update(
    session: AsyncSession, account_record: Account, payload: AccountUpdate
) -> Account:
    """Apply a partial update to an account in place (no commit).

    Uses exclude_unset so absent fields are untouched. Guards against None being
    written to NOT NULL columns (name/balance/type/currency) which would raise an
    IntegrityError at commit; only icon and color may be explicitly cleared.
    """
    for field_name, field_value in payload.model_dump(exclude_unset=True).items():
        if field_value is None and field_name not in _NULLABLE_ACCOUNT_FIELDS:
            continue
        setattr(account_record, field_name, field_value)
    session.add(account_record)
    return account_record


async def update_share_visibility(
    session: AsyncSession, account_id: UUID, tenant_id: UUID, payload: AccountShareUpdate
) -> AccountShare:
    """Load a share (404 if absent) and apply a visibility change (no commit)."""
    account_share_record = await get_account_share_or_404(session, account_id, tenant_id)
    if payload.visibility is not None:
        account_share_record.visibility = payload.visibility
    session.add(account_share_record)
    return account_share_record


async def delete_share(session: AsyncSession, account_id: UUID, tenant_id: UUID) -> None:
    """Load a share (404 if absent) and stage it for deletion (no commit)."""
    account_share_record = await get_account_share_or_404(session, account_id, tenant_id)
    await session.delete(account_share_record)


async def assert_account_deletable_from_family_context(session: AsyncSession, account_id: UUID) -> None:
    """Guard deletion initiated from a family page.

    An account shared with more than one family cannot be deleted from a family
    context (it would silently vanish from the others); the user must delete it
    from the main accounts page instead. Raises 409 in that case.
    """
    share_count_query = select(func.count(AccountShare.id)).where(
        AccountShare.account_id == account_id
    )
    share_count = (await session.execute(share_count_query)).scalar_one()
    if share_count > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account is shared with multiple families and can only be deleted from the main accounts page",
        )


async def delete_account_record(session: AsyncSession, account_record: Account) -> None:
    """Stage an account for deletion (no commit). CASCADE/SET NULL handle relations."""
    await session.delete(account_record)
