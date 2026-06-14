# backend/api/app/routers/accounts.py
#
# HTTP boundary for /accounts. Handlers stay thin: they resolve dependencies,
# call services/accounts.py for all queries / record building / business rules,
# and own only the transaction boundary (commit / rollback / refresh). No raw
# SQL or session.add/get/delete lives here — that is the service layer's job.
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas import AccountCreate, AccountRead, AccountUpdate, AccountShareRead, AccountShareCreate, AccountShareUpdate
from ..deps import get_db, get_current_user
from ..services import accounts as account_service

router = APIRouter(prefix="/accounts", tags=["accounts"])

# Account CRUD (create / update / delete) is authorized by ownership (account.user_id == user.id),
# NOT by the caller's family/tenant role. This is intentional: accounts are personal financial
# instruments that belong to the individual user, not to any family they happen to be a member of.
# The "viewer" role restricts what a member can do with shared family data (transactions, categories,
# budgets). It is not a global write gate over a user's own accounts. Adding require_role guards here
# would incorrectly block viewers from managing their own personal finances.
# See docs/north_star.md §9 "Finding 2" for the full invariant documentation.
@router.post("", response_model=AccountRead)
async def create_account(payload: AccountCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Create a new account owned by the authenticated user.

    Optionally shares the account with another tenant atomically in a single transaction.
    If share_with is provided, validates that the user is an active member of that tenant
    before creating both the account and the share.

    Args:
        payload: AccountCreate schema with account properties and optional share_with.
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        The created Account instance.

    Raises:
        HTTPException 403 when share_with tenant provided but user is not an active member.
        HTTPException 404 when share_with tenant does not exist.
    """
    # Authorize sharing before any writes so a 403/404 is not reported as a 500.
    # The shared rule (active member + not a viewer) lives in the service layer so
    # this path and the dedicated /shares endpoint stay in lock-step.
    if payload.share_with:
        await account_service.authorize_share_target(db, user, payload.share_with.tenant_id)

    # Orchestrate the unit of work: create the account, then (if requested) stage
    # the share, then commit once so both rows land atomically — or roll back together.
    try:
        account_record = await account_service.create_account(db, user, payload)
        if payload.share_with:
            await account_service.create_share(
                db, account_record.id, payload.share_with.tenant_id, payload.share_with.visibility, user.id
            )
        await db.commit()
        await db.refresh(account_record)
    except Exception as error:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create account: {str(error)}"
        )

    return await account_service.build_account_read(db, account_record, user)


@router.get("", response_model=List[AccountRead])
async def list_accounts(
    tenant_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """List accounts belonging to the user and accounts shared with their families (tenants).

    When tenant_id is provided, only returns accounts shared with that specific tenant.
    User must be an active member of the specified tenant.

    Args:
        tenant_id: Optional tenant ID to filter accounts shared with that tenant.
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        List of serialized account dicts (balance masked according to visibility rules).

    Raises:
        HTTPException 403 when user is not an active member of the specified tenant.
    """
    # Family-scoped view: only accounts shared with the requested tenant, and only
    # for active members of it (viewers included — they may see shared accounts).
    if tenant_id:
        await account_service.authorize_active_member(db, user, tenant_id)
        shared_account_records = await account_service.list_accounts_shared_with_tenant(db, tenant_id)
        return [await account_service.build_account_read(db, account_record, user) for account_record in shared_account_records]

    # Global view: ONLY accounts owned by this user. Accounts shared with families
    # are intentionally excluded here — they appear in the family-scoped view above,
    # so a user never sees other members' accounts in the global "All Accounts" list.
    my_account_records = await account_service.list_accounts_owned_by_user(db, user.id)
    return [await account_service.build_account_read(db, account_record, user) for account_record in my_account_records]


@router.get("/{account_id}", response_model=AccountRead)
async def get_account(account_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Get a single account by id and serialize according to requestor privileges.

    Args:
        account_id: UUID of the account.
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        Serialized account dict (balance may be masked).

    Raises:
        HTTPException 404 when the account does not exist OR the requestor has no
            access to it. We return 404 (not 403) so the endpoint does not reveal
            whether an account UUID exists to an unauthorized caller.
    """
    account_record = await account_service.get_account_or_404(db, account_id)

    # Enforce access control before returning any account fields (anti-IDOR). The
    # predicate returns a bool so the handler can choose 404 (hide existence)
    # rather than 403.
    if not await account_service.can_access_account(db, account_record, user):
        raise HTTPException(status_code=404)

    return await account_service.build_account_read(db, account_record, user)


@router.get("/{account_id}/shares", response_model=List[AccountShareRead])
async def get_account_shares(account_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Return shares for a given account; only the account owner may view shares.

    Args:
        account_id: UUID of the account.
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        List of AccountShare records for the account.

    Raises:
        HTTPException 404 when account not found.
        HTTPException 403 when requester is not the owner.
    """
    await account_service.authorize_account_owner(db, account_id, user)
    account_share_records = await account_service.list_shares_for_account(db, account_id)
    return [await account_service.build_account_share_read(db, share) for share in account_share_records]


@router.post("/{account_id}/shares", response_model=AccountShareRead)
async def create_account_share(account_id: UUID, payload: AccountShareCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Create an AccountShare linking an account to a tenant (family).

    The account owner may grant visibility to another tenant.
    """
    await account_service.authorize_account_owner(db, account_id, user)

    # Authorize sharing INTO the target tenant: the caller must be an active member
    # and not a viewer. This also validates the tenant exists (404), closing the
    # broken-access-control gap where an owner could share into a family they don't
    # belong to.
    await account_service.authorize_share_target(db, user, payload.tenant_id)

    account_share_record = await account_service.create_share(db, account_id, payload.tenant_id, payload.visibility, user.id)
    await db.commit()
    await db.refresh(account_share_record)
    return await account_service.build_account_share_read(db, account_share_record)


@router.patch("/{account_id}/shares/{tenant_id}", response_model=AccountShareRead)
async def update_account_share(account_id: UUID, tenant_id: UUID, payload: AccountShareUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Update properties of an account share identified by tenant_id. Only account owner can modify."""
    await account_service.authorize_account_owner(db, account_id, user)
    account_share_record = await account_service.update_share_visibility(db, account_id, tenant_id, payload)
    await db.commit()
    await db.refresh(account_share_record)
    return await account_service.build_account_share_read(db, account_share_record)


@router.delete("/{account_id}/shares/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account_share(account_id: UUID, tenant_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Delete an account share identified by tenant_id. Only the account owner may delete."""
    await account_service.authorize_account_owner(db, account_id, user)
    await account_service.delete_share(db, account_id, tenant_id)
    await db.commit()
    return


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(account_id: UUID, payload: AccountUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Update account fields. Only the account owner may modify.

    Args:
        account_id: UUID of the account to update.
        payload: AccountUpdate schema with optional fields.
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        The updated Account instance.

    Raises:
        HTTPException 404 when account is not found.
        HTTPException 403 when requester is not the owner.
    """
    account_record = await account_service.authorize_account_owner(db, account_id, user)
    await account_service.apply_account_update(db, account_record, payload)
    await db.commit()
    await db.refresh(account_record)
    return await account_service.build_account_read(db, account_record, user)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    from_family_context: bool = False,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Delete an account. Only the account owner may delete their account.

    When deleting from a family context (family detail page), the account can only
    be deleted if it is shared with exactly one family. If shared with multiple
    families, the user must delete from the main accounts page instead.

    Args:
        account_id: UUID of the account to delete.
        from_family_context: Whether deletion is initiated from family page context.
        db: Async DB session.
        user: Current authenticated user.

    Raises:
        HTTPException 404 when account does not exist.
        HTTPException 403 when requester is not the owner.
        HTTPException 409 when account is shared with multiple families and
                        deletion is attempted from family context.
    """
    account_record = await account_service.authorize_account_owner(db, account_id, user)

    if from_family_context:
        await account_service.assert_account_deletable_from_family_context(db, account_id)

    await account_service.delete_account_record(db, account_record)
    await db.commit()
    return
