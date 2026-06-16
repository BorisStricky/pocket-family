# backend/api/app/services/transactions.py
# Transaction-related service helpers relocated from routers/transactions.py.
# These functions interact with the database directly (or are pure), and take a
# plain AsyncSession so they remain framework-agnostic and reusable.

from fastapi import HTTPException, status
from sqlmodel import select, delete
from typing import List, Optional, Any
from uuid import UUID
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    Transaction,
    Account,
    Category,
    CategoryKind,
    TransactionType,
    TransactionSource,
    Membership,
    MembershipStatus,
    AccountShare,
    User,
    Tenant,
)
from ..schemas import TransactionCreate, TransactionUpdate


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


# ---------------------------------------------------------------------------
# Fetch + tenant-scoped lookups
#
# These centralize the "load this tenant's transaction or signal not-found"
# blocks that previously lived inline in the update/delete handlers. They keep
# the tenant_id filter (multi-tenant isolation #1) attached to every fetch so a
# handler can never accidentally drop it.
# ---------------------------------------------------------------------------

async def get_transaction_for_tenant(
    session: AsyncSession, tenant_id: UUID, transaction_id: UUID
) -> Optional[Transaction]:
    """Load a transaction by id scoped to a tenant; None when absent.

    Tenant membership is already verified by the active context, so the
    tenant_id filter here is the isolation boundary: a caller can only load a
    transaction that belongs to their active tenant.
    """
    transaction_query = select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.tenant_id == tenant_id,
    )
    transaction_query_result = await session.execute(transaction_query)
    return transaction_query_result.scalars().first()


# ---------------------------------------------------------------------------
# Read queries (list)
# ---------------------------------------------------------------------------

async def list_transactions(
    session: AsyncSession,
    *,
    active_user: User,
    active_tenant: Tenant,
    scope: str,
    start: Optional[date],
    end: Optional[date],
    category_id: Optional[UUID],
    account_id: Optional[UUID],
    search: Optional[str],
    limit: int,
    offset: int,
) -> List[dict]:
    """Query transactions for a tenant (or globally across the user's tenants).

    Builds the joined query (account/category/creator enrichment), applies the
    scope-based tenant filter, optional filters, newest-first ordering, and the
    bounded offset/limit window, then maps rows through rows_to_transaction_reads.

    Ordering and the page-size cap are enforced by the caller's bounded `limit`;
    ORDER BY transaction_date DESC runs before LIMIT so the newest rows survive
    truncation (Performance P-1).
    """
    # Build a joined query to get account/category name, icon, color and created_by_name
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
            # Resolve the creator's display name so the frontend can show who created each transaction
            User.name.label("created_by_name"),
        )
        .outerjoin(Account, Account.id == Transaction.account_id)
        .outerjoin(Category, Category.id == Transaction.category_id)
        .outerjoin(User, User.id == Transaction.created_by)
    )

    # Apply tenant filtering based on scope
    if scope == "global":
        # Query transactions across all tenants where user is an active member
        # First get all tenant_ids for this user
        memberships_query = select(Membership.tenant_id).where(
            Membership.user_id == active_user.id,
            Membership.status == MembershipStatus.ACTIVE
        )
        memberships_result = await session.execute(memberships_query)
        user_tenant_ids = [row[0] for row in memberships_result.all()]

        # Filter transactions by user's tenant IDs
        if user_tenant_ids:
            query = query.where(Transaction.tenant_id.in_(user_tenant_ids))
        else:
            # User has no active memberships, return empty list
            return []
    else:
        # Default: filter by active tenant only
        query = query.where(Transaction.tenant_id == active_tenant.id)

    # Apply optional filters
    if start:
        query = query.where(Transaction.transaction_date >= start)
    if end:
        query = query.where(Transaction.transaction_date <= end)
    if category_id:
        query = query.where(Transaction.category_id == category_id)
    if account_id:
        query = query.where(Transaction.account_id == account_id)
    if search:
        # Apply case-insensitive full-text search against description field
        # using SQL ILIKE pattern matching to filter at database level for efficiency
        search_pattern = f"%{search}%"
        query = query.where(Transaction.description.ilike(search_pattern))

    # Most-recent first, then bound the result window. ORDER BY before LIMIT keeps
    # the newest transactions visible even when the result set is truncated.
    query = query.order_by(Transaction.transaction_date.desc())
    query = query.offset(offset).limit(limit)

    result = await session.execute(query)
    rows = result.all()
    return await rows_to_transaction_reads(rows)


# ---------------------------------------------------------------------------
# Persistence (stage records + balance application — no flush/commit).
#
# These stage work on the request-scoped session; the calling handler owns the
# single commit so the transaction row mutation AND the account balance change
# land atomically. See backend/CLAUDE.md "Transaction ownership".
# ---------------------------------------------------------------------------

async def apply_balance_delta(
    session: AsyncSession, account_id: Optional[UUID], delta: Decimal
) -> None:
    """Stage a balance change on an account (load + mutate + add — no commit).

    account_id may be None (e.g. an account that was SET NULL on delete) in which
    case there is nothing to apply. The account row is loaded and the delta added
    in place, then staged. The arithmetic itself is unchanged from the inline
    handler logic — only relocated — so Decimal-precise reversal stays exact.
    """
    if account_id is None:
        return
    account = await session.get(Account, account_id)
    if account is not None:
        account.balance += delta
        session.add(account)


async def create_transaction(
    session: AsyncSession,
    *,
    active_user: User,
    active_tenant: Tenant,
    account: Account,
    payload: TransactionCreate,
) -> Transaction:
    """Stage a new transaction and apply its balance effect (no commit).

    Builds the transaction row, stages it, then applies the signed balance delta
    to the (already authorized) owning account. Both the insert and the balance
    mutation are staged on the same session so the handler's single commit makes
    them atomic. INCOME increases the balance, EXPENSE decreases it.
    """
    # Create transaction record
    transaction_record = Transaction(
        tenant_id=active_tenant.id,
        account_id=payload.account_id,
        category_id=payload.category_id,
        amount=payload.amount,
        currency=payload.currency,
        transaction_date=payload.transaction_date,
        transaction_type=payload.transaction_type,
        description=payload.description,
        created_by=active_user.id,
        source=payload.source or TransactionSource.MANUAL,
    )
    session.add(transaction_record)

    # Update account balance based on transaction type
    # INCOME increases balance, EXPENSE decreases balance
    account.balance += balance_delta(payload.transaction_type, payload.amount)

    session.add(account)
    return transaction_record


async def apply_transaction_update(
    session: AsyncSession,
    *,
    transaction_record: Transaction,
    payload: TransactionUpdate,
    active_user: User,
    active_tenant: Tenant,
) -> Transaction:
    """Apply a partial update to a transaction and re-balance affected accounts.

    Captures the transaction's CURRENT effect on its account before applying any
    changes, applies the field updates, then re-balances: editing amount/type/
    account must reverse the old effect and apply the new one, otherwise the
    account balance drifts permanently (money-correctness defect — Blocker 2).

    A reassigned account_id is validated through authorize_account_for_tenant so
    a transaction can only move to an account writable from the active tenant
    (never an arbitrary UUID). All work is staged on the session; the handler
    commits. The balance arithmetic is relocated unchanged.
    """
    # Capture the transaction's CURRENT effect on its account before applying any
    # changes. Editing amount/type/account must reverse the old effect and apply
    # the new one, otherwise the account balance drifts permanently (money-
    # correctness defect — Blocker 2).
    previous_account_id = transaction_record.account_id
    previous_delta = balance_delta(transaction_record.transaction_type, transaction_record.amount)

    # Validate account_id update if provided. Use the shared authorization guard
    # so a transaction can only be reassigned to an account that is writable from
    # the active tenant (owner or AccountShare) — never an arbitrary UUID.
    if payload.account_id is not None:
        await authorize_account_for_tenant(session, payload.account_id, active_user, active_tenant)
        transaction_record.account_id = payload.account_id

    if payload.category_id is not None:
        transaction_record.category_id = payload.category_id
    if payload.amount is not None:
        transaction_record.amount = payload.amount
    if payload.currency is not None:
        transaction_record.currency = payload.currency
    if payload.transaction_date is not None:
        transaction_record.transaction_date = payload.transaction_date
    if payload.transaction_type is not None:
        transaction_record.transaction_type = payload.transaction_type
    if payload.description is not None:
        transaction_record.description = payload.description
    if payload.reconciled is not None:
        transaction_record.reconciled = payload.reconciled

    # Re-balance the affected account(s) in this same DB transaction.
    new_account_id = transaction_record.account_id
    new_delta = balance_delta(transaction_record.transaction_type, transaction_record.amount)

    if previous_account_id == new_account_id:
        # Same account: apply only the net change so we don't double-count.
        if new_account_id is not None and new_delta != previous_delta:
            account = await session.get(Account, new_account_id)
            if account is not None:
                account.balance += new_delta - previous_delta
                session.add(account)
    else:
        # Account changed: fully reverse from the old account, fully apply to the new.
        if previous_account_id is not None:
            previous_account = await session.get(Account, previous_account_id)
            if previous_account is not None:
                previous_account.balance -= previous_delta
                session.add(previous_account)
        if new_account_id is not None:
            new_account = await session.get(Account, new_account_id)
            if new_account is not None:
                new_account.balance += new_delta
                session.add(new_account)

    session.add(transaction_record)
    return transaction_record


async def delete_transaction(
    session: AsyncSession, transaction_record: Transaction
) -> None:
    """Reverse a transaction's balance effect and stage it for deletion (no commit).

    Reverses this transaction's effect on its account before deleting, so the
    account balance stays correct (Blocker 2). account_id may be None when the
    owning account was already deleted (SET NULL) — nothing to reverse then. The
    reversal and the row deletion are staged on the same session for the handler's
    single atomic commit. Balance arithmetic relocated unchanged.
    """
    # Reverse this transaction's effect on its account before deleting, so the
    # account balance stays correct (Blocker 2). account_id may be None when the
    # owning account was already deleted (SET NULL) — nothing to reverse then.
    if transaction_record.account_id is not None:
        account = await session.get(Account, transaction_record.account_id)
        if account is not None:
            account.balance -= balance_delta(
                transaction_record.transaction_type, transaction_record.amount
            )
            session.add(account)

    await session.execute(delete(Transaction).where(Transaction.id == transaction_record.id))
