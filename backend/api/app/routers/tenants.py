# backend/api/app/routers/tenants.py
#
# HTTP boundary for /tenants. Handlers stay thin: they resolve dependencies,
# call services/tenants.py for all queries / record building / business rules /
# authorization, and own only the transaction boundary (commit / rollback /
# refresh). No raw SQL or session.add/get/delete lives here — that is the
# service layer's job.
#
# Authorization note: several member-management / tenant endpoints authorize
# against the PATH parameter tenant_id, which may differ from the caller's
# active-tenant. These deliberately do NOT use require_role (it gates on the
# active tenant only) and keep their explicit path-tenant membership checks,
# relocated into the service layer with byte-for-byte identical semantics.
from fastapi import APIRouter, Depends, status
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas import TenantCreate, TenantRead, TenantUpdate, MembershipCreate, MembershipRead, MembershipUpdate, ActiveContext
from ..deps import get_db, get_active_context, get_authenticated_user
from ..auth import create_access_token, assert_not_demo
from ..services import tenants as tenant_service

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
    # Stage tenant + owner membership + seeded defaults, then commit once so they
    # land atomically. The service owns its internal flush (FK ordering); the
    # handler owns the single commit.
    new_tenant_record = await tenant_service.stage_tenant_with_owner(db, user, payload)
    await db.commit()
    await db.refresh(new_tenant_record)

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
    return await tenant_service.list_tenants_for_user(db, user)


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
    tenant = active_context.active_tenant
    membership_record = active_context.active_membership

    # Authorize against the PATH tenant: token must match and membership must be active.
    tenant_service.authorize_active_member_of_path_tenant(tenant, membership_record, tenant_id)

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
    tenant = active_context.active_tenant
    membership_record = active_context.active_membership

    # Authorize against the PATH tenant: token must match and caller must be OWNER.
    tenant_service.authorize_owner_of_path_tenant(tenant, membership_record, tenant_id)

    await tenant_service.apply_tenant_update(db, tenant, payload)
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(assert_not_demo)])
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
    tenant = active_context.active_tenant
    membership_record = active_context.active_membership

    # Authorize against the PATH tenant: token must match and caller must be OWNER.
    tenant_service.authorize_owner_of_path_tenant(tenant, membership_record, tenant_id)

    await tenant_service.delete_tenant_record(db, tenant)
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
    # Service validates membership against the path tenant and stages the
    # preferred-tenant update; the handler commits and mints the new token.
    tenant_uuid, membership_record = await tenant_service.authorize_switch_to_tenant(db, current_user, tenant_id)
    await db.commit()

    roles = [membership_record.role] if membership_record and membership_record.role else []
    access_token = create_access_token({"sub": str(current_user.id), "tenant_id": str(tenant_uuid), "roles": roles})
    return {"access_token": access_token}

#####################################################################
# Membership operations (invite, accept, list, revoke)              #
#####################################################################

# Router: Tenant management (create, update, list, delete)
# Important invariants:
# - Tenants are the primary scope for data isolation (accounts, transactions, memberships).
# - Deleting a tenant must cascade or block dependent objects to avoid orphaned data.


@router.post("/{tenant_id}/members", response_model=MembershipRead, dependencies=[Depends(assert_not_demo)])
async def create_membership_for_tenant(
    tenant_id: UUID,
    payload: MembershipCreate,
    db: AsyncSession = Depends(get_db),
    active_context:ActiveContext = Depends(get_active_context)
):
    """Create a membership or invite for a tenant. Only tenant owners may invite."""
    tenant = active_context.active_tenant
    membership_record = active_context.active_membership

    # Authorize against the PATH tenant: token must match and caller must be OWNER.
    tenant_service.authorize_owner_can_invite(tenant, membership_record, tenant_id)

    membership_record = await tenant_service.stage_membership_for_tenant(db, tenant, payload)
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
    tenant = active_context.active_tenant
    membership_record = active_context.active_membership

    # Authorize against the PATH tenant: token must match and membership must be active.
    tenant_service.authorize_active_member_of_path_tenant(tenant, membership_record, tenant_id)

    return await tenant_service.list_memberships_for_tenant(db, tenant_id)


@router.patch("/{tenant_id}/members/{membership_id}", response_model=MembershipRead, dependencies=[Depends(assert_not_demo)])
async def update_membership_for_tenant(
    tenant_id: UUID,
    membership_id: UUID,
    payload: MembershipUpdate,
    db: AsyncSession = Depends(get_db),
    active_context:ActiveContext = Depends(get_active_context),
):
    """Update membership properties such as role or status. Only tenant owners may update."""
    active_tenant = active_context.active_tenant
    owner_membership_record = active_context.active_membership

    # Authorize against the PATH tenant: token must match and caller must be OWNER.
    tenant_service.authorize_owner_of_path_tenant(active_tenant, owner_membership_record, tenant_id)

    membership_record = await tenant_service.apply_membership_update(db, tenant_id, membership_id, payload)
    await db.commit()
    await db.refresh(membership_record)
    return membership_record


@router.delete("/{tenant_id}/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(assert_not_demo)])
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

    # Authorize against the PATH tenant: token match, then owner-or-self rule.
    tenant_service.authorize_membership_deletion(tenant, actor_membership, tenant_id, membership_id)

    await tenant_service.delete_membership_for_tenant(db, tenant_id, membership_id)
    await db.commit()
    return
