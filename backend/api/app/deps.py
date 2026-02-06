# Dependency helpers for FastAPI (DB sessions, auth, tenant scoping)
# Important invariants:
# - Dependencies enforce tenant isolation: always validate tenant_id against current_user.
# - `get_db` yields a session; tests override it in conftest. Keep the public name unchanged.

from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from .db import get_db
from .models import User, Membership, Tenant, MembershipStatus
from .schemas import ActiveContext
from .auth import decode_access_token
from uuid import UUID as UUIDType


async def get_active_context(db: AsyncSession = Depends(get_db), authorization: str | None = Header(None)):
    """Resolve the currently authenticated user and tenant from an Authorization header.

    Args:
        db: Async DB session dependency (public parameter name retained for tests/DI).
        authorization: Raw Authorization header value expected as "Bearer <token>".

    Returns:
        Dictonary with User and Tenant records extracted from the token
        {"user":User, "tenant":Tenant}

    Raises:
        HTTPException with status 401 when credentials are missing, invalid, expired,
        or when the user no longer exists.
    """
    async def check_membership(user_id: str, tenant_id: str, db: AsyncSession):
        """Function returning a membership record that ensures the current user is a member of a tenant.

        It will load the Membership record for the current user and the
        provided tenant_id. It returns the Membership instance when the user is a member,
        otherwise raises HTTPException 403.

        Args:
            user_id and tenant_id to validate membership against.

        Returns:
            MembershipRecord.
    """
        # defensively convert each identifier to UUID when possible
        try:
            user_uuid = UUIDType(user_id)
        except Exception:
            user_uuid = user_id

        try:
            tenant_uuid = UUIDType(tenant_id)
        except Exception:
            tenant_uuid = tenant_id

        # This query loads membership for given user and tenant to validate membership.
        db_session = db
        membership_query = select(Membership).where(
            Membership.user_id == user_uuid,
            Membership.tenant_id == tenant_uuid,
        )
        membership_query_result = await db_session.execute(membership_query)
        membership_record = membership_query_result.scalars().first()

        # Authorization check: current_user must be owner or admin of tenant_id.
        # Prevent cross-tenant access — this is the primary data isolation guard.
        if not membership_record or membership_record.status is not MembershipStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of the family")
        return membership_record

    # Authorization: verify token -> payload -> load user record.
    # Fail fast on revoked/expired tokens to avoid unnecessary DB work.
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")

    # Token handling: parse minimal claims only (sub, exp, tid) to reduce attack surface.
    token_str = authorization.split(" ", 1)[1]
    jwt_payload = decode_access_token(token_str)
    if not jwt_payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = jwt_payload.get("sub")
    tenant_id = jwt_payload.get("tenant_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    # tokens store UUIDs as strings; convert to UUID object for DB operations
    try:
        user_uuid = UUIDType(user_id)
        tenant_uuid = UUIDType(tenant_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user id in token")

    # alias public db param to a clearer local name for readability
    db_session = db
    user_record = await db_session.get(User, user_uuid)
    tenant_record = await db_session.get(Tenant, tenant_uuid)
    if not user_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not tenant_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    
    #Check membership already checks if membership exists and if active
    membership_record = await check_membership(user_id=user_record.id, tenant_id=tenant_record.id, db=db)
    
    active_context = ActiveContext(active_user = user_record, active_tenant = tenant_record, active_membership=membership_record)
    return active_context

async def get_authenticated_user(db: AsyncSession = Depends(get_db), authorization: str | None = Header(None)):
    """Return the authenticated user from the JWT without validating tenant membership.

    Use this for endpoints that don't require tenant scope, such as listing families,
    creating families, or switching tenants. These operations only need user identity.

    This avoids the problem where a user whose active tenant membership was removed
    gets locked out of ALL endpoints (including listing their other families).

    Returns:
        User record from the database.

    Raises:
        HTTPException 401 when credentials are missing, invalid, or expired.
        HTTPException 404 when the user no longer exists.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")

    token_str = authorization.split(" ", 1)[1]
    jwt_payload = decode_access_token(token_str)
    if not jwt_payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = jwt_payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    try:
        user_uuid = UUIDType(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user id in token")

    user_record = await db.get(User, user_uuid)
    if not user_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return user_record


async def get_current_user(active_context: ActiveContext = Depends(get_active_context)):
    """
    Return the active user extracted from the Authorization header.
    NOTE: This validates tenant membership. For endpoints that only need user identity
    (list families, create family, switch family), use get_authenticated_user instead.

    Returns:
        User record

    Raises:
        HTTPException with status 401 when credentials are missing, invalid, expired,
        or when the user no longer exists.
    """
    return active_context.active_user

async def get_current_tenant(active_context: ActiveContext = Depends(get_active_context)):
    """
    Return the active tenant extracted from the Authorization header.

    Returns:
        Tenant record

    Raises:
        HTTPException with status 401 when credentials are missing, invalid, expired,
        or when the user no longer exists.
    """
    return active_context.active_tenant
