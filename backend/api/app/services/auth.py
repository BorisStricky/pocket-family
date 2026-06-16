# backend/api/app/services/auth.py
# Auth-related service helpers relocated from routers/auth.py.
# Framework-agnostic: each function takes a plain AsyncSession (session-first for
# the newer helpers, matching the services/accounts.py exemplar) and does all DB
# queries / record building / business rules. Services NEVER call commit / flush /
# rollback — the router owns the transaction boundary. They may call the pure
# security primitives in app/auth.py (hash_token, make_refresh_token, ...).

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User, Tenant, Membership, RefreshToken, Invite
from ..schemas import SignupIn, LoginIn, InviteCreate, MembershipStatus
from ..seed_defaults import seed_tenant_defaults
from ..auth import (
    hash_password,
    verify_password,
    make_refresh_token,
    hash_token,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


def _naive_utc_now() -> datetime:
    """Return the current UTC time as a naive datetime.

    The DB columns store naive timestamps, so every record-builder strips tzinfo
    the same way the original inline router code did. Centralized here so the
    behavior is identical across signup / login / refresh.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


# ---------------------------------------------------------------------------
# Refresh-token persistence helpers (pure staging — no commit/flush).
# ---------------------------------------------------------------------------

async def stage_new_refresh_token(
    session: AsyncSession,
    user_id: UUID,
    raw_refresh_token: str,
    family_id: Optional[UUID] = None,
) -> RefreshToken:
    """Build and stage a RefreshToken row for the given user (no commit).

    Stores only the SHA-256 hash of the raw token (never the raw value).
    `family_id` is passed through for rotation so a rotated token inherits the
    same family; when omitted the model default mints a fresh family id (used on
    signup/login where a brand-new family begins).
    """
    refresh_token_fields = {
        "user_id": user_id,
        "token_hash": hash_token(raw_refresh_token),
        "issued_at": _naive_utc_now(),
        "expires_at": _naive_utc_now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "revoked": False,
    }
    # Only pass family_id through for rotation; on signup/login we let the model
    # default mint a new family id, byte-for-byte matching the original code which
    # did not set family_id on those paths.
    if family_id is not None:
        refresh_token_fields["family_id"] = family_id
    refresh_token_record = RefreshToken(**refresh_token_fields)
    session.add(refresh_token_record)
    return refresh_token_record


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------

async def stage_signup(session: AsyncSession, payload: SignupIn) -> tuple[User, Tenant, Membership]:
    """Stage a new user, their default tenant, owner membership, and seed defaults.

    The handler owns the commit. One internal flush is required here (it is NOT a
    boundary call): the seeded categories carry a FOREIGN KEY to the tenant, so the
    tenant row must be materialized before seed_tenant_defaults inserts them — the
    uuid4 id alone is not enough, the row has to exist in the DB. This is the
    sanctioned "service flushes for its own internal multi-step write" case (the
    same reason seed_tenant_defaults flushes between parent and child categories).
    It does NOT commit.

    Raises:
        HTTPException 400 when the email is already registered.
    """
    # check existing
    user_query = select(User).where(User.email == payload.email)
    user_query_result = await session.execute(user_query)
    existing_user_record = user_query_result.scalars().first()
    if existing_user_record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        created_at=_naive_utc_now(),
    )
    session.add(user)
    # create tenant for user by default
    tenant = Tenant(name=f"{payload.name or payload.email}'s family", created_at=_naive_utc_now())
    session.add(tenant)
    await session.flush()  # materialize the tenant row so the seeded categories' FK resolves

    membership = Membership(
        user_id=user.id,
        user_email=user.email,
        tenant_id=tenant.id,
        role="owner",
        created_at=_naive_utc_now(),
    )
    session.add(membership)

    # Seed default categories, budget, and accounts for the new tenant.
    # This runs within the same transaction so everything is atomic —
    # if seeding fails the entire signup is rolled back.
    await seed_tenant_defaults(session, tenant, user, include_accounts=True)

    return user, tenant, membership


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

async def authenticate_user(session: AsyncSession, payload: LoginIn) -> User:
    """Verify credentials and return the matching user.

    Raises:
        HTTPException 401 when the email is unknown or the password is wrong.
    """
    user_query = select(User).where(User.email == payload.email)
    user_query_result = await session.execute(user_query)
    user = user_query_result.scalars().first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return user


async def resolve_login_membership(
    session: AsyncSession, user: User, tenant_uuid: Optional[UUID]
) -> Optional[Membership]:
    """Resolve the membership used to mint the login access token.

    Applies preferred-tenant logic, then — when an explicit tenant was requested —
    validates that the user is an ACTIVE member of it and records that tenant as
    the user's new preferred tenant (staged on the session; the handler commits).

    Raises:
        HTTPException 403 when an explicit tenant was requested but the user is not
            an active member of it.
    """
    # Get membership using preferred tenant logic
    membership = await resolve_membership_for_user(user, tenant_uuid, session)

    # If explicit tenant was provided, validate it and update preferred
    if tenant_uuid:
        if not membership or membership.status != MembershipStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of the family"
            )
        # Update preferred tenant (committed by the handler)
        user.preferred_tenant_id = tenant_uuid
        session.add(user)

    return membership


# ---------------------------------------------------------------------------
# Refresh-token rotation
# ---------------------------------------------------------------------------

async def lookup_refresh_token(session: AsyncSession, raw_refresh_token: str) -> Optional[RefreshToken]:
    """Look up a presented refresh token by its hash, regardless of revoked state.

    Returning revoked tokens too lets the caller distinguish "unknown token" from
    "known-but-already-rotated token" (a reuse attempt). Returns None when no row
    matches the hash.
    """
    refresh_token_hash = hash_token(raw_refresh_token)
    refresh_token_lookup_query = select(RefreshToken).where(RefreshToken.token_hash == refresh_token_hash)
    refresh_token_query_result = await session.execute(refresh_token_lookup_query)
    return refresh_token_query_result.scalars().first()


def is_refresh_token_unusable(refresh_token_record: Optional[RefreshToken]) -> bool:
    """Return True when a looked-up refresh token is unknown or expired.

    Pure predicate (no DB access): used by the handler to reject without side
    effects before any rotation work happens.
    """
    return (
        not refresh_token_record
        or refresh_token_record.expires_at < _naive_utc_now()
    )


async def revoke_refresh_token_family(session: AsyncSession, refresh_token_record: RefreshToken) -> None:
    """Revoke every token in a reused token's family (no commit).

    Reuse detection: a refresh token is single-use. If a presented token was
    already revoked (previously rotated), someone is replaying an old token — we
    revoke the entire token family so neither the attacker's nor the victim's
    descendant tokens remain valid, forcing a fresh login (Security H-2). The
    handler commits this revocation before raising 401.
    """
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == refresh_token_record.family_id)
        .values(revoked=True)
    )


async def rotate_refresh_token(
    session: AsyncSession, refresh_token_record: RefreshToken
) -> tuple[User, str]:
    """Rotate a valid refresh token: revoke the old one, stage a fresh one.

    Loads the owning user, marks the presented token revoked, and stages a new
    refresh token that inherits the same family_id so a later replay of any token
    in this chain triggers the reuse path. Both the revoke and the new-token
    insert are staged on the session and committed together by the handler (one
    unit of work). Returns the user and the new RAW refresh token.

    Raises:
        HTTPException 401 when the token's owning user no longer exists.
    """
    user = await session.get(User, refresh_token_record.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User missing")

    # revoke current and create new — the new token inherits the same family so a
    # later replay of any token in this chain triggers the reuse path above.
    refresh_token_record.revoked = True
    new_raw_refresh_token = make_refresh_token()
    await stage_new_refresh_token(
        session,
        user_id=user.id,
        raw_refresh_token=new_raw_refresh_token,
        family_id=refresh_token_record.family_id,
    )
    return user, new_raw_refresh_token


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

async def revoke_refresh_token_if_active(session: AsyncSession, raw_refresh_token: str) -> None:
    """Revoke the matching active (non-revoked) refresh token, if any (no commit).

    Best-effort logout: looks up the presented token among non-revoked tokens and
    marks it revoked. A missing/unknown token is a no-op (logout always succeeds).
    The handler commits.
    """
    refresh_token_hash = hash_token(raw_refresh_token)
    refresh_token_lookup_query = select(RefreshToken).where(
        RefreshToken.token_hash == refresh_token_hash,
        RefreshToken.revoked == False,
    )
    refresh_token_query_result = await session.execute(refresh_token_lookup_query)
    refresh_token_record = refresh_token_query_result.scalars().first()
    if refresh_token_record:
        refresh_token_record.revoked = True


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------

async def stage_invite(
    session: AsyncSession, tenant_id: str, payload: InviteCreate
) -> str:
    """Stage an Invite record for a tenant and return the raw invite token (no commit).

    Generates a secure invite token, stores only its hash, and stages the Invite.
    Authorization (owner of the active tenant) is the handler's responsibility via
    the require_owner dependency. The handler commits.
    """
    raw_invite_token = make_refresh_token()
    invite_record = Invite(
        tenant_id=tenant_id,
        email=payload.email,
        token_hash=hash_token(raw_invite_token),
        role=payload.role,
        expires_at=_naive_utc_now() + timedelta(days=7),
        consumed=False,
        created_at=_naive_utc_now(),
    )
    session.add(invite_record)
    return raw_invite_token
