# backend/api/app/routers/auth.py
#
# HTTP boundary for the auth endpoints (signup, login, refresh, logout, invites).
# Handlers stay thin: they resolve dependencies, read/write the cookie + response,
# call services/auth.py for ALL DB queries / record building / business rules, and
# own only the transaction boundary (commit / rollback / refresh). No raw SQL or
# session.add/get/delete/execute lives here — that is the service layer's job.
#
# Security-sensitive notes preserved across the refactor:
#   - Refresh-token rotation (hash → look up → validate → revoke old + stage new
#     under ONE commit) is unchanged, just relocated into services/auth.py.
#   - TEST_MODE still returns the raw refresh token in the response body.
#   - Demo-mode guards (assert_not_demo) and require_owner wiring are untouched.
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..schemas import SignupIn, LoginIn, TokenOut, InviteCreate, ActiveContext
from ..deps import require_owner
from ..auth import (
    create_access_token,
    make_refresh_token,
    REFRESH_TOKEN_EXPIRE_DAYS,
    is_test_mode,
    cookies_secure,
    assert_not_demo,
)
from ..rate_limit import limiter
from ..services import auth as auth_service

router = APIRouter()


def _set_refresh_cookie(response: Response, raw_refresh_token: str) -> None:
    """Attach the refresh_token as an HttpOnly cookie (production security).

    Centralizes the Set-Cookie attributes shared by signup / login / refresh so
    they stay identical (the logout delete_cookie must match these attributes for
    the browser to clear the same cookie).
    """
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,           # Prevent JavaScript access (XSS protection)
        secure=cookies_secure(), # HTTPS-only when COOKIE_SECURE=1 (default); browser will not send Secure cookies over plain HTTP
        samesite="lax",          # CSRF protection
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # seconds
    )


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
    # Stage user + default tenant + owner membership + seeded defaults. The service
    # performs the single id-populating flush; this handler owns the commits.
    user, tenant, _membership = await auth_service.stage_signup(db, payload)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id), "tenant_id": str(tenant.id), "roles": ["owner"]})
    # create refresh token DB entry (second unit of work, mirroring the original flow)
    raw_refresh_token = make_refresh_token()
    await auth_service.stage_new_refresh_token(db, user_id=user.id, raw_refresh_token=raw_refresh_token)
    await db.commit()

    _set_refresh_cookie(response, raw_refresh_token)

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
    user = await auth_service.authenticate_user(db, payload)

    # Resolve membership (preferred-tenant logic) and, if an explicit tenant was
    # requested, validate it (403) and record it as the user's preferred tenant.
    membership = await auth_service.resolve_login_membership(db, user, payload.tenant_uuid)

    tenant_id = membership.tenant_id if membership else None
    roles = [membership.role] if membership else []
    access_token = create_access_token({
        "sub": str(user.id),
        "tenant_id": str(tenant_id) if tenant_id else None,
        "roles": roles
    })
    raw_refresh_token = make_refresh_token()
    await auth_service.stage_new_refresh_token(db, user_id=user.id, raw_refresh_token=raw_refresh_token)
    await db.commit()

    _set_refresh_cookie(response, raw_refresh_token)

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
    refresh_token_record = await auth_service.lookup_refresh_token(db, refresh_token)

    # Unknown or expired token: reject without side effects.
    if auth_service.is_refresh_token_unusable(refresh_token_record):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Reuse detection: a refresh token is single-use. If it was already revoked
    # (i.e. previously rotated), someone is replaying an old token — revoke the
    # entire token family so neither the attacker's nor the victim's descendant
    # tokens remain valid, forcing a fresh login (Security H-2).
    if refresh_token_record.revoked:
        await auth_service.revoke_refresh_token_family(db, refresh_token_record)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected; session revoked",
        )

    # Rotate atomically: revoke the presented token and stage its replacement
    # (same family). Both land under the single commit below — one unit of work.
    user, new_raw_refresh_token = await auth_service.rotate_refresh_token(db, refresh_token_record)
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

    _set_refresh_cookie(response, new_raw_refresh_token)

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
        # Best-effort revoke of the matching active token; no-op if unknown.
        await auth_service.revoke_refresh_token_if_active(db, refresh_token)
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

    # Generate secure invite token and stage the invite record (service); commit here.
    raw_invite_token = await auth_service.stage_invite(db, tenant_id, payload)
    await db.commit()
    # Placeholder: enqueue email via Celery in real app
    return {"invite_token_hint": raw_invite_token[:8]}
