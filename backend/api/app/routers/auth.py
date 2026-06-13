from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlmodel import select
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone

from ..db import get_db
from ..models import User, Tenant, Membership, RefreshToken, Invite
from ..schemas import SignupIn, LoginIn, TokenOut, InviteCreate, MembershipStatus, ActiveContext
from ..deps import require_owner
from ..auth import (
    hash_password,
    verify_password,
    create_access_token,
    make_refresh_token,
    hash_token,
    REFRESH_TOKEN_EXPIRE_DAYS,
    is_test_mode,
    cookies_secure,
    assert_not_demo,
)
from ..rate_limit import limiter
from ..seed_defaults import seed_tenant_defaults
from ..services import auth as auth_service

router = APIRouter()


@router.post("/signup", response_model=TokenOut, dependencies=[Depends(assert_not_demo)])
async def signup(payload: SignupIn, response: Response, db: AsyncSession = Depends(get_db)):
    """Register a new user, create a default tenant and return auth tokens.

    Args:
        payload: SignupIn input schema with email, password and optional name.
        response: FastAPI Response object for setting cookies.
        db: Async DB session.

    Returns:
        TokenOut containing an access token and (in test mode) a refresh token.
        Also sets refresh_token as HttpOnly cookie.

    Raises:
        HTTPException 400 when email already exists.
    """
    # check existing
    user_query = select(User).where(User.email == payload.email)
    user_query_result = await db.execute(user_query)
    existing_user_record = user_query_result.scalars().first()
    if existing_user_record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(user)
    # create tenant for user by default
    tenant = Tenant(name=f"{payload.name or payload.email}'s family", created_at=datetime.now(timezone.utc).replace(tzinfo=None))

    db.add(tenant)
    await db.flush()  # ensure tenant/user ids populated
    membership = Membership(
        user_id=user.id,
        user_email=user.email,
        tenant_id=tenant.id,
        role="owner",
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(membership)

    # Seed default categories, budget, and accounts for the new tenant.
    # This runs within the same transaction so everything is atomic —
    # if seeding fails the entire signup is rolled back.
    await seed_tenant_defaults(db, tenant, user, include_accounts=True)

    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id), "tenant_id": str(tenant.id), "roles": ["owner"]})
    # create refresh token DB entry
    raw_refresh_token = make_refresh_token()
    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh_token),
        issued_at=datetime.now(timezone.utc).replace(tzinfo=None),
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        revoked=False,
    )
    db.add(refresh_token_record)
    await db.commit()

    # Set refresh_token as HttpOnly cookie (production security)
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,           # Prevent JavaScript access (XSS protection)
        secure=cookies_secure(), # HTTPS-only when COOKIE_SECURE=1 (default); browser will not send Secure cookies over plain HTTP
        samesite="lax",          # CSRF protection
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # seconds
    )

    # In TEST_MODE also return refresh_token in body for debugging
    return {
        "access_token": access_token,
        "refresh_token": raw_refresh_token if is_test_mode() else None,
    }

@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginIn, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate a user and issue access/refresh tokens.

    Args:
        payload: LoginIn schema with email and password.
        response: FastAPI Response object for setting cookies.
        db: Async DB session.

    Returns:
        TokenOut containing access token and optional refresh token (in test mode).
        Also sets refresh_token as HttpOnly cookie.

    Raises:
        HTTPException 401 when credentials are invalid.
    """
    user_query = select(User).where(User.email == payload.email)
    user_query_result = await db.execute(user_query)
    user = user_query_result.scalars().first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    # Get membership using preferred tenant logic
    membership = await auth_service.resolve_membership_for_user(user, payload.tenant_uuid, db)

    # If explicit tenant was provided, validate it and update preferred
    if payload.tenant_uuid:
        if not membership or membership.status != MembershipStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of the family"
            )
        # Update preferred tenant (will be committed at line 180)
        user.preferred_tenant_id = payload.tenant_uuid
        db.add(user)

    tenant_id = membership.tenant_id if membership else None
    roles = [membership.role] if membership else []
    access_token = create_access_token({
        "sub": str(user.id),
        "tenant_id": str(tenant_id) if tenant_id else None,
        "roles": roles
    })
    raw_refresh_token = make_refresh_token()
    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh_token),
        issued_at=datetime.now(timezone.utc).replace(tzinfo=None),
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        revoked=False,
    )
    db.add(refresh_token_record)
    await db.commit()

    # Set refresh_token as HttpOnly cookie (production security)
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,           # Prevent JavaScript access (XSS protection)
        secure=cookies_secure(), # HTTPS-only when COOKIE_SECURE=1 (default); browser will not send Secure cookies over plain HTTP
        samesite="lax",          # CSRF protection
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # seconds
    )

    # In TEST_MODE also return refresh_token in body for debugging
    return {"access_token": access_token, "refresh_token": raw_refresh_token if is_test_mode() else None}

@router.post("/refresh", response_model=TokenOut)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Rotate a refresh token and issue a new access token.

    Args:
        request: FastAPI Request object for reading cookies.
        response: FastAPI Response object for setting cookies.
        db: Async DB session.

    Returns:
        TokenOut containing new access token and (in test mode) the new refresh token.
        Also sets new refresh_token as HttpOnly cookie.

    Raises:
        HTTPException 401 when the refresh token is invalid or expired.
    """
    # Read refresh_token from HttpOnly cookie
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing"
        )

    # Look up the presented token by hash, regardless of its revoked state, so we
    # can distinguish "unknown token" from "known-but-already-rotated token". The
    # latter is a reuse attempt (the legitimate client rotated long ago) and is a
    # strong signal the token was stolen.
    refresh_token_hash = hash_token(refresh_token)
    refresh_token_lookup_query = select(RefreshToken).where(RefreshToken.token_hash == refresh_token_hash)
    refresh_token_query_result = await db.execute(refresh_token_lookup_query)
    refresh_token_record = refresh_token_query_result.scalars().first()

    # Unknown or expired token: reject without side effects.
    if not refresh_token_record or refresh_token_record.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Reuse detection: a refresh token is single-use. If it was already revoked
    # (i.e. previously rotated), someone is replaying an old token — revoke the
    # entire token family so neither the attacker's nor the victim's descendant
    # tokens remain valid, forcing a fresh login (Security H-2).
    if refresh_token_record.revoked:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == refresh_token_record.family_id)
            .values(revoked=True)
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected; session revoked",
        )

    user = await db.get(User, refresh_token_record.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User missing")
    # revoke current and create new — the new token inherits the same family so a
    # later replay of any token in this chain triggers the reuse path above.
    refresh_token_record.revoked = True
    new_raw_refresh_token = make_refresh_token()
    new_rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_raw_refresh_token),
        family_id=refresh_token_record.family_id,
        issued_at=datetime.now(timezone.utc).replace(tzinfo=None),
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        revoked=False,
    )
    db.add(new_rt)
    await db.commit()
    # issue access token
    # Get membership using preferred tenant logic (no explicit tenant in refresh)
    membership = await auth_service.resolve_membership_for_user(user, None, db)

    tenant_id = membership.tenant_id if membership else None
    roles = [membership.role] if membership else []
    access_token = create_access_token({
        "sub": str(user.id),
        "tenant_id": str(tenant_id) if tenant_id else None,
        "roles": roles
    })

    # Set new refresh_token as HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=new_raw_refresh_token,
        httponly=True,           # Prevent JavaScript access (XSS protection)
        secure=cookies_secure(), # HTTPS-only when COOKIE_SECURE=1 (default); browser will not send Secure cookies over plain HTTP
        samesite="lax",          # CSRF protection
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # seconds
    )

    # In TEST_MODE also return refresh_token in body for debugging
    return {"access_token": access_token, "refresh_token": new_raw_refresh_token if is_test_mode() else None}

@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Revoke a refresh token to log a user out.

    Args:
        request: FastAPI Request object for reading cookies.
        response: FastAPI Response object for deleting cookies.
        db: Async DB session.

    Returns:
        Dict indicating operation success. Also clears refresh_token cookie.
    """
    # Read refresh_token from HttpOnly cookie
    refresh_token = request.cookies.get("refresh_token")

    if refresh_token:
        refresh_token_hash = hash_token(refresh_token)
        refresh_token_lookup_query = select(RefreshToken).where(RefreshToken.token_hash == refresh_token_hash, RefreshToken.revoked == False)
        refresh_token_query_result = await db.execute(refresh_token_lookup_query)
        refresh_token_record = refresh_token_query_result.scalars().first()
        if refresh_token_record:
            refresh_token_record.revoked = True
            await db.commit()

    # Delete the refresh_token cookie. Attributes must match the Set-Cookie on
    # signup/login/refresh so the browser treats this as the same cookie and
    # actually clears it.
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=cookies_secure(),
        samesite="lax",
    )

    return {"ok": True}

@router.post("/tenants/{tenant_id}/invite", dependencies=[Depends(assert_not_demo)])
async def create_invite(
    tenant_id: str,
    payload: InviteCreate,
    db: AsyncSession = Depends(get_db),
    context: ActiveContext = Depends(require_owner)
):
    """Create an invite record for a tenant.

    Security:
        Requires authentication via JWT token.
        Only tenant owners can create invites (enforced below).

    Args:
        tenant_id: Tenant identifier to invite into.
        payload: InviteCreate schema with invitee email and role.
        db: Async DB session.
        context: Active user context with authentication and membership info.

    Returns:
        A small hint of the invite token that was generated.

    Raises:
        HTTPException 403: If user is not an owner of the tenant.
        HTTPException 401: If authentication fails.
    """
    # Security check: verify the authenticated user is inviting to their own tenant
    if str(context.active_tenant.id) != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create invites for your active tenant"
        )

    # Authorization: only tenant owners can create invites. Enforced by the
    # require_owner dependency, which also fixes a latent bug where the role was
    # compared against the raw string "owner" instead of the MembershipRole enum.

    # Generate secure invite token and create invite record
    raw_invite_token = make_refresh_token()
    invite_record = Invite(
        tenant_id=tenant_id,
        email=payload.email,
        token_hash=hash_token(raw_invite_token),
        role=payload.role,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7),
        consumed=False,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(invite_record)
    await db.commit()
    # Placeholder: enqueue email via Celery in real app
    return {"invite_token_hint": raw_invite_token[:8]}
