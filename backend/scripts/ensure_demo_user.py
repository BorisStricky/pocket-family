#!/usr/bin/env python3
"""Idempotently provision the shared demo account.

Used by:
  * the FastAPI startup hook when ``DEMO_MODE=1`` — so a fresh deploy is
    immediately usable without manual setup.
  * ``python -m backend.scripts.ensure_demo_user`` from the host or an ECS
    one-shot task for repair / verification.

The script creates (or updates) a single user, a single owner-membership and
a single tenant with the default seeded data. Running it multiple times is
safe: existing rows are left untouched, only missing pieces are created.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

from sqlmodel import select

# Resolve a path under which ``import app...`` will succeed. Locally that's
# ``backend/api/`` (sibling to scripts/); in the deployed backend image the
# api contents are flattened into /app so the parent of scripts/ is what
# we want. Try both, append whichever holds the ``app`` package.
_HERE = os.path.dirname(os.path.abspath(__file__))
for _candidate in (
    os.path.abspath(os.path.join(_HERE, "..", "api")),
    os.path.abspath(os.path.join(_HERE, "..")),
):
    if os.path.isdir(os.path.join(_candidate, "app")):
        sys.path.append(_candidate)
        break

from app.auth import hash_password  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    Membership,
    MembershipRole,
    MembershipStatus,
    Tenant,
    User,
)
from app.seed_defaults import seed_tenant_defaults  # noqa: E402

log = logging.getLogger("ensure_demo_user")

# Public constants — referenced by seed_demo_data.py to locate the demo tenant.
DEMO_EMAIL = "demo@pocket-family.com"
DEMO_PASSWORD = "demo123"
DEMO_USER_NAME = "Demo"
DEMO_TENANT_NAME = "Demo Family"


async def ensure_demo_user() -> None:
    """Create the demo user + tenant + membership + defaults if missing.

    Safe to call repeatedly. Skips work that has already been done.
    """
    async with SessionLocal() as session:
        user_lookup = await session.execute(select(User).where(User.email == DEMO_EMAIL))
        user = user_lookup.scalars().first()

        if user is None:
            user = User(
                email=DEMO_EMAIL,
                password_hash=hash_password(DEMO_PASSWORD),
                name=DEMO_USER_NAME,
                created_at=datetime.now(timezone.utc).replace(tzinfo=None),
            )
            session.add(user)
            await session.flush()
            log.info("Created demo user %s", DEMO_EMAIL)

        # Look for an existing owner membership for the demo user. If one
        # already exists, the demo tenant is also already in place.
        membership_lookup = await session.execute(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.role == MembershipRole.OWNER,
            )
        )
        owner_membership = membership_lookup.scalars().first()

        if owner_membership is None:
            tenant = Tenant(
                name=DEMO_TENANT_NAME,
                created_at=datetime.now(timezone.utc).replace(tzinfo=None),
            )
            session.add(tenant)
            await session.flush()

            owner_membership = Membership(
                user_id=user.id,
                user_email=user.email,
                tenant_id=tenant.id,
                role=MembershipRole.OWNER,
                status=MembershipStatus.ACTIVE,
                created_at=datetime.now(timezone.utc).replace(tzinfo=None),
            )
            session.add(owner_membership)

            # Seed the same default categories / budget / accounts a real
            # signup gets, so the empty demo tenant is immediately usable.
            await seed_tenant_defaults(session, tenant, user, include_accounts=True)

            user.preferred_tenant_id = tenant.id
            session.add(user)
            log.info("Created demo tenant %s and seeded defaults", tenant.id)

        await session.commit()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    asyncio.run(ensure_demo_user())


if __name__ == "__main__":
    main()
