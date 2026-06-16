# backend/api/app/routers/users.py
#
# HTTP boundary for /users. Handlers stay thin: they resolve dependencies,
# call services/users.py for all record building / business rules, and own only
# the transaction boundary (commit / refresh). No raw SQL or session.add/get/
# delete lives here — that is the service layer's job.
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User
from ..schemas import UserRead, UserUpdate
from ..deps import get_db, get_authenticated_user
from ..services import users as user_service

# User-scoped (not tenant-scoped) profile endpoints. Language is a personal
# preference that must work even when the user has no active family, so these
# routes use `get_authenticated_user` (identity only) rather than
# `get_active_context` (which requires an active tenant membership).
router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_current_user(
    current_user: User = Depends(get_authenticated_user),
) -> User:
    """Return the authenticated user's own profile.

    The frontend calls this on load to restore the server-side language
    preference, so a returning user on a fresh device picks up their saved
    choice. No tenant scope is needed — identity from the JWT is sufficient.
    """
    return user_service.build_user_read(current_user)


@router.patch("/me", response_model=UserRead)
async def update_current_user(
    payload: UserUpdate,
    current_user: User = Depends(get_authenticated_user),
    database_session: AsyncSession = Depends(get_db),
) -> User:
    """Update the authenticated user's own preferences (currently language).

    Delegates field-application to the service layer and owns the transaction
    boundary here (commit + refresh), keeping this handler a thin orchestrator.
    """
    await user_service.apply_user_update(database_session, current_user, payload)
    await database_session.commit()
    await database_session.refresh(current_user)
    return current_user
