# backend/api/app/routers/accounts.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User, Account, AccountShare, Membership, MembershipStatus, ShareVisibility, Tenant
from ..schemas import AccountCreate, AccountRead, AccountUpdate, AccountShareRead, AccountShareCreate, AccountShareUpdate
from ..deps import get_db, get_current_user

router = APIRouter(prefix="/accounts", tags=["accounts"])


async def _serialize_account(session: AsyncSession, account: Account, requestor) -> dict:
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
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }


@router.post("", response_model=AccountRead)
async def create_account(payload: AccountCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Create a new account owned by the authenticated user.

    Args:
        payload: AccountCreate schema with account properties.
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        The created Account instance.
    """
    account_record = Account(user_id=user.id, name=payload.name, type=payload.type, currency=payload.currency, balance=payload.balance or 0)
    db.add(account_record)
    await db.commit()
    await db.refresh(account_record)
    # Serialize to include user_name and respect balance visibility
    return await _serialize_account(db, account_record, user)


@router.get("", response_model=List[AccountRead])
async def list_accounts(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """List accounts belonging to the user and accounts shared with their families (tenants).

    Args:
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        List of serialized account dicts (balance masked according to visibility rules).
    """
    my_accounts_query_result = await db.execute(select(Account).where(Account.user_id == user.id))
    my_account_records = my_accounts_query_result.scalars().all()
    # accounts shared with user's families
    membership_query_result = await db.execute(select(Membership).where(Membership.user_id == user.id, Membership.status == MembershipStatus.ACTIVE))
    membership_records = membership_query_result.scalars().all()
    shared_account_records = []
    if membership_records:
        tenant_ids = [m.tenant_id for m in membership_records]
        accounts_by_tenant_query = select(Account).join(AccountShare, AccountShare.account_id == Account.id).where(AccountShare.tenant_id.in_(tenant_ids))
        shared_accounts_query_result = await db.execute(accounts_by_tenant_query)
        shared_account_records = shared_accounts_query_result.scalars().all()
    accounts_map = {account_record.id: account_record for account_record in (my_account_records + shared_account_records)}
    # serialize
    return [await _serialize_account(db, account_record, user) for account_record in accounts_map.values()]


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
        HTTPException 404 when account does not exist.
    """
    account_record = await db.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=404)
    return await _serialize_account(db, account_record, user)


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
    return account_share_records


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

    tenant_record = await db.get(Tenant, payload.tenant_id)
    if not tenant_record:
        raise HTTPException(status_code=404, detail="tenant not found")

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
    return account_share_record


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
    return account_share_record


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
    if payload.name is not None:
        account_record.name = payload.name
    if payload.type is not None:
        account_record.type = payload.type
    if payload.currency is not None:
        account_record.currency = payload.currency
    if payload.balance is not None:
        account_record.balance = payload.balance
    db.add(account_record)
    await db.commit()
    await db.refresh(account_record)
    return await _serialize_account(db, account_record, user)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(account_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Delete an account. Only the account owner may delete their account.

    Args:
        account_id: UUID of the account to delete.
        db: Async DB session.
        user: Current authenticated user.

    Raises:
        HTTPException 404 when account does not exist.
        HTTPException 403 when requester is not the owner.
    """
    account_record = await db.get(Account, account_id)
    if not account_record:
        raise HTTPException(status_code=404)
    if account_record.user_id != user.id:
        raise HTTPException(status_code=403, detail="only owner can delete account")
    await db.delete(account_record)
    await db.commit()
    return
