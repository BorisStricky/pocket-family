#!/usr/bin/env python3
"""Daily-reset script for the public demo instance.

Wipes the demo tenant's mutable data (transactions, accounts, categories,
budgets, invites, non-owner memberships) and re-seeds with the same defaults
a real signup gets, plus ~1000 trailing-90-day transactions distributed across
the default category tree.

The user / tenant / owner-membership are preserved so the demo login keeps
working across resets. Transaction dates are computed from ``date.today()``
at run time so each daily run rolls the dataset forward by one day.

Usage:
    python -m backend.scripts.seed_demo_data
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List

from sqlalchemy import delete
from sqlmodel import select

_HERE = os.path.dirname(os.path.abspath(__file__))
for _candidate in (
    os.path.abspath(os.path.join(_HERE, "..", "api")),
    os.path.abspath(os.path.join(_HERE, "..")),
):
    if os.path.isdir(os.path.join(_candidate, "app")):
        sys.path.append(_candidate)
        break

from app.db import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    Account,
    AccountShare,
    AccountType,
    Budget,
    BudgetCategory,
    Category,
    CategoryKind,
    Currency,
    Invite,
    Membership,
    MembershipRole,
    Tenant,
    Transaction,
    TransactionSource,
    TransactionType,
    User,
)
from app.seed_defaults import seed_tenant_defaults  # noqa: E402

# Import after sys.path is set so ``ensure_demo_user`` can be co-located.
sys.path.append(_HERE)
from ensure_demo_user import (  # noqa: E402
    DEMO_EMAIL,
    DEMO_TENANT_NAME,
    ensure_demo_user,
)

log = logging.getLogger("seed_demo_data")

# Deterministic randomness — consecutive runs produce the same *shape* of
# data (counts, weights, amount distribution). Dates roll forward because
# they're anchored to date.today() at run time.
random.seed(42)

TARGET_TRANSACTION_COUNT = 1000
LOOKBACK_DAYS = 90

# Weights across the five default parent categories. Tuned for a believable
# personal-finance dataset; total need not be 1.0, ``random.choices`` normalises.
_PARENT_WEIGHTS: Dict[str, float] = {
    "Food": 0.30,
    "Bills": 0.20,
    "Transport": 0.15,
    "Leisure": 0.20,
    "Other": 0.15,
}

# Per-parent amount ranges (min, max) in BRL.
_PARENT_AMOUNT_RANGES: Dict[str, tuple[float, float]] = {
    "Food": (5.0, 80.0),
    "Bills": (50.0, 500.0),
    "Transport": (10.0, 80.0),
    "Leisure": (10.0, 150.0),
    "Other": (5.0, 200.0),
}

# Description pools per parent so the dataset reads as realistic at a glance.
_DESCRIPTIONS: Dict[str, List[str]] = {
    "Food": [
        "Whole Foods", "Trader Joe's", "Local market", "Coffee shop",
        "Pizza night", "Sushi takeout", "Bakery", "Lunch out",
    ],
    "Bills": [
        "Electricity", "Water", "Internet", "Phone plan",
        "Spotify", "Netflix", "Rent", "Gym membership", "Insurance",
    ],
    "Transport": [
        "Shell", "Uber", "Metro card", "Parking", "BP gas",
        "Bus fare", "Bike share",
    ],
    "Leisure": [
        "Movie tickets", "Concert", "Steam game", "Bookstore",
        "Climbing gym", "Museum entry", "Weekend trip",
    ],
    "Other": [
        "Pharmacy", "Haircut", "Gift", "Donation", "Stationery",
        "Pet supplies", "Hardware store",
    ],
}

# Account-type sampling weights (credit cards see the most use, then debit, then cash).
_ACCOUNT_TYPE_WEIGHTS: Dict[AccountType, float] = {
    AccountType.CREDIT: 0.55,
    AccountType.DEBIT: 0.35,
    AccountType.CASH: 0.10,
}

# Monthly recurring income approximations.
_INCOME_DAYS = (1, 15)
_INCOME_AMOUNT = Decimal("2500.00")


async def _load_demo_context(session) -> tuple[User, Tenant, Membership]:
    """Locate the demo user, their owner membership, and the demo tenant."""
    user_lookup = await session.execute(select(User).where(User.email == DEMO_EMAIL))
    user = user_lookup.scalars().first()
    if user is None:
        raise RuntimeError(
            f"Demo user {DEMO_EMAIL} not found — run ensure_demo_user first."
        )

    membership_lookup = await session.execute(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.role == MembershipRole.OWNER,
        )
    )
    owner_membership = membership_lookup.scalars().first()
    if owner_membership is None:
        raise RuntimeError(
            "Demo user has no owner membership — run ensure_demo_user first."
        )

    tenant = await session.get(Tenant, owner_membership.tenant_id)
    if tenant is None:
        raise RuntimeError("Demo tenant row missing despite membership reference.")

    return user, tenant, owner_membership


async def _wipe_tenant_data(session, tenant_id, demo_user_id, owner_membership_id) -> None:
    """Remove all tenant-scoped data except the demo user/tenant/owner-membership.

    Order matters because of foreign-key constraints: transactions and
    budget-category links go first, then categories and budgets, then accounts
    and their shares, then any pending invites / extra memberships.
    """
    await session.execute(delete(Transaction).where(Transaction.tenant_id == tenant_id))
    await session.execute(delete(BudgetCategory).where(BudgetCategory.tenant_id == tenant_id))
    await session.execute(delete(Budget).where(Budget.tenant_id == tenant_id))

    # Categories: children first (FK to parent_id), then parents.
    await session.execute(
        delete(Category).where(
            Category.tenant_id == tenant_id,
            Category.parent_id.is_not(None),
        )
    )
    await session.execute(delete(Category).where(Category.tenant_id == tenant_id))

    # Account shares are tenant-scoped; the owning Account rows are owned by
    # the demo user — wipe the user's accounts so a fresh signup-style seed
    # recreates them. (No cross-tenant sharing exists on the demo.)
    await session.execute(delete(AccountShare).where(AccountShare.tenant_id == tenant_id))
    await session.execute(delete(Account).where(Account.user_id == demo_user_id))

    # Invites and non-owner memberships introduced by demo visitors.
    await session.execute(delete(Invite).where(Invite.tenant_id == tenant_id))
    await session.execute(
        delete(Membership).where(
            Membership.tenant_id == tenant_id,
            Membership.id != owner_membership_id,
        )
    )

    await session.flush()


def _pick_amount(parent_name: str) -> Decimal:
    low, high = _PARENT_AMOUNT_RANGES[parent_name]
    raw = random.uniform(low, high)
    return Decimal(f"{raw:.2f}")


def _pick_description(parent_name: str) -> str:
    return random.choice(_DESCRIPTIONS[parent_name])


def _pick_account(accounts: List[Account]) -> Account:
    weighted: List[tuple[Account, float]] = [
        (account, _ACCOUNT_TYPE_WEIGHTS.get(account.type, 0.1)) for account in accounts
    ]
    return random.choices(
        [pair[0] for pair in weighted],
        weights=[pair[1] for pair in weighted],
        k=1,
    )[0]


async def _build_demo_transactions(
    session,
    tenant: Tenant,
    user: User,
    today: date,
) -> None:
    """Generate ~TARGET_TRANSACTION_COUNT transactions over the trailing window."""
    category_lookup = await session.execute(
        select(Category).where(Category.tenant_id == tenant.id)
    )
    all_categories = category_lookup.scalars().all()

    # Map parent name → list of categories to bill against (parent + children).
    parents_by_name = {category.name: category for category in all_categories if category.parent_id is None}
    categories_by_parent: Dict[str, List[Category]] = {}
    for parent_name, parent_record in parents_by_name.items():
        children = [
            category for category in all_categories if category.parent_id == parent_record.id
        ]
        # Include the parent itself so categories without children (Bills, Other) still get hits.
        categories_by_parent[parent_name] = children if children else [parent_record]

    account_lookup = await session.execute(select(Account).where(Account.user_id == user.id))
    accounts = account_lookup.scalars().all()
    if not accounts:
        raise RuntimeError("Demo user has no accounts after re-seeding defaults.")

    parent_names = list(_PARENT_WEIGHTS.keys())
    parent_weight_values = [_PARENT_WEIGHTS[name] for name in parent_names]

    transactions_to_insert: List[Transaction] = []

    # Expense transactions: pick a parent by weight, child by uniform choice.
    for _ in range(TARGET_TRANSACTION_COUNT):
        day_offset = random.randint(0, LOOKBACK_DAYS - 1)
        transaction_date_value = today - timedelta(days=day_offset)
        parent_name = random.choices(parent_names, weights=parent_weight_values, k=1)[0]
        category = random.choice(categories_by_parent[parent_name])
        account = _pick_account(list(accounts))

        transactions_to_insert.append(
            Transaction(
                tenant_id=tenant.id,
                account_id=account.id,
                category_id=category.id,
                transaction_date=transaction_date_value,
                transaction_type=TransactionType.EXPENSE,
                amount=_pick_amount(parent_name),
                currency=Currency.BRL,
                created_by=user.id,
                description=_pick_description(parent_name),
                source=TransactionSource.MANUAL,
            )
        )

    # Recurring income: two paydays per month over the lookback window. Use
    # whichever account is debit-typed when available, else the first account.
    debit_account = next((account for account in accounts if account.type == AccountType.DEBIT), accounts[0])
    earliest = today - timedelta(days=LOOKBACK_DAYS - 1)
    cursor = date(earliest.year, earliest.month, 1)
    while cursor <= today:
        for payday_day in _INCOME_DAYS:
            try:
                payday = cursor.replace(day=payday_day)
            except ValueError:
                continue
            if earliest <= payday <= today:
                transactions_to_insert.append(
                    Transaction(
                        tenant_id=tenant.id,
                        account_id=debit_account.id,
                        category_id=None,
                        transaction_date=payday,
                        transaction_type=TransactionType.INCOME,
                        amount=_INCOME_AMOUNT,
                        currency=Currency.BRL,
                        created_by=user.id,
                        description="Salary",
                        source=TransactionSource.RECURRING,
                    )
                )
        # Advance one month
        next_month = cursor.month + 1
        next_year = cursor.year + (1 if next_month > 12 else 0)
        cursor = date(next_year, ((next_month - 1) % 12) + 1, 1)

    session.add_all(transactions_to_insert)
    await session.flush()


async def reset_demo_data() -> None:
    """Wipe and re-seed the demo tenant. Exits non-zero on any failure."""
    # Make sure the demo user/tenant exist before we try to operate on them.
    await ensure_demo_user()

    today = date.today()
    random.seed(42)  # Re-seed for deterministic generation each run.

    async with SessionLocal() as session:
        user, tenant, owner_membership = await _load_demo_context(session)

        await _wipe_tenant_data(
            session=session,
            tenant_id=tenant.id,
            demo_user_id=user.id,
            owner_membership_id=owner_membership.id,
        )

        # Re-create starter categories, budget, and accounts via the same
        # path a real signup uses, so demo data exactly matches a fresh user.
        await seed_tenant_defaults(session, tenant, user, include_accounts=True)

        await _build_demo_transactions(session, tenant, user, today)

        # Bump the tenant updated_at-equivalent (we just rely on commit time).
        await session.commit()

    log.info(
        "Demo tenant reset complete: %s transactions over %s-day window ending %s",
        TARGET_TRANSACTION_COUNT,
        LOOKBACK_DAYS,
        today.isoformat(),
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        asyncio.run(reset_demo_data())
    except Exception:
        log.exception("Demo data reset failed")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
