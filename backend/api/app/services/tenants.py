# backend/api/app/services/tenants.py
# Tenant- and membership-related service helpers relocated from routers/tenants.py.
# These functions interact with the database directly and are framework-agnostic
# (they take a plain AsyncSession), so routers, workers, and tests can all reuse them.
#
# Authorization note: several of these helpers authorize against a PATH-parameter
# tenant_id that may differ from the caller's active-tenant. They therefore perform
# their own membership lookup against the path tenant and MUST NOT be replaced with
# the require_role dependency (which gates on the active tenant only). The semantics
# here are a byte-for-byte relocation of the original inline router logic.

from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    User,
    Tenant,
    Membership,
    MembershipRole,
    MembershipStatus,
    Account,
    AccountShare,
)
from ..schemas import TenantCreate, TenantUpdate, MembershipCreate, MembershipUpdate
from ..seed_defaults import seed_tenant_defaults


# ---------------------------------------------------------------------------
# Path-tenant authorization helpers
#
# These mirror the inline checks that previously lived in each handler. They
# authorize against the caller's *active context* (the token tenant + active
# membership) but compared against the PATH tenant_id, exactly as before.
# ---------------------------------------------------------------------------

def assert_token_tenant_matches_path(active_tenant: Tenant, path_tenant_id) -> None:
    """Raise 403 if the caller's active (token) tenant differs from the path tenant.

    Preserves the original inline guard: the active context is resolved from the
    JWT, so this rejects requests where the token tenant does not match the tenant
    named in the URL path.
    """
    # Compare as strings to match the original inline behavior exactly.
    if str(active_tenant.id) != str(path_tenant_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token tenant does not match path tenant",
        )


# ---------------------------------------------------------------------------
# Tenant CRUD
# ---------------------------------------------------------------------------

async def stage_tenant_with_owner(
    session: AsyncSession, user: User, payload: TenantCreate
) -> Tenant:
    """Stage a new tenant, its owner membership, and seeded defaults (no commit).

    Builds the tenant, flushes so its id is available, then stages the creator's
    OWNER membership and seeds default categories/budget. A single flush here is an
    *internal* multi-step write-ordering concern (membership + seeded rows reference
    the tenant id via FK), so it lives in the service per the atomicity invariant.
    The handler owns the commit so tenant + membership + seeded data land atomically.
    """
    # Create new_tenant_record: set minimal required fields and validate owner has capacity to create.
    # Persist and then create default resources (e.g., default account or categories) in the same transaction when possible.
    new_tenant_record = Tenant(name=payload.name)
    session.add(new_tenant_record)
    # Flush instead of commit so tenant ID is available but the transaction
    # remains open — we want tenant + membership + seeded data to be atomic.
    await session.flush()

    # create owner membership for creator
    owner_membership_record = Membership(
        tenant_id=new_tenant_record.id,
        user_id=user.id,
        user_email=user.email,
        role=MembershipRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    session.add(owner_membership_record)

    # Seed default categories and budget for the new tenant.
    # Accounts are NOT seeded here — only signup creates starter accounts.
    # Users can manually share or create accounts for additional tenants.
    await seed_tenant_defaults(session, new_tenant_record, user, include_accounts=False)

    return new_tenant_record


async def list_tenants_for_user(session: AsyncSession, user: User) -> List[Tenant]:
    """Return tenants the user is an ACTIVE member of."""
    # This joined query loads tenant + membership data to validate membership in one round-trip.
    # Keep it small to avoid loading large collections into memory.
    tenant_query = select(Tenant).join(Membership, Membership.tenant_id == Tenant.id).where(
        Membership.user_id == user.id, Membership.status == MembershipStatus.ACTIVE
    )
    tenant_query_result = await session.execute(tenant_query)
    tenant_records = tenant_query_result.scalars().all()
    return tenant_records


def authorize_active_member_of_path_tenant(
    active_tenant: Tenant, active_membership: Membership, path_tenant_id
) -> None:
    """Authorize a read against the path tenant: token must match and be ACTIVE.

    Used by get_tenant and list_members_for_tenant. Raises 403 with the original
    inline detail strings; the membership status guard is preserved verbatim.
    """
    assert_token_tenant_matches_path(active_tenant, path_tenant_id)

    # enforce role (only owner can invite)
    if active_membership.status != MembershipStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="must be a member")


def authorize_owner_of_path_tenant(
    active_tenant: Tenant, active_membership: Membership, path_tenant_id
) -> None:
    """Authorize an OWNER-only action against the path tenant (update/delete).

    Raises 403 if the token tenant does not match the path tenant, or if the
    caller is not an OWNER. Detail strings preserved verbatim from the original
    inline handler logic.
    """
    assert_token_tenant_matches_path(active_tenant, path_tenant_id)

    # enforce role (only owner can invite)
    if active_membership.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only tenant owner can update")


async def apply_tenant_update(
    session: AsyncSession, tenant: Tenant, payload: TenantUpdate
) -> Tenant:
    """Apply a partial update to a tenant in place (no commit)."""
    if payload.name is not None:
        tenant.name = payload.name
    session.add(tenant)
    return tenant


async def delete_tenant_record(session: AsyncSession, tenant: Tenant) -> None:
    """Stage a tenant for deletion (no commit). DB-level ON DELETE CASCADE handles dependents."""
    # Tenant-scoped records are removed by DB-level ON DELETE CASCADE constraints.
    await session.delete(tenant)


# ---------------------------------------------------------------------------
# Tenant switch
# ---------------------------------------------------------------------------

async def authorize_switch_to_tenant(
    session: AsyncSession, current_user: User, tenant_id: str
) -> tuple[UUID, Membership]:
    """Validate the user may switch to the given tenant and persist the preference.

    Loads the tenant (404 if missing), then validates an ACTIVE membership (403 if
    absent). Updates the user's preferred_tenant_id so the switch persists across
    login sessions, and stages it on the session (no commit — the handler commits).
    Returns the resolved tenant UUID and the validated membership so the handler can
    mint the new access token. Semantics are a byte-for-byte relocation.
    """
    # Authorization check: current_user must be owner or hold an administrative membership for this tenant.
    # This prevents accidental cross-tenant modifications.
    # Convert tenant id for DB comparison
    try:
        tenant_uuid = UUID(tenant_id)
    except Exception:
        tenant_uuid = tenant_id

    # optional: verify tenant exists (nice to fail with 404 if invalid id)
    tenant_record = await session.get(Tenant, tenant_uuid)
    if not tenant_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    # This joined query loads membership for given user and tenant to validate membership.
    # Keep it small to avoid loading large collections into memory.
    membership_query = select(Membership).where(
        Membership.user_id == current_user.id,
        Membership.tenant_id == tenant_uuid,
        Membership.status == MembershipStatus.ACTIVE,
    )
    membership_query_result = await session.execute(membership_query)
    membership_record = membership_query_result.scalars().first()
    if not membership_record:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of tenant")

    # Update user's preferred tenant to persist the switch across login sessions.
    # This ensures when users log out and back in, they continue with their last active tenant.
    current_user.preferred_tenant_id = tenant_uuid
    session.add(current_user)

    return tenant_uuid, membership_record


# ---------------------------------------------------------------------------
# Membership operations (invite, list, update, revoke)
# ---------------------------------------------------------------------------

def authorize_owner_can_invite(
    active_tenant: Tenant, active_membership: Membership, path_tenant_id
) -> None:
    """Authorize the membership-create (invite) path: token match + OWNER only.

    Mirrors the original inline check, including its distinct detail string for
    the invite case.
    """
    # Authorization check: current_user must be owner or hold an administrative membership for this tenant.
    # This prevents accidental cross-tenant modifications.
    # owner_membership_query: check actor is owner
    assert_token_tenant_matches_path(active_tenant, path_tenant_id)

    # enforce role (only owner can invite)
    if active_membership.role != MembershipRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only tenant owner can invite")


async def stage_membership_for_tenant(
    session: AsyncSession, tenant: Tenant, payload: MembershipCreate
) -> Membership:
    """Stage a membership (ACTIVE if the invited user exists, else a PENDING invite).

    Pure staging (build + add — no commit). The handler owns the unit of work.
    """
    # Check whether invited user exists to decide ACTIVE vs PENDING invite
    user_query = select(User).where(User.email == payload.user_email)
    user_query_result = await session.execute(user_query)
    user_record = user_query_result.scalars().first()
    if user_record:
        membership_record = Membership(
            tenant_id=tenant.id,
            user_id=user_record.id,
            user_email=user_record.email,
            role=payload.role,
            status=MembershipStatus.ACTIVE,
        )
    else:  # User not existing, send invite to app
        membership_record = Membership(
            tenant_id=tenant.id,
            user_email=payload.user_email,
            role=payload.role,
            status=MembershipStatus.PENDING,
        )

    session.add(membership_record)
    return membership_record


async def list_memberships_for_tenant(session: AsyncSession, tenant_id: UUID) -> List[Membership]:
    """Return all membership records for a tenant."""
    tenant_membership_query = select(Membership).where(Membership.tenant_id == tenant_id)
    tenant_membership_query_result = await session.execute(tenant_membership_query)
    membership_records = tenant_membership_query_result.scalars().all()
    return membership_records


async def apply_membership_update(
    session: AsyncSession, tenant_id: UUID, membership_id: UUID, payload: MembershipUpdate
) -> Membership:
    """Load the target membership (scoped to tenant) and apply role/status updates.

    Raises 404 when no membership matches (id + tenant), mirroring the guard in
    delete_membership_for_tenant so the two siblings behave consistently.

    KNOWN QUIRK (preserved, not fixed): there is no last-owner guard here, so an
    owner can self-demote and orphan the family. That is a separate product decision
    and is intentionally left as-is per the behavior-preserving refactor.
    """
    # This query loads membership for given user and tenant to validate membership.
    membership_query = select(Membership).where(
        Membership.id == membership_id,
        Membership.tenant_id == tenant_id,
    )
    membership_query_result = await session.execute(membership_query)
    membership_record = membership_query_result.scalars().first()

    # Guard against a missing membership: without this, the attribute writes below
    # would raise AttributeError → 500. Return a clean 404 instead.
    if not membership_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")

    if payload.role is not None:
        membership_record.role = payload.role
    if payload.status is not None:
        membership_record.status = payload.status
    session.add(membership_record)
    return membership_record


def authorize_membership_deletion(
    active_tenant: Tenant, actor_membership: Membership, path_tenant_id, membership_id: UUID
) -> None:
    """Authorize a membership delete: token match, then owner-or-self rule.

    Preserves the original inline rule: non-owners may only delete their own
    membership (leave). Detail string preserved verbatim.
    """
    # Verify the actor's token matches the tenant in the URL path
    assert_token_tenant_matches_path(active_tenant, path_tenant_id)

    # Non-owners can only delete their own membership (leave)
    is_self_removal = str(actor_membership.id) == str(membership_id)
    if actor_membership.role != MembershipRole.OWNER and not is_self_removal:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can remove other members"
        )


async def delete_membership_for_tenant(
    session: AsyncSession, tenant_id: UUID, membership_id: UUID
) -> None:
    """Stage deletion of a membership, enforcing the last-owner guard and unsharing accounts.

    Loads the target membership (404 if absent). If it is the last ACTIVE owner,
    raises 400 to prevent orphaning the tenant. Before deletion, unshares all of the
    departing user's accounts that were shared with this tenant so their private
    accounts do not remain visible after they leave. Pure staging — no commit.
    """
    # Fetch the membership to delete
    membership_query = select(Membership).where(
        Membership.id == membership_id,
        Membership.tenant_id == tenant_id,
    )
    membership_query_result = await session.execute(membership_query)
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
        owner_count_result = await session.execute(owner_count_query)
        owner_count = len(owner_count_result.scalars().all())
        if owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner. Transfer ownership first or delete the family.",
            )

    # When a user leaves (or is removed from) a family, unshare all of their accounts
    # that were shared with this tenant. This prevents their private accounts from
    # remaining visible to family members after they depart.
    departing_user_id = membership_record_to_delete.user_id
    owned_account_ids_subquery = select(Account.id).where(Account.user_id == departing_user_id)
    await session.execute(
        delete(AccountShare).where(
            AccountShare.tenant_id == tenant_id,
            AccountShare.account_id.in_(owned_account_ids_subquery),
        )
    )

    await session.delete(membership_record_to_delete)
