from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from ..db import get_db
from ..models import User, Tenant, Membership, RefreshToken, Invite
from ..schemas import SignupIn, LoginIn, TokenOut, InviteCreate, MembershipStatus
from ..auth import (
    hash_password,
    verify_password,
    create_access_token,
    make_refresh_token,
    hash_token,
    REFRESH_TOKEN_EXPIRE_DAYS,
    is_test_mode,
)

router = APIRouter()


async def get_membership_for_user(
    user: User,
    tenant_uuid: Optional[UUID],
    db: AsyncSession
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
        membership_query_result = await db.execute(membership_query)
        return membership_query_result.scalars().first()

    # Case 2: No explicit tenant - check preferred
    if user.preferred_tenant_id:
        membership_query = select(Membership).where(
            Membership.user_id == user.id,
            Membership.tenant_id == user.preferred_tenant_id,
            Membership.status == MembershipStatus.ACTIVE
        )
        membership_query_result = await db.execute(membership_query)
        membership = membership_query_result.scalars().first()

        if membership:
            return membership
        # If preferred tenant membership is invalid, fall through to default

    # Case 3: Fall back to first active membership
    membership_query = select(Membership).where(
        Membership.user_id == user.id,
        Membership.status == MembershipStatus.ACTIVE
    )
    membership_query_result = await db.execute(membership_query)
    return membership_query_result.scalars().first()

@router.post("/signup", response_model=TokenOut)
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
    user = User(email=payload.email, password_hash=hash_password(payload.password), created_at=datetime.utcnow())
    db.add(user)
    # create tenant for user by default
    tenant = Tenant(name=f"{payload.name or payload.email}'s family", created_at=datetime.utcnow())

    db.add(tenant)
    await db.flush()  # ensure tenant/user ids populated
    membership = Membership(user_id=user.id, tenant_id=tenant.id, role="owner", created_at=datetime.utcnow())
    db.add(membership)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id), "tenant_id": str(tenant.id), "roles": ["owner"]})
    # create refresh token DB entry
    raw_refresh_token = make_refresh_token()
    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh_token),
        issued_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        revoked=False,
    )
    db.add(refresh_token_record)
    await db.commit()

    # Set refresh_token as HttpOnly cookie (production security)
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,           # Prevent JavaScript access (XSS protection)
        secure=False,            # Set to True in production with HTTPS
        samesite="lax",          # CSRF protection (lax for dev, strict for prod)
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # seconds
    )

    # In TEST_MODE also return refresh_token in body for debugging
    return {
        "access_token": access_token,
        "refresh_token": raw_refresh_token if is_test_mode() else None,
    }

@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, response: Response, db: AsyncSession = Depends(get_db)):
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
    membership = await get_membership_for_user(user, payload.tenant_uuid, db)

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
        issued_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        revoked=False,
    )
    db.add(refresh_token_record)
    await db.commit()

    # Set refresh_token as HttpOnly cookie (production security)
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,           # Prevent JavaScript access (XSS protection)
        secure=False,            # Set to True in production with HTTPS
        samesite="lax",          # CSRF protection (lax for dev, strict for prod)
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

    # validate opaque refresh token by hash and rotate
    refresh_token_hash = hash_token(refresh_token)
    refresh_token_lookup_query = select(RefreshToken).where(RefreshToken.token_hash == refresh_token_hash, RefreshToken.revoked == False)
    refresh_token_query_result = await db.execute(refresh_token_lookup_query)
    refresh_token_record = refresh_token_query_result.scalars().first()
    if not refresh_token_record or refresh_token_record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = await db.get(User, refresh_token_record.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User missing")
    # revoke current and create new
    refresh_token_record.revoked = True
    new_raw_refresh_token = make_refresh_token()
    new_rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_raw_refresh_token),
        issued_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        revoked=False,
    )
    db.add(new_rt)
    await db.commit()
    # issue access token
    # Get membership using preferred tenant logic (no explicit tenant in refresh)
    membership = await get_membership_for_user(user, None, db)

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
        secure=False,            # Set to True in production with HTTPS
        samesite="lax",          # CSRF protection (lax for dev, strict for prod)
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

    # Delete the refresh_token cookie
    response.delete_cookie(key="refresh_token")

    return {"ok": True}

@router.post("/tenants/{tenant_id}/invite")
async def create_invite(tenant_id: str, payload: InviteCreate, db: AsyncSession = Depends(get_db), current_user = Depends(None)):
    """Create an invite record for a tenant (placeholder implementation).

    Notes:
        This is a simplified flow that does not enforce membership/role checks.
        In production use, wire get_current_user and require_membership to verify permissions.

    Args:
        tenant_id: Tenant identifier to invite into.
        payload: InviteCreate schema with invitee email and role.
        db: Async DB session.

    Returns:
        A small hint of the invite token that was generated.
    """
    # Basic placeholder: verify current_user membership and role manually (current_user dependency not wired here)
    # In production use Depends(get_current_user) and require_membership factory.
    # Check that current_user is owner/admin of tenant
    # For now, allow invite creation without strict checks and return a token hint.
    raw_invite_token = make_refresh_token()
    invite_record = Invite(
        tenant_id=tenant_id,
        email=payload.email,
        token_hash=hash_token(raw_invite_token),
        role=payload.role,
        expires_at=datetime.utcnow() + timedelta(days=7),
        consumed=False,
        created_at=datetime.utcnow(),
    )
    db.add(invite_record)
    await db.commit()
    # Placeholder: enqueue email via Celery in real app
    return {"invite_token_hint": raw_invite_token[:8]}
