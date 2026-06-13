# backend/api/app/routers/accounts.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import select
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Account, AccountShare, Membership, MembershipStatus
from ..schemas import AccountCreate, AccountRead, AccountUpdate, AccountShareRead, AccountShareCreate, AccountShareUpdate, AccountShareWith
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
    # If share_with is provided, validate user membership/role in the target tenant.
    # The shared authorization rule (active member + not a viewer) lives in the
    # service layer so this path and the dedicated /shares endpoint stay in lock-step.
    if payload.share_with:
        await account_service.authorize_share_target(db, user, payload.share_with.tenant_id)

    # Begin atomic transaction: create account and optionally create share
    try:
        # Create account
        account_record = Account(
            user_id=user.id,
            name=payload.name,
            type=payload.type,
            currency=payload.currency,
            balance=payload.balance or 0,
            icon=payload.icon,
            color=payload.color,
        )
        db.add(account_record)
        await db.flush()  # Flush to get account ID without committing transaction

        # If share_with provided, create AccountShare atomically
        if payload.share_with:
            account_share_record = AccountShare(
                account_id=account_record.id,
                tenant_id=payload.share_with.tenant_id,
                visibility=payload.share_with.visibility,
                granted_by=user.id
            )
            db.add(account_share_record)

        # Commit the transaction (both account and share if present)
        await db.commit()
        await db.refresh(account_record)

    except Exception as error:
        # Rollback transaction on any error
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create account: {str(error)}"
        )

    # Serialize to include user_name and respect balance visibility
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
    # If tenant_id is provided, validate user membership and return only accounts shared with that tenant
    if tenant_id:
        # Validate user is active member of specified tenant
        membership_check_query = select(Membership).where(
            Membership.user_id == user.id,
            Membership.tenant_id == tenant_id,
            Membership.status == MembershipStatus.ACTIVE
        )
        membership_check_result = await db.execute(membership_check_query)
        membership_record = membership_check_result.scalars().first()

        if not membership_record:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not an active member of the specified tenant"
            )

        # Return only accounts shared with this tenant
        accounts_shared_with_tenant_query = select(Account).join(
            AccountShare, AccountShare.account_id == Account.id
        ).where(AccountShare.tenant_id == tenant_id)
        shared_accounts_result = await db.execute(accounts_shared_with_tenant_query)
        shared_account_records = shared_accounts_result.scalars().all()

        # Serialize and return
        return [await account_service.build_account_read(db, account_record, user) for account_record in shared_account_records]

    # When no tenant_id filter is given, return ONLY accounts owned by this user.
    # Accounts shared with families (via AccountShare) are intentionally excluded here —
    # they are visible in the family-scoped view (?tenant_id=...) where they belong.
    # This prevents users from seeing other members' accounts in the global "All Accounts" view.
    my_accounts_query_result = await db.execute(select(Account).where(Account.user_id == user.id))
    my_account_records = my_accounts_query_result.scalars().all()

    # Serialize and return
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
    account_record = await db.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=404)

    # Enforce access control before returning any account fields (anti-IDOR).
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
    account_record = await db.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=404)
    if account_record.user_id != user.id:
        raise HTTPException(status_code=403, detail="only owner can list shares")
    shares_query_result = await db.execute(select(AccountShare).where(AccountShare.account_id == account_id))
    account_share_records = shares_query_result.scalars().all()

    # Serialize each share to include tenant_name
    serialized_shares = []
    for share in account_share_records:
        serialized_share = await account_service.build_account_share_read(db, share)
        serialized_shares.append(serialized_share)

    return serialized_shares


@router.post("/{account_id}/shares", response_model=AccountShareRead)
async def create_account_share(account_id: UUID, payload: AccountShareCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Create an AccountShare linking an account to a tenant (family).

    The account owner may grant visibility to another tenant.
    """
    account_record = await db.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=404, detail="account not found")
    if account_record.user_id != user.id:
        raise HTTPException(status_code=403, detail="only account owner can share")

    # Authorize sharing INTO the target tenant: the caller must be an active member
    # and not a viewer. This also validates the tenant exists (404), so it replaces
    # the previous standalone tenant-existence lookup and closes the broken-access-
    # control gap where an owner could share into a family they don't belong to.
    await account_service.authorize_share_target(db, user, payload.tenant_id)

    # ensure uniqueness: only one share per (account, tenant)
    existing_share_query = select(AccountShare).where(
        AccountShare.account_id == account_id,
        AccountShare.tenant_id == payload.tenant_id,
    )
    existing_share_result = await db.execute(existing_share_query)
    existing_share = existing_share_result.scalars().first()
    if existing_share:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="share for this account and tenant already exists")

    account_share_record = AccountShare(account_id=account_id, tenant_id=payload.tenant_id, visibility=payload.visibility, granted_by=user.id)
    db.add(account_share_record)
    await db.commit()
    await db.refresh(account_share_record)

    # Serialize to include tenant_name
    return await account_service.build_account_share_read(db, account_share_record)


@router.patch("/{account_id}/shares/{tenant_id}", response_model=AccountShareRead)
async def update_account_share(account_id: UUID, tenant_id: UUID, payload: AccountShareUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Update properties of an account share identified by tenant_id. Only account owner can modify."""
    account_record = await db.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=404)
    if account_record.user_id != user.id:
        raise HTTPException(status_code=403, detail="only owner can change a share")

    share_query = select(AccountShare).where(AccountShare.account_id == account_id, AccountShare.tenant_id == tenant_id)
    share_query_result = await db.execute(share_query)
    account_share_record = share_query_result.scalars().first()
    if not account_share_record:
        raise HTTPException(status_code=404)
    if payload.visibility is not None:
        account_share_record.visibility = payload.visibility
    db.add(account_share_record)
    await db.commit()
    await db.refresh(account_share_record)

    # Serialize to include tenant_name
    return await account_service.build_account_share_read(db, account_share_record)


@router.delete("/{account_id}/shares/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account_share(account_id: UUID, tenant_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Delete an account share identified by tenant_id. Only the account owner may delete."""
    account_record = await db.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=404)
    if account_record.user_id != user.id:
        raise HTTPException(status_code=403)
    share_query = select(AccountShare).where(AccountShare.account_id == account_id, AccountShare.tenant_id == tenant_id)
    share_query_result = await db.execute(share_query)
    account_share_record = share_query_result.scalars().first()
    if not account_share_record:
        raise HTTPException(status_code=404)
    await db.delete(account_share_record)
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
    account_record = await db.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=404)
    if account_record.user_id != user.id:
        raise HTTPException(status_code=403, detail="only owner can update account")
    # Use exclude_unset so fields absent from the request body are not touched,
    # while fields explicitly set to None (e.g. clearing an icon) are applied.
    # Guard against None being passed for NOT NULL columns (e.g. name, balance, type,
    # currency) which would cause an IntegrityError at commit time. Only icon and color
    # are genuinely nullable database columns and may legitimately be cleared.
    NULLABLE_FIELDS = {'icon', 'color'}
    for field_name, field_value in payload.model_dump(exclude_unset=True).items():
        if field_value is None and field_name not in NULLABLE_FIELDS:
            continue
        setattr(account_record, field_name, field_value)
    db.add(account_record)
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
    # Verify account exists and user is owner
    account_record = await db.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=404)
    if account_record.user_id != user.id:
        raise HTTPException(status_code=403, detail="only owner can delete account")

    # Check share count if deleting from family context
    if from_family_context:
        share_count_query = select(func.count(AccountShare.id)).where(
            AccountShare.account_id == account_id
        )
        result = await db.execute(share_count_query)
        share_count = result.scalar_one()

        if share_count > 1:
            raise HTTPException(
                status_code=409,
                detail="This account is shared with multiple families and can only be deleted from the main accounts page"
            )

    # Proceed with deletion (CASCADE and SET NULL will handle related records)
    await db.delete(account_record)
    await db.commit()
    return
