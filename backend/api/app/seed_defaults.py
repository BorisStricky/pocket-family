# backend/api/app/seed_defaults.py
#
# Provides a helper function that seeds default data (categories, budget,
# and optionally accounts) whenever a new tenant is created. This ensures
# every new family starts with a useful set of expense categories and a
# starter budget so users can begin tracking finances immediately.
#
# The function uses db.add() + db.flush() — the caller is responsible for
# committing the transaction. This keeps the seeding atomic with the
# tenant/membership creation that precedes it.

from __future__ import annotations

from decimal import Decimal
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    Account,
    AccountShare,
    AccountType,
    Budget,
    BudgetCategory,
    Category,
    CategoryKind,
    Currency,
    ShareVisibility,
    Tenant,
    User,
)


# ---------------------------------------------------------------------------
# Default category definitions
# ---------------------------------------------------------------------------
# Each tuple is (parent_name, parent_icon, parent_color, [(child_name, child_icon), ...]).
# Children inherit their parent's color for visual cohesion.
# All default categories are EXPENSE kind because new users primarily
# need to categorise their spending — income categories can be added later.
# Icon names match Lucide React's PascalCase export names used in the frontend.

_DEFAULT_CATEGORY_TREE: List[tuple[str, str, str, List[tuple[str, str]]]] = [
    ("Bills", "Receipt", "#EF4444", []),
    ("Food", "Pizza", "#F97316", [
        ("Eat Out", "ForkKnife"),
        ("Groceries", "ShoppingCart"),
    ]),
    ("Leisure", "Smile", "#8B5CF6", [
        ("Sports", "Dumbbell"),
        ("Movies", "Film"),
        ("Music", "Music"),
    ]),
    ("Transport", "Car", "#3B82F6", [
        ("Fuel", "Fuel"),
        ("Taxi/Uber", "CarTaxiFront"),
    ]),
    ("Other", "Package", "#6B7280", []),
]

# Icon and color for default accounts created at signup, keyed by account type.
_ACCOUNT_TYPE_ICON_COLOR: dict[str, tuple[str, str]] = {
    "cash": ("Banknote", "#10B981"),
    "debit": ("Landmark", "#3B82F6"),
    "credit": ("CreditCard", "#EF4444"),
}


async def seed_tenant_defaults(
    database_session: AsyncSession,
    tenant: Tenant,
    user: User,
    include_accounts: bool = False,
) -> None:
    """Seed default data for a newly created tenant.

    Creates a starter set of expense categories, a monthly budget linked
    to all of those categories, and (optionally) one account per account
    type shared with the tenant.

    This function only flushes — the caller must commit the transaction so
    that seeding is atomic with the surrounding tenant/membership creation.

    Args:
        database_session: Active async database session (caller commits).
        tenant: The newly created Tenant to seed data for.
        user: The user who owns the tenant (used for account naming).
        include_accounts: When True, also create default accounts and
            share them with the tenant. Only used during signup — creating
            a second tenant should not duplicate accounts.
    """

    # ------------------------------------------------------------------
    # Step 1: Seed default categories
    # ------------------------------------------------------------------
    # We create parent categories first, flush to obtain their database
    # IDs, then create child categories that reference those parent IDs.
    # This two-pass approach is necessary because SQLModel needs the
    # parent's primary key before we can set a child's foreign key.

    all_category_records: List[Category] = []

    # 1a) Create parent categories (top-level, no parent_id)
    parent_category_records: List[Category] = []
    for parent_name, parent_icon, parent_color, _children in _DEFAULT_CATEGORY_TREE:
        parent_category = Category(
            tenant_id=tenant.id,
            name=parent_name,
            kind=CategoryKind.EXPENSE,
            parent_id=None,
            icon=parent_icon,
            color=parent_color,
        )
        parent_category_records.append(parent_category)

    database_session.add_all(parent_category_records)
    # Flush to materialise parent IDs so children can reference them
    await database_session.flush()

    all_category_records.extend(parent_category_records)

    # 1b) Create child categories referencing their parent's ID
    # Build a lookup from parent name to parent record for easy linking
    parent_lookup = {
        parent_category.name: parent_category
        for parent_category in parent_category_records
    }

    child_category_records: List[Category] = []
    for parent_name, _parent_icon, parent_color, children in _DEFAULT_CATEGORY_TREE:
        for child_name, child_icon in children:
            child_category = Category(
                tenant_id=tenant.id,
                name=child_name,
                kind=CategoryKind.EXPENSE,
                parent_id=parent_lookup[parent_name].id,
                icon=child_icon,
                color=parent_color,
            )
            child_category_records.append(child_category)

    if child_category_records:
        database_session.add_all(child_category_records)
        await database_session.flush()

    all_category_records.extend(child_category_records)

    # ------------------------------------------------------------------
    # Step 2: Seed default budget linked to all categories
    # ------------------------------------------------------------------
    # A "Monthly Budget" with a sensible starting amount gives the user
    # something to work with immediately. Linking all 12 categories to
    # the budget means every expense transaction will count toward the
    # budget spent total by default.

    default_budget = Budget(
        tenant_id=tenant.id,
        name="Monthly Budget",
        amount=Decimal("1000.00"),
        currency=Currency.BRL,
    )
    database_session.add(default_budget)
    # Flush to get the budget ID before creating join-table rows
    await database_session.flush()

    # Create BudgetCategory rows linking every seeded category to the budget
    budget_category_records: List[BudgetCategory] = []
    for category_record in all_category_records:
        budget_category_link = BudgetCategory(
            tenant_id=tenant.id,
            budget_id=default_budget.id,
            category_id=category_record.id,
        )
        budget_category_records.append(budget_category_link)

    database_session.add_all(budget_category_records)
    await database_session.flush()

    # ------------------------------------------------------------------
    # Step 3 (optional): Seed default accounts
    # ------------------------------------------------------------------
    # Only during signup do we create starter accounts. When a user creates
    # a second tenant later, they should manually share existing accounts
    # or create new ones.

    if not include_accounts:
        return

    # Derive a display name for the accounts. Prefer the user's name but
    # fall back to the email prefix (part before @) when no name is set.
    display_name = user.name if user.name else user.email.split("@")[0]

    # Create one account per AccountType (CASH, DEBIT, CREDIT) and share
    # each with the new tenant so they appear in the family's account list.
    for account_type in AccountType:
        account_icon, account_color = _ACCOUNT_TYPE_ICON_COLOR[account_type.value]
        account_record = Account(
            user_id=user.id,
            name=f"{display_name} {account_type.value.title()}",
            type=account_type,
            currency=Currency.BRL,
            balance=Decimal("0.00"),
            icon=account_icon,
            color=account_color,
        )
        database_session.add(account_record)
        # Flush to get the account ID before creating the share
        await database_session.flush()

        # Share the account with the tenant so it is visible to all
        # family members on the family's accounts page
        account_share_record = AccountShare(
            account_id=account_record.id,
            tenant_id=tenant.id,
            visibility=ShareVisibility.VISIBLE,
            granted_by=user.id,
        )
        database_session.add(account_share_record)

    # Final flush to persist all account share records
    await database_session.flush()
