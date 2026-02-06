# backend/api/app/routers/tenants.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User, Tenant, Membership, MembershipRole, MembershipStatus, Category, Transaction, AccountShare, Invite
from sqlmodel import delete as sql_delete
from ..schemas import TenantCreate, TenantRead, TenantUpdate, MembershipCreate, MembershipRead, MembershipUpdate, ActiveContext
from ..deps import get_db, get_active_context, get_current_user, get_authenticated_user
from ..auth import create_access_token

router = APIRouter(prefix="/tenants", tags=["tenants"])

# Router: Tenant management (create, update, list, delete)
# Important invariants:
# - Tenants are the primary scope for data isolation (accounts, transactions, memberships).
# - Deleting a tenant must cascade or block dependent objects to avoid orphaned data.


@router.post("", response_model=TenantRead)
async def create_tenant(payload: TenantCreate, db: AsyncSession = Depends(get_db), user=Depends(get_authenticated_user)):
    """Create a new tenant and grant owner membership to the creator.

    Args:
        payload: TenantCreate input schema with the tenant name.
        db: Async DB session.
        user: Current authenticated user (will become tenant owner).

    Returns:
        The created Tenant object.
    """
    # Create new_tenant_record: set minimal required fields and validate owner has capacity to create.
    # Persist and then create default resources (e.g., default account or categories) in the same transaction when possible.
    new_tenant_record = Tenant(name=payload.name)
    db.add(new_tenant_record)
    await db.commit()
    await db.refresh(new_tenant_record)

    # create owner membership for creator
    owner_membership_record = Membership(
        tenant_id=new_tenant_record.id,
        user_id=user.id,
        user_email=user.email,
        role=MembershipRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    db.add(owner_membership_record)
    await db.commit()

    return new_tenant_record


@router.get("", response_model=List[TenantRead])
async def list_tenants(db: AsyncSession = Depends(get_db), user=Depends(get_authenticated_user)):
    """List tenants the current user is an active member of.

    Args:
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        List of Tenant objects the user is a member of.
    """
    # This joined query loads tenant + membership data to validate membership in one round-trip.
    # Keep it small to avoid loading large collections into memory.
    tenant_query = select(Tenant).join(Membership, Membership.tenant_id == Tenant.id).where(
        Membership.user_id == user.id, Membership.status == MembershipStatus.ACTIVE
    )
    tenant_query_result = await db.execute(tenant_query)
    tenant_records = tenant_query_result.scalars().all()
    return tenant_records


@router.get("/{tenant_id}", response_model=TenantRead)
async def get_tenant(tenant_id: UUID, db: AsyncSession = Depends(get_db), active_context: ActiveContext = Depends(get_active_context)):
    """Retrieve a tenant by id if the requester is an active member.

    Args:
        tenant_id: UUID of the tenant to retrieve.
        db: Async DB session.
        user: Current authenticated user.

    Returns:
        The Tenant object when the user is an active member.

    Raises:
        HTTPException 403 when the user is not a member.
        HTTPException 404 when the tenant does not exist.
    """
    user = active_context.active_user
    tenant = active_context.active_tenant
    membership_record = active_context.active_membership

    #Check if the user is signed in to the tenant in the path params
    if str(tenant.id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token tenant does not match path tenant")

    # enforce role (only owner can invite)
    if membership_record.status != MembershipStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="must be a member")
    
    return tenant


@router.patch("/{tenant_id}", response_model=TenantRead)
async def update_tenant(tenant_id: UUID, payload: TenantUpdate, db: AsyncSession = Depends(get_db), active_context: ActiveContext = Depends(get_active_context)):
    """Update tenant properties; only owners may perform this action.

    Args:
        tenant_id: UUID of the tenant to update.
        payload: TenantUpdate schema with changes.
        db: Async DB session.
        user: Current authenticated user; must be OWNER.

    Returns:
        The updated Tenant object.

    Raises:
        HTTPException 403 when the user is not the owner.
        HTTPException 404 when the tenant does not exist.
    """
    user = active_context.active_user
    tenant = active_context.active_tenant
    membership_record = active_context.active_membership

    #Check if the user is signed in to the tenant in the path params
    if str(tenant.id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token tenant does not match path tenant")

    # enforce role (only owner can invite)
    if membership_record.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only tenant owner can update")
    
    if payload.name is not None:
        tenant.name = payload.name
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(tenant_id: UUID, db: AsyncSession = Depends(get_db), active_context: ActiveContext = Depends(get_active_context)):
    """Delete a tenant. Only owners can delete their tenant.

    Args:
        tenant_id: UUID of the tenant to delete.
        db: Async DB session.
        user: Current authenticated user; must be OWNER.

    Raises:
        HTTPException 403 when the user is not the owner.
        HTTPException 404 when the tenant does not exist.
    """
    user = active_context.active_user
    tenant = active_context.active_tenant
    membership_record = active_context.active_membership

    #Check if the user is signed in to the tenant in the path params
    if str(tenant.id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token tenant does not match path tenant")

    # enforce role (only owner can invite)
    if membership_record.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only tenant owner can update")

    # Application-level cascade: delete all tenant-scoped data before removing the tenant.
    # Order matters: delete child records first to avoid FK constraint violations.
    # Accounts are NOT deleted because they belong to users, not tenants.
    # Only the AccountShare links between accounts and this tenant are removed.
    await db.execute(sql_delete(AccountShare).where(AccountShare.tenant_id == tenant.id))
    await db.execute(sql_delete(Transaction).where(Transaction.tenant_id == tenant.id))
    await db.execute(sql_delete(Category).where(Category.tenant_id == tenant.id))
    await db.execute(sql_delete(Invite).where(Invite.tenant_id == tenant.id))
    await db.execute(sql_delete(Membership).where(Membership.tenant_id == tenant.id))

    await db.delete(tenant)
    await db.commit()
    return

@router.post("/{tenant_id}/switch", response_model=dict)
async def switch_active_tenant(tenant_id: str, db: AsyncSession = Depends(get_db), current_user = Depends(get_authenticated_user)):
    """
    Issue a new access token with the requested tenant_id after validating membership.

    Returns:
        {"access_token": "<jwt>"}
    Raises:
        403 if user is not an active member of the requested tenant.
        404 if tenant not found.
    """
    # Authorization check: current_user must be owner or hold an administrative membership for this tenant.
    # This prevents accidental cross-tenant modifications.
    # Convert tenant id for DB comparison
    try:
        tenant_uuid = UUID(tenant_id)
    except Exception:
        tenant_uuid = tenant_id

    # optional: verify tenant exists (nice to fail with 404 if invalid id)
    db_session = db
    tenant_record = await db_session.get(Tenant, tenant_uuid)
    if not tenant_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    
    # This joined query loads membership for given user and tenant to validate membership.
    # Keep it small to avoid loading large collections into memory.
    membership_query = select(Membership).where(
        Membership.user_id == current_user.id,
        Membership.tenant_id == tenant_uuid,
        Membership.status == MembershipStatus.ACTIVE,
    )
    membership_query_result = await db_session.execute(membership_query)
    membership_record = membership_query_result.scalars().first()
    if not membership_record:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of tenant")

    # Update user's preferred tenant to persist the switch across login sessions.
    # This ensures when users log out and back in, they continue with their last active tenant.
    current_user.preferred_tenant_id = tenant_uuid
    db_session.add(current_user)
    await db_session.commit()

    roles = [membership_record.role] if membership_record and membership_record.role else []
    access_token = create_access_token({"sub": str(current_user.id), "tenant_id": str(tenant_uuid), "roles": roles})
    return {"access_token": access_token}

#####################################################################
# Membership operations (invite, accept, list, revoke)              #
#####################################################################
# Insert inside backend/api/app/routers/tenants.py (near other tenant endpoints)
from fastapi import Path

# Router: Tenant management (create, update, list, delete)
# Important invariants:
# - Tenants are the primary scope for data isolation (accounts, transactions, memberships).
# - Deleting a tenant must cascade or block dependent objects to avoid orphaned data.

# Create membership endpoints nested under tenants
# Create new_tenant_record: set minimal required fields and validate owner has capacity to create.
# Persist and then create default resources (e.g., default account or categories) in the same transaction when possible.

# Note: this block assumes Membership, User, MembershipRole, MembershipStatus, and MembershipCreate/Read/Update schemas are imported

@router.post("/{tenant_id}/members", response_model=MembershipRead)
async def create_membership_for_tenant(
    tenant_id: UUID,
    payload: MembershipCreate, 
    db: AsyncSession = Depends(get_db),
    active_context:ActiveContext = Depends(get_active_context)
):
    """Create a membership or invite for a tenant. Only tenant owners may invite."""
    # Authorization check: current_user must be owner or hold an administrative membership for this tenant.
    # This prevents accidental cross-tenant modifications.
    # owner_membership_query: check actor is owner
    actor = active_context.active_user
    tenant = active_context.active_tenant
    membership_record = active_context.active_membership

    #Check if the user is signed in to the tenant in the path params
    if str(tenant.id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token tenant does not match path tenant")

    # enforce role (only owner can invite)
    if membership_record.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only tenant owner can invite")

    # Check whether invited user exists to decide ACTIVE vs PENDING invite
    user_query = select(User).where(User.email == payload.user_email)
    user_query_result = await db.execute(user_query)
    user_record = user_query_result.scalars().first()
    if user_record:
        membership_record = Membership(
            tenant_id=tenant.id,
            user_id=user_record.id,
            user_email=user_record.email,
            role=payload.role,
            status=MembershipStatus.ACTIVE,
        )
    else: #User not existing, send invite to app
        membership_record = Membership(
            tenant_id=tenant.id,
            user_email=payload.user_email,
            role=payload.role,
            status=MembershipStatus.PENDING,
        )

    db.add(membership_record)
    await db.commit()
    await db.refresh(membership_record)
    return membership_record


@router.get("/{tenant_id}/members", response_model=List[MembershipRead])
async def list_members_for_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    active_context:ActiveContext = Depends(get_active_context)
):
    """List all memberships for a tenant. Requester must be an active member."""
    # This joined query loads tenant + membership data to validate membership in one round-trip.
    # Keep it small to avoid loading large collections into memory.
    user = active_context.active_user
    tenant = active_context.active_tenant
    membership_record = active_context.active_membership

    #Check if the user is signed in to the tenant in the path params
    if str(tenant.id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token tenant does not match path tenant")

    # enforce role (only owner can invite)
    if Membership.status == MembershipStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not a member")

    tenant_membership_query = select(Membership).where(Membership.tenant_id == tenant_id)
    tenant_membership_query_result = await db.execute(tenant_membership_query)
    membership_records = tenant_membership_query_result.scalars().all()
    return membership_records


@router.patch("/{tenant_id}/members/{membership_id}", response_model=MembershipRead)
async def update_membership_for_tenant(
    tenant_id: UUID,
    membership_id: UUID,
    payload: MembershipUpdate,
    db: AsyncSession = Depends(get_db),
    active_context:ActiveContext = Depends(get_active_context),
):
    """Update membership properties such as role or status. Only tenant owners may update."""
    active_user = active_context.active_user
    active_tenant = active_context.active_tenant
    owner_membership_record = active_context.active_membership

    #Check if the user is signed in to the tenant in the path params
    if str(active_tenant.id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token tenant does not match path tenant")

    # enforce role (only owner can update)
    if owner_membership_record.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only tenant owner can update")
    
    # Owner may update other users memberships
    # if str(membership_record.id) != str(membership_id):
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token membership does not match path membership")

    # This query loads membership for given user and tenant to validate membership.
    db_session = db
    membership_query = select(Membership).where(
        Membership.id == membership_id,
        Membership.tenant_id == tenant_id,
    )
    membership_query_result = await db_session.execute(membership_query)
    membership_record = membership_query_result.scalars().first()

    if payload.role is not None:
        membership_record.role = payload.role
    if payload.status is not None:
        membership_record.status = payload.status
    db_session.add(membership_record)
    await db_session.commit()
    await db_session.refresh(membership_record)
    return membership_record


@router.delete("/{tenant_id}/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_membership_for_tenant(
    tenant_id: UUID,
    membership_id: UUID,
    db: AsyncSession = Depends(get_db),
    active_context:ActiveContext = Depends(get_active_context),
):
    """Delete a membership. Owners can remove any member; members can remove themselves (leave).

    Permission rules:
    - Owners can remove any membership (including other owners, if >1 owner remains)
    - Non-owners can only remove their own membership (leave the family)
    - Cannot remove the last owner of a tenant to prevent orphaned tenants
    """
    tenant = active_context.active_tenant
    actor_membership = active_context.active_membership

    # Verify the actor's token matches the tenant in the URL path
    if str(tenant.id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token tenant does not match path tenant")

    # Non-owners can only delete their own membership (leave)
    is_self_removal = str(actor_membership.id) == str(membership_id)
    if actor_membership.role != MembershipRole.OWNER and not is_self_removal:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can remove other members")

    # Fetch the membership to delete
    membership_query = select(Membership).where(
        Membership.id == membership_id,
        Membership.tenant_id == tenant_id,
    )
    membership_query_result = await db.execute(membership_query)
    membership_record_to_delete = membership_query_result.scalars().first()

    if not membership_record_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")

    # Prevent removing the last owner to avoid orphaned tenants
    if membership_record_to_delete.role == MembershipRole.OWNER:
        owner_count_query = select(Membership).where(
            Membership.tenant_id == tenant_id,
            Membership.role == MembershipRole.OWNER,
            Membership.status == MembershipStatus.ACTIVE,
        )
        owner_count_result = await db.execute(owner_count_query)
        owner_count = len(owner_count_result.scalars().all())
        if owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner. Transfer ownership first or delete the family.",
            )

    await db.delete(membership_record_to_delete)
    await db.commit()
    return
