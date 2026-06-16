# backend/api/app/services/users.py
# User-profile service helpers relocated from routers/users.py.
# These functions interact with the database directly and are framework-agnostic
# (they take a plain AsyncSession), so routers, workers, and tests can all reuse
# them. Following the accounts service exemplar, they stage work on the session
# but never call commit / rollback — the router owns the transaction boundary.

from ..models import User
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas import UserUpdate


def build_user_read(user: User) -> User:
    """Return the user record to be serialized as the /users/me response.

    The /users/me read needs no DB access — the authenticated User is already
    resolved by the `get_authenticated_user` dependency. This thin helper exists
    only to keep the router free of any data-shaping decisions and to mirror the
    `build_<entity>_read` convention used across the service layer.
    """
    return user


async def apply_user_update(
    session: AsyncSession, user: User, payload: UserUpdate
) -> User:
    """Apply a partial update to the user's own profile in place (no commit).

    Uses `model_dump(exclude_unset=True)` so only fields the client actually sent
    are written — omitting a field leaves it unchanged. The Pydantic validator on
    `UserUpdate.language` already rejected unsupported codes with a 422 before
    reaching here. Pure staging: the handler owns the unit of work (commit /
    refresh); this function only mutates the record and stages it on the session.
    """
    update_fields = payload.model_dump(exclude_unset=True)
    for field_name, value in update_fields.items():
        setattr(user, field_name, value)

    session.add(user)
    return user
