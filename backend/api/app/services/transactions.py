# backend/api/app/services/transactions.py
# Transaction-related service helpers relocated from routers/transactions.py.
# These functions interact with the database directly (or are pure), and take a
# plain AsyncSession so they remain framework-agnostic and reusable.

from fastapi import HTTPException, status
from sqlmodel import select
from typing import List, Optional, Any
from uuid import UUID
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Transaction, Account, Category, CategoryKind, TransactionType, AccountShare, User, Tenant


async def authorize_account_for_tenant(
    session: AsyncSession,
    account_id: UUID,
    active_user: User,
    active_tenant: Tenant,
) -> Account:
    """Return the account only if it is writable from the active tenant context.

    Access rule (mirrors imports.py /imports/execute): the active user must own
    the account directly, OR the account must be shared with the active tenant
    via an AccountShare record. Without this guard any authenticated member could
    POST a transaction against an arbitrary account UUID and mutate another user's
    balance (cross-tenant write — Security C-1).

    SINGLE ENFORCEMENT POINT for shared-account write access (QCSD Finding 3):
    This function is the only place in the codebase that decides whether a caller
    may write to a shared account. Any AccountShare row grants full read-write
    delegation — the AccountShare.visibility field (HIDDEN/VISIBLE) controls only
    whether the account balance is displayed in the family view; it is NOT a
    permission scope. There is currently no read-only share. A future SharePermission
    (READ / READ_WRITE) field on AccountShare would be enforced here and only here.
    See docs/north_star.md §9 "Finding 3" for the full invariant and follow-up plan.

    Raises:
        HTTPException 404 when the account does not exist.
        HTTPException 403 when the account is not accessible from the active tenant.
    """
    account = await session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="account not found")

    # Owner access is always permitted.
    if account.user_id == active_user.id:
        return account

    # Otherwise the account must be explicitly shared with the active tenant.
    share_result = await session.execute(
        select(AccountShare).where(
            AccountShare.account_id == account.id,
            AccountShare.tenant_id == active_tenant.id,
        )
    )
    if share_result.scalars().first() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not accessible from the active family",
        )
    return account


def balance_delta(transaction_type: "CategoryKind | TransactionType", amount: Decimal) -> Decimal:
    """Compute the signed balance delta a transaction applies to its account.

    INCOME increases the balance, EXPENSE decreases it. Reversing a transaction's
    effect is simply applying the negation of this delta.
    """
    if transaction_type == CategoryKind.INCOME:
        return amount
    if transaction_type == CategoryKind.EXPENSE:
        return -amount
    # Defensive default: unknown types apply no balance change.
    return Decimal("0")


async def build_transaction_read(session: AsyncSession, tenant_id: UUID, transaction_id: UUID) -> Optional[dict]:
    """Fetch a single transaction joined with account and optional category names.

    Returns a dict shaped to match TransactionRead or None when not found.
    """
    query = (
        select(
            Transaction,
            Account.name.label("account_name"),
            Account.icon.label("account_icon"),
            Account.color.label("account_color"),
            Category.name.label("category_name"),
            # Resolve icon and color from Category for visual display in the UI
            Category.icon.label("category_icon"),
            Category.color.label("category_color"),
            # Resolve the creator's display name for the response payload
            User.name.label("created_by_name"),
        )
        .outerjoin(Account, Account.id == Transaction.account_id)
        .outerjoin(Category, Category.id == Transaction.category_id)
        .outerjoin(User, User.id == Transaction.created_by)
        .where(Transaction.tenant_id == tenant_id, Transaction.id == transaction_id)
    )
    result = await session.execute(query)
    row = result.first()
    if not row:
        return None
    transaction: Transaction = row[0]
    return {
        "id": transaction.id,
        "tenant_id": transaction.tenant_id,
        "account_id": transaction.account_id,
        "account_name": row.account_name,
        "account_icon": row.account_icon,
        "account_color": row.account_color,
        "category_id": transaction.category_id,
        "category_name": row.category_name,
        "category_icon": row.category_icon,
        "category_color": row.category_color,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "transaction_date": transaction.transaction_date,
        "transaction_type": transaction.transaction_type,
        "description": transaction.description,
        "created_by": transaction.created_by,
        # Include the creator's display name resolved from the User join
        "created_by_name": row.created_by_name,
        "created_at": transaction.created_at,
        "updated_at": transaction.updated_at,
        "reconciled": transaction.reconciled,
        "source": transaction.source,
    }


async def rows_to_transaction_reads(rows: List[Any]) -> List[dict]:
    """Convert executed joined rows into list of dicts matching TransactionRead."""
    out: List[dict] = []
    for row in rows:
        transaction: Transaction = row[0]
        out.append({
            "id": transaction.id,
            "tenant_id": transaction.tenant_id,
            "account_id": transaction.account_id,
            "account_name": row.account_name,
            "account_icon": row.account_icon,
            "account_color": row.account_color,
            "category_id": transaction.category_id,
            "category_name": row.category_name,
            "category_icon": row.category_icon,
            "category_color": row.category_color,
            "amount": transaction.amount,
            "currency": transaction.currency,
            "transaction_date": transaction.transaction_date,
            "transaction_type": transaction.transaction_type,
            "description": transaction.description,
            "created_by": transaction.created_by,
            # Include the creator's display name resolved from the User join
            "created_by_name": row.created_by_name,
            "created_at": transaction.created_at,
            "updated_at": transaction.updated_at,
            "reconciled": transaction.reconciled,
            "source": transaction.source,
        })
    return out
