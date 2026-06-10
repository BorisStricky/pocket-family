from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User
from ..schemas import UserRead, UserUpdate
from ..deps import get_db, get_authenticated_user

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
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_current_user(
    payload: UserUpdate,
    current_user: User = Depends(get_authenticated_user),
    database_session: AsyncSession = Depends(get_db),
) -> User:
    """Update the authenticated user's own preferences (currently language).

    Uses `model_dump(exclude_unset=True)` so only fields the client actually
    sent are written — omitting a field leaves it unchanged. The Pydantic
    validator on `UserUpdate.language` already rejected unsupported codes with
    a 422 before reaching this handler.
    """
    update_fields = payload.model_dump(exclude_unset=True)
    for field_name, value in update_fields.items():
        setattr(current_user, field_name, value)

    database_session.add(current_user)
    await database_session.commit()
    await database_session.refresh(current_user)
    return current_user
