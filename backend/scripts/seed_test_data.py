#!/usr/bin/env python3
"""
Seed script that drops all data and populates the database with a structured
test dataset for manual QA.

Usage (inside the backend container):
  cd /workspace/backend && FORCE_SEED=1 python scripts/seed_test_data.py

Or via docker compose from host:
  docker compose -f docker-compose.dev.yml exec backend sh -c \
    'FORCE_SEED=1 python scripts/seed_test_data.py'
"""

import asyncio
import calendar
import os
import sys
import random
from datetime import datetime, date, timedelta
from decimal import Decimal
from uuid import uuid4

# Make the app package importable from repo root or container
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api")))

# Safety gate
if os.getenv("FORCE_SEED", "0") != "1":
    raise SystemExit("Refusing to run: set FORCE_SEED=1 to confirm data wipe + seed.")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.models import (
    User, Tenant, Membership, Account, Category, Transaction,
    AccountShare, Budget, BudgetCategory, RefreshToken, Invite,
    MembershipRole, MembershipStatus, AccountType, Currency,
    CategoryKind, TransactionType, TransactionSource, ShareVisibility,
)
from app.auth import hash_password

# Deterministic randomness for reproducible seed data
random.seed(42)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@db:5433/pfinancedb",
)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_factory = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# ---------------------------------------------------------------------------
# Description word pools for transaction descriptions
# ---------------------------------------------------------------------------
ADJECTIVES = [
    "Quick", "Daily", "Monthly", "Late", "Early", "Regular", "Extra",
    "Small", "Large", "Urgent", "Planned", "Surprise", "Weekend", "Morning",
]
NOUNS = [
    "groceries", "lunch", "dinner", "coffee", "taxi", "bus", "snack",
    "medicine", "clothes", "shoes", "books", "repair", "fuel", "parking",
    "subscription", "delivery", "tip", "supplies", "ticket", "gift",
    "haircut", "laundry", "donation", "insurance", "internet", "phone",
]
VERBS = [
    "bought", "paid", "ordered", "renewed", "fixed", "topped-up",
    "refilled", "grabbed", "picked-up", "settled",
]


def random_description() -> str:
    """Generate a creative 2-5 word transaction description."""
    word_count = random.randint(2, 5)
    words = []
    if word_count >= 3 and random.random() < 0.5:
        words.append(random.choice(VERBS))
    if random.random() < 0.6:
        words.append(random.choice(ADJECTIVES))
    words.append(random.choice(NOUNS))
    # Pad to desired length with extra nouns/adjectives
    while len(words) < word_count:
        words.insert(random.randint(0, len(words)), random.choice(NOUNS + ADJECTIVES))
    return " ".join(words[:word_count]).capitalize()


def random_amount() -> Decimal:
    """Random amount between 10.00 and 250.00 with .00/.25/.50/.75 decimals."""
    whole = random.randint(10, 250)
    fraction = random.choice(["00", "25", "50", "75"])
    return Decimal(f"{whole}.{fraction}")


def generate_dates_for_month(year: int, month: int, count: int) -> list[date]:
    """Generate `count` dates spread across the given month with slight jitter."""
    days_in_month = calendar.monthrange(year, month)[1]

    dates = []
    spacing = days_in_month / count
    for index in range(count):
        base_day = 1 + spacing * index
        # Add jitter of +/- 1 day (clamped)
        jitter = random.uniform(-1.0, 1.0)
        day = max(1, min(days_in_month, int(base_day + jitter)))
        dates.append(date(year, month, day))
    return dates


# ---------------------------------------------------------------------------
# Main seed logic
# ---------------------------------------------------------------------------
async def seed():
    print(f"Connecting to: {DATABASE_URL}")

    # Hash password once (Argon2 is slow by design)
    print("Hashing password...")
    hashed_password = hash_password("test123")

    async with async_session_factory() as session:
        # ------------------------------------------------------------------
        # 1. Truncate all tables
        # ------------------------------------------------------------------
        print("Truncating all tables...")
        await session.execute(text(
            "TRUNCATE TABLE "
            "budgetcategory, budget, transaction, accountshare, account, "
            "category, membership, invite, refreshtoken, tenant, \"user\" "
            "CASCADE"
        ))
        await session.commit()
        print("  All tables truncated.")

        # ------------------------------------------------------------------
        # 2. Create users
        # ------------------------------------------------------------------
        print("Creating users...")
        user1 = User(id=uuid4(), email="user1@test.com", password_hash=hashed_password, name="User One")
        user2 = User(id=uuid4(), email="user2@test.com", password_hash=hashed_password, name="User Two")
        user3 = User(id=uuid4(), email="user3@test.com", password_hash=hashed_password, name="User Three")
        session.add_all([user1, user2, user3])
        await session.flush()

        # ------------------------------------------------------------------
        # 3. Create tenants (families)
        # ------------------------------------------------------------------
        print("Creating families...")
        # Auto-created families (simulating signup)
        family_f11 = Tenant(id=uuid4(), name="User One's family")
        family_f21 = Tenant(id=uuid4(), name="User Two's family")
        family_f31 = Tenant(id=uuid4(), name="User Three's family")
        # Additional families
        family_f12 = Tenant(id=uuid4(), name="User 1's 2nd Family")
        family_f13 = Tenant(id=uuid4(), name="User 1's 3rd Family")
        family_f23 = Tenant(id=uuid4(), name="User 2's 3rd Family")

        all_families = [family_f11, family_f12, family_f13, family_f21, family_f31, family_f23]
        session.add_all(all_families)
        await session.flush()

        # Set preferred_tenant_id for each user (their first family)
        user1.preferred_tenant_id = family_f11.id
        user2.preferred_tenant_id = family_f21.id
        user3.preferred_tenant_id = family_f31.id
        session.add_all([user1, user2, user3])
        await session.flush()

        # ------------------------------------------------------------------
        # 4. Create owner memberships
        # ------------------------------------------------------------------
        print("Creating memberships...")
        owner_memberships = [
            # User 1 owns F11, F12, F13
            Membership(id=uuid4(), tenant_id=family_f11.id, user_id=user1.id,
                       user_email=user1.email, role=MembershipRole.OWNER, status=MembershipStatus.ACTIVE),
            Membership(id=uuid4(), tenant_id=family_f12.id, user_id=user1.id,
                       user_email=user1.email, role=MembershipRole.OWNER, status=MembershipStatus.ACTIVE),
            Membership(id=uuid4(), tenant_id=family_f13.id, user_id=user1.id,
                       user_email=user1.email, role=MembershipRole.OWNER, status=MembershipStatus.ACTIVE),
            # User 2 owns F21, F23
            Membership(id=uuid4(), tenant_id=family_f21.id, user_id=user2.id,
                       user_email=user2.email, role=MembershipRole.OWNER, status=MembershipStatus.ACTIVE),
            Membership(id=uuid4(), tenant_id=family_f23.id, user_id=user2.id,
                       user_email=user2.email, role=MembershipRole.OWNER, status=MembershipStatus.ACTIVE),
            # User 3 owns F31
            Membership(id=uuid4(), tenant_id=family_f31.id, user_id=user3.id,
                       user_email=user3.email, role=MembershipRole.OWNER, status=MembershipStatus.ACTIVE),
        ]
        session.add_all(owner_memberships)

        # Shared memberships
        shared_memberships = [
            # F12 shared with user2 as OWNER
            Membership(id=uuid4(), tenant_id=family_f12.id, user_id=user2.id,
                       user_email=user2.email, role=MembershipRole.OWNER, status=MembershipStatus.ACTIVE),
            # F13 shared with user3 as MEMBER (Editor)
            Membership(id=uuid4(), tenant_id=family_f13.id, user_id=user3.id,
                       user_email=user3.email, role=MembershipRole.MEMBER, status=MembershipStatus.ACTIVE),
            # F23 shared with user3 as VIEWER
            Membership(id=uuid4(), tenant_id=family_f23.id, user_id=user3.id,
                       user_email=user3.email, role=MembershipRole.VIEWER, status=MembershipStatus.ACTIVE),
        ]
        session.add_all(shared_memberships)
        await session.flush()

        # ------------------------------------------------------------------
        # 5. Create family accounts (18 total)
        # ------------------------------------------------------------------
        print("Creating family accounts...")
        # Map family code -> (tenant, owner user)
        family_map = {
            "F11": (family_f11, user1),
            "F12": (family_f12, user1),
            "F13": (family_f13, user1),
            "F21": (family_f21, user2),
            "F31": (family_f31, user3),
            "F23": (family_f23, user2),
        }

        # Store accounts per family for transaction generation
        family_accounts: dict[str, list[Account]] = {}

        for code, (tenant, owner) in family_map.items():
            accounts = [
                Account(id=uuid4(), user_id=owner.id, name=f"{code} Cash",
                        type=AccountType.CASH, currency=Currency.BRL, balance=Decimal("0.00")),
                Account(id=uuid4(), user_id=owner.id, name=f"{code} Debit Card",
                        type=AccountType.DEBIT, currency=Currency.BRL, balance=Decimal("0.00")),
                Account(id=uuid4(), user_id=owner.id, name=f"{code} Credit Card",
                        type=AccountType.CREDIT, currency=Currency.BRL, balance=Decimal("0.00")),
            ]
            family_accounts[code] = accounts
            session.add_all(accounts)

            # Create AccountShares so these accounts are visible in their family
            for account in accounts:
                session.add(AccountShare(
                    id=uuid4(), account_id=account.id, tenant_id=tenant.id,
                    visibility=ShareVisibility.VISIBLE, granted_by=owner.id,
                ))
        await session.flush()

        # ------------------------------------------------------------------
        # 6b. Create global accounts (User 1 only, all CASH BRL)
        # ------------------------------------------------------------------
        print("Creating global accounts...")
        global_0 = Account(id=uuid4(), user_id=user1.id, name="Global 0",
                           type=AccountType.CASH, currency=Currency.BRL, balance=Decimal("0.00"))
        global_12 = Account(id=uuid4(), user_id=user1.id, name="Global 1-2",
                            type=AccountType.CASH, currency=Currency.BRL, balance=Decimal("0.00"))
        global_123 = Account(id=uuid4(), user_id=user1.id, name="Global 1-2-3",
                             type=AccountType.CASH, currency=Currency.BRL, balance=Decimal("0.00"))
        session.add_all([global_0, global_12, global_123])
        await session.flush()

        # Global 0 — no shares
        # Global 1-2 — shared with F11 (visible) and F12 (visible)
        session.add_all([
            AccountShare(id=uuid4(), account_id=global_12.id, tenant_id=family_f11.id,
                         visibility=ShareVisibility.VISIBLE, granted_by=user1.id),
            AccountShare(id=uuid4(), account_id=global_12.id, tenant_id=family_f12.id,
                         visibility=ShareVisibility.VISIBLE, granted_by=user1.id),
        ])
        # Global 1-2-3 — F11 visible, F12 visible, F13 hidden
        session.add_all([
            AccountShare(id=uuid4(), account_id=global_123.id, tenant_id=family_f11.id,
                         visibility=ShareVisibility.VISIBLE, granted_by=user1.id),
            AccountShare(id=uuid4(), account_id=global_123.id, tenant_id=family_f12.id,
                         visibility=ShareVisibility.VISIBLE, granted_by=user1.id),
            AccountShare(id=uuid4(), account_id=global_123.id, tenant_id=family_f13.id,
                         visibility=ShareVisibility.HIDDEN, granted_by=user1.id),
        ])
        await session.flush()

        # Add global accounts to the family account pools for transaction generation
        # Global 1-2 is available in F11 and F12
        family_accounts["F11"].append(global_12)
        family_accounts["F12"].append(global_12)
        # Global 1-2-3 is available in F11, F12, and F13
        family_accounts["F11"].append(global_123)
        family_accounts["F12"].append(global_123)
        family_accounts["F13"].append(global_123)

        # ------------------------------------------------------------------
        # 7. Create categories (9 per family = 54 total)
        # ------------------------------------------------------------------
        print("Creating categories...")
        # Store categories per family for budget and transaction generation
        family_categories: dict[str, dict[str, Category]] = {}

        for code, (tenant, _owner) in family_map.items():
            categories: dict[str, Category] = {}

            # Parent categories
            category_1 = Category(id=uuid4(), tenant_id=tenant.id, name=f"{code} Category 1", kind=CategoryKind.EXPENSE)
            category_2 = Category(id=uuid4(), tenant_id=tenant.id, name=f"{code} Category 2", kind=CategoryKind.EXPENSE)
            category_3 = Category(id=uuid4(), tenant_id=tenant.id, name=f"{code} Category 3", kind=CategoryKind.EXPENSE)
            income = Category(id=uuid4(), tenant_id=tenant.id, name=f"{code} Income", kind=CategoryKind.INCOME)
            session.add_all([category_1, category_2, category_3, income])
            await session.flush()

            # Child categories for Category 1
            category_1_1 = Category(id=uuid4(), tenant_id=tenant.id, name=f"{code} Category 1-1",
                                    kind=CategoryKind.EXPENSE, parent_id=category_1.id)
            category_1_2 = Category(id=uuid4(), tenant_id=tenant.id, name=f"{code} Category 1-2",
                                    kind=CategoryKind.EXPENSE, parent_id=category_1.id)
            category_1_3 = Category(id=uuid4(), tenant_id=tenant.id, name=f"{code} Category 1-3",
                                    kind=CategoryKind.EXPENSE, parent_id=category_1.id)
            # Child categories for Category 2
            category_2_1 = Category(id=uuid4(), tenant_id=tenant.id, name=f"{code} Category 2-1",
                                    kind=CategoryKind.EXPENSE, parent_id=category_2.id)
            category_2_2 = Category(id=uuid4(), tenant_id=tenant.id, name=f"{code} Category 2-2",
                                    kind=CategoryKind.EXPENSE, parent_id=category_2.id)
            session.add_all([category_1_1, category_1_2, category_1_3, category_2_1, category_2_2])

            categories = {
                "cat1": category_1, "cat1_1": category_1_1, "cat1_2": category_1_2, "cat1_3": category_1_3,
                "cat2": category_2, "cat2_1": category_2_1, "cat2_2": category_2_2,
                "cat3": category_3, "income": income,
            }
            family_categories[code] = categories

        await session.flush()

        # ------------------------------------------------------------------
        # 8. Create budgets (4 per family = 24 total)
        # ------------------------------------------------------------------
        print("Creating budgets...")
        for code, (tenant, _owner) in family_map.items():
            categories = family_categories[code]

            # Budget 0 — no categories (universal)
            budget_0 = Budget(id=uuid4(), tenant_id=tenant.id, name=f"{code} Budget 0",
                              amount=Decimal("5000.00"), currency=Currency.BRL)
            # Budget 1 — Category 1 + subcategories
            budget_1 = Budget(id=uuid4(), tenant_id=tenant.id, name=f"{code} Budget 1",
                              amount=Decimal("2000.00"), currency=Currency.BRL)
            # Budget 2 — Category 2 + subcategories
            budget_2 = Budget(id=uuid4(), tenant_id=tenant.id, name=f"{code} Budget 2",
                              amount=Decimal("1500.00"), currency=Currency.BRL)
            # Budget 3 — Category 3 only
            budget_3 = Budget(id=uuid4(), tenant_id=tenant.id, name=f"{code} Budget 3",
                              amount=Decimal("500.00"), currency=Currency.BRL)
            session.add_all([budget_0, budget_1, budget_2, budget_3])
            await session.flush()

            # BudgetCategory links for Budget 1
            for category_key in ["cat1", "cat1_1", "cat1_2", "cat1_3"]:
                session.add(BudgetCategory(
                    id=uuid4(), tenant_id=tenant.id,
                    budget_id=budget_1.id, category_id=categories[category_key].id,
                ))
            # BudgetCategory links for Budget 2
            for category_key in ["cat2", "cat2_1", "cat2_2"]:
                session.add(BudgetCategory(
                    id=uuid4(), tenant_id=tenant.id,
                    budget_id=budget_2.id, category_id=categories[category_key].id,
                ))
            # BudgetCategory link for Budget 3
            session.add(BudgetCategory(
                id=uuid4(), tenant_id=tenant.id,
                budget_id=budget_3.id, category_id=categories["cat3"].id,
            ))

        await session.flush()

        # ------------------------------------------------------------------
        # 9. Generate transactions (600 per family = 3,600 total)
        # ------------------------------------------------------------------
        print("Generating transactions...")
        # Current month + 2 preceding months (oldest gets most transactions)
        today = date.today()
        months = []
        for months_ago in range(2, -1, -1):
            year = today.year
            month = today.month - months_ago
            while month <= 0:
                month += 12
                year -= 1
            months.append((year, month))
        month_specs = [(year, month, count) for (year, month), count in zip(months, [300, 200, 100])]
        total_transaction_count = 0

        for code, (tenant, owner) in family_map.items():
            # Only use EXPENSE categories for transactions
            expense_categories = [
                category for key, category in family_categories[code].items()
                if key != "income"
            ]
            accounts = family_accounts[code]

            for year, month, count in month_specs:
                dates = generate_dates_for_month(year, month, count)
                transaction_batch = []
                for transaction_date in dates:
                    chosen_category = random.choice(expense_categories)
                    chosen_account = random.choice(accounts)
                    amount = random_amount()

                    transaction_batch.append(Transaction(
                        id=uuid4(),
                        tenant_id=tenant.id,
                        account_id=chosen_account.id,
                        category_id=chosen_category.id,
                        transaction_date=transaction_date,
                        transaction_type=TransactionType.EXPENSE,
                        amount=amount,
                        currency=Currency.BRL,
                        created_by=owner.id,
                        description=random_description(),
                        source=TransactionSource.MANUAL,
                    ))

                session.add_all(transaction_batch)
                total_transaction_count += len(transaction_batch)

            family_total = sum(count for _, _, count in month_specs)
            print(f"  {code}: {family_total} transactions created")

        await session.flush()

        # ------------------------------------------------------------------
        # 10. Commit everything
        # ------------------------------------------------------------------
        await session.commit()
        print(f"\nSeed complete!")
        print(f"  Users:        3")
        print(f"  Families:     6")
        print(f"  Memberships:  9 (6 owner + 3 shared)")
        print(f"  Accounts:     21 (18 family + 3 global)")
        print(f"  AccountShares: {18 + 5} (18 family + 5 global)")
        print(f"  Categories:   54 (9 per family)")
        print(f"  Budgets:      24 (4 per family)")
        print(f"  Transactions: {total_transaction_count}")


if __name__ == "__main__":
    asyncio.run(seed())
