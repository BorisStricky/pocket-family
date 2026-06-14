# backend/api/app/services/imports.py
# CSV import service helpers relocated from routers/imports.py.
#
# These are mostly pure/sync parsing utilities (decode, parse, amount/type
# normalization) plus a sync ownership guard. They do not interact with the
# database, so they take no session — only the file-key guard takes a tenant_id.

import csv
import io
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import List, Optional, Tuple
from uuid import UUID

# NOTE (follow-up): starlette 1.x renamed the status constants used below
# (HTTP_422_UNPROCESSABLE_ENTITY -> HTTP_422_UNPROCESSABLE_CONTENT,
# HTTP_413_REQUEST_ENTITY_TOO_LARGE -> HTTP_413_CONTENT_TOO_LARGE) and
# deprecates the old names. We intentionally keep the old names for now
# because FastAPI itself still references them internally; rename once
# FastAPI drops them, to silence the DeprecationWarnings (values unchanged).
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    Account,
    AccountShare,
    ImportJob,
    ImportJobStatus,
    Transaction,
)

# Type normalization — maps common bank statement type column values to
# "expense" or "income". Covers English and Portuguese variations.
_EXPENSE_VALUES = frozenset({
    "debit", "d", "db", "deb", "expense", "out", "withdrawal",
    "saída", "saida", "débito", "debito", "gasto", "-",
})
_INCOME_VALUES = frozenset({
    "credit", "c", "cr", "cred", "income", "in", "deposit",
    "entrada", "crédito", "credito", "receita", "+",
})


def decode_csv_bytes(raw: bytes) -> str:
    """Decode CSV bytes to a string, handling BOM and common encodings."""
    # utf-8-sig strips the BOM that Excel prepends to UTF-8 exports
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


def parse_csv(text: str, start_row: int) -> tuple[list[str], list[dict]]:
    """Return (header_columns, data_rows) using start_row as the header row index."""
    all_lines = list(csv.reader(io.StringIO(text)))
    if start_row >= len(all_lines):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"start_row {start_row} exceeds number of rows in file",
        )
    headers = [col.strip() for col in all_lines[start_row]]
    # Convert remaining lines to dicts using the detected headers
    data_rows = []
    for line in all_lines[start_row + 1:]:
        if not any(cell.strip() for cell in line):
            continue  # skip blank lines
        # Zip truncates to the shorter sequence; extra cells in the row are dropped
        data_rows.append(dict(zip(headers, [cell.strip() for cell in line])))
    return headers, data_rows


def parse_amount(raw: str, positive_is_expense: bool = False) -> tuple[Decimal, str]:
    """Parse an amount string into (absolute_value, inferred_transaction_type).

    Handles:
    - International separators: "1,234.56" and "1.234,56"
    - Currency symbols: R$, $, €, £
    - Negative sign and accounting parentheses: "-150" or "(150)"
    - Plain positive/negative numbers

    Sign-to-type inference depends on the statement convention:
    - Default bank/debit convention (``positive_is_expense=False``):
      negative → expense, positive → income.
    - Credit-card convention (``positive_is_expense=True``): the sign is flipped,
      because card purchases (expenses) are reported as positive amounts and
      payments to the card (income, from the account's perspective) as negative.
    """
    raw = raw.strip()

    # Accounting notation: (150.00) means a debit/expense
    is_accounting_negative = raw.startswith("(") and raw.endswith(")")
    if is_accounting_negative:
        raw = raw[1:-1]

    # Strip currency symbols, spaces, and other non-numeric characters except . - ,
    raw = re.sub(r"[^\d\-.,]", "", raw)

    # Determine sign from leading minus
    is_negative = raw.startswith("-") or is_accounting_negative
    raw = raw.lstrip("-")

    # European number format: "1.234,56" → "1234.56"
    # Also matches sub-thousand European values like "100,50" where no thousands group is present.
    if re.search(r"\d{1,3}(\.\d{3})+,\d{1,2}$", raw) or re.fullmatch(r"\d{1,3},\d{1,2}", raw):
        raw = raw.replace(".", "").replace(",", ".")
    else:
        # Standard English format: remove thousand-separator commas
        raw = raw.replace(",", "")

    try:
        value = Decimal(raw)
    except InvalidOperation:
        raise ValueError(f"Cannot parse amount: {raw!r}")

    # Map the sign to a transaction type. For credit-card statements the
    # convention is inverted, so a positive amount is an expense.
    if positive_is_expense:
        transaction_type = "income" if is_negative else "expense"
    else:
        transaction_type = "expense" if is_negative else "income"
    return abs(value), transaction_type


def normalize_type(raw: str) -> str:
    """Map a raw type column value to 'expense' or 'income'.

    Defaults to 'expense' for unrecognized values since expenses are more common
    in bank statements and an incorrect type is more visible to the user.
    """
    cleaned = raw.strip().lower()
    if cleaned in _INCOME_VALUES:
        return "income"
    return "expense"


def validate_file_key_ownership(file_key: str, tenant_id: UUID) -> None:
    """Ensure file_key is prefixed with the requesting tenant's ID.

    This prevents a user from referencing another tenant's uploaded file
    by guessing the storage key.
    """
    expected_prefix = f"{tenant_id}/"
    if not file_key.startswith(expected_prefix):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this file",
        )


# ---------------------------------------------------------------------------
# DB-interacting helpers relocated from routers/imports.py.
#
# These take a plain AsyncSession as their first parameter and do all the
# query / staging work for the import wizard. They never call flush/commit/
# rollback — the router owns the transaction boundary (see backend/CLAUDE.md
# "Transaction ownership"). They raise HTTPException for authorization /
# not-found cases so handlers stay thin.
# ---------------------------------------------------------------------------


async def flag_duplicate_rows(
    session: AsyncSession,
    tenant_id: UUID,
    account_id: UUID,
    parsed_rows: List,
    valid_dates: List[date],
) -> None:
    """Flag rows that duplicate existing transactions, in place.

    Deduplicates the already-parsed wizard rows against existing transactions in
    the relevant account and date range. Match criteria: same account + same date
    + same absolute amount. Rows that match get ``is_duplicate=True`` and their
    ``matching_transaction_id`` set. Tenant isolation is preserved by filtering on
    ``tenant_id`` (never dropped).

    No-op when there are no successfully parsed dates to bound the lookup.
    """
    if not valid_dates:
        return

    min_date = min(valid_dates)
    max_date = max(valid_dates)

    existing_result = await session.execute(
        select(Transaction.id, Transaction.transaction_date, Transaction.amount)
        .where(
            Transaction.tenant_id == tenant_id,
            Transaction.account_id == account_id,
            Transaction.transaction_date >= min_date,
            Transaction.transaction_date <= max_date,
        )
    )
    existing_transactions = existing_result.all()

    # Build a lookup: (date, abs_amount) → transaction_id
    existing_dedup: dict[tuple, UUID] = {
        (row.transaction_date, abs(row.amount)): row.id
        for row in existing_transactions
    }

    # Flag duplicates in the parsed rows
    for parsed_row in parsed_rows:
        if parsed_row.transaction_date and parsed_row.amount is not None:
            dedup_key = (parsed_row.transaction_date, parsed_row.amount)
            if dedup_key in existing_dedup:
                parsed_row.is_duplicate = True
                parsed_row.matching_transaction_id = existing_dedup[dedup_key]


async def authorize_account_for_import(
    session: AsyncSession,
    account_id: UUID,
    user_id: UUID,
    tenant_id: UUID,
) -> Account:
    """Load the target account and assert it is writable from the active context.

    Access rule: the active user must own the account directly, OR the account
    must be shared with the active tenant via an AccountShare record. Returns the
    validated account.

    Raises:
        HTTPException 404 when the account does not exist.
        HTTPException 403 when the account is not accessible from the active family.
    """
    account_result = await session.execute(
        select(Account).where(Account.id == account_id)
    )
    account = account_result.scalars().first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    if account.user_id != user_id:
        share_result = await session.execute(
            select(AccountShare).where(
                AccountShare.account_id == account.id,
                AccountShare.tenant_id == tenant_id,
            )
        )
        if share_result.scalars().first() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is not accessible from the active family",
            )

    return account


def create_import_job(
    session: AsyncSession,
    tenant_id: UUID,
    account_id: UUID,
    created_by: UUID,
    file_key: str,
    filename: Optional[str],
    total_rows: int,
) -> ImportJob:
    """Stage a PENDING ImportJob history row (build + add only — no commit).

    Pure staging: the handler owns the unit of work (commit/refresh). Persisting
    this row before dispatch lets the user see the import even if the worker
    crashes before recording its own state; the worker updates this same row.
    """
    import_job = ImportJob(
        tenant_id=tenant_id,
        account_id=account_id,
        created_by=created_by,
        file_key=file_key,
        filename=filename,
        total_rows=total_rows,
        imported_rows=0,
        status=ImportJobStatus.PENDING,
    )
    session.add(import_job)
    return import_job


async def get_import_job_or_403(
    session: AsyncSession,
    celery_task_id: str,
    tenant_id: UUID,
) -> ImportJob:
    """Load an ImportJob by its Celery task id, enforcing tenant ownership.

    The celery_task_id is what the frontend received from /execute and uses as
    the polling key; mapping back through the DB with the tenant filter ensures
    cross-tenant isolation. Raises 403 (not 404) so the endpoint does not reveal
    whether a job id exists in another tenant.
    """
    job_result = await session.execute(
        select(ImportJob).where(
            ImportJob.celery_task_id == celery_task_id,
            ImportJob.tenant_id == tenant_id,
        )
    )
    import_job = job_result.scalars().first()
    if import_job is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this import job",
        )
    return import_job


async def list_import_jobs_for_tenant(
    session: AsyncSession,
    tenant_id: UUID,
) -> List[Tuple[ImportJob, Optional[str]]]:
    """Return (ImportJob, account_name) pairs for the tenant, newest first.

    The account name is left-joined so the history grid can render the column
    without N+1 follow-up requests.
    """
    result = await session.execute(
        select(ImportJob, Account.name)
        .join(Account, Account.id == ImportJob.account_id, isouter=True)
        .where(ImportJob.tenant_id == tenant_id)
        .order_by(ImportJob.created_at.desc())
    )
    return result.all()
