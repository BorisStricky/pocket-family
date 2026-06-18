# backend/api/app/services/imports.py
# CSV import service helpers relocated from routers/imports.py.
#
# These are mostly pure/sync parsing utilities (decode, parse, amount/type
# normalization) plus a sync ownership guard. They do not interact with the
# database, so they take no session — only the file-key guard takes a tenant_id.

import csv
import io
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import List, Optional, Tuple
from uuid import UUID

# starlette 1.x renamed HTTP_422_UNPROCESSABLE_ENTITY -> HTTP_422_UNPROCESSABLE_CONTENT
# (value unchanged, 422); the old name emits StarletteDeprecationWarning. New name used below.
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
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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


# How many days *before* an imported row's date we still look for a same-amount
# transaction when detecting possible (settlement-lag) duplicates. Credit-card
# purchases often post to the statement export 1–2 days after they were first
# recorded, so the same charge can appear on a slightly later date.
POSSIBLE_DUPLICATE_LOOKBACK_DAYS = 2


async def flag_duplicate_rows(
    session: AsyncSession,
    tenant_id: UUID,
    account_id: UUID,
    parsed_rows: List,
    valid_dates: List[date],
) -> None:
    """Flag rows that duplicate existing transactions, in place.

    Deduplicates the already-parsed wizard rows against existing transactions in
    the relevant account and date range. Two tiers of matching, both scoped to the
    same account + same absolute amount, with tenant isolation always enforced via
    the ``tenant_id`` filter:

    1. **Exact duplicate** — an existing transaction on the *same date*. The row gets
       ``is_duplicate=True`` and ``matching_transaction_id`` set; the UI pre-skips it.
    2. **Possible duplicate** — no same-date match, but a transaction with the same
       amount was logged 1–2 days *earlier* (see ``POSSIBLE_DUPLICATE_LOOKBACK_DAYS``).
       This is the credit-card settlement-lag case. The row gets
       ``possible_duplicate=True`` and the candidate transaction(s) recorded on
       ``possible_duplicate_matches``; the UI flags it but does **not** auto-exclude it.

    An exact match always wins: a row flagged ``is_duplicate`` is never also flagged
    ``possible_duplicate``.

    No-op when there are no successfully parsed dates to bound the lookup.
    """
    # Imported locally to keep this DB helper's import surface small; PossibleDuplicateMatch
    # lives in schemas (the API contract), which is fine to depend on from a service.
    from ..schemas import PossibleDuplicateMatch

    if not valid_dates:
        return

    # Widen the lower bound by the look-back window so a settlement-lag candidate
    # that predates every imported row is still fetched. The upper bound stays at
    # the latest imported date — possible matches are always *earlier* than a row.
    min_date = min(valid_dates) - timedelta(days=POSSIBLE_DUPLICATE_LOOKBACK_DAYS)
    max_date = max(valid_dates)

    existing_result = await session.execute(
        select(
            Transaction.id,
            Transaction.transaction_date,
            Transaction.amount,
            Transaction.description,
        )
        .where(
            Transaction.tenant_id == tenant_id,
            Transaction.account_id == account_id,
            Transaction.transaction_date >= min_date,
            Transaction.transaction_date <= max_date,
        )
    )
    existing_transactions = existing_result.all()

    # Exact-match lookup: (date, abs_amount) → transaction_id.
    existing_dedup: dict[tuple, UUID] = {
        (row.transaction_date, abs(row.amount)): row.id
        for row in existing_transactions
    }
    # Group existing transactions by absolute amount so the possible-duplicate scan
    # only has to inspect candidates that share the row's amount.
    existing_by_amount: dict[Decimal, list] = defaultdict(list)
    for row in existing_transactions:
        existing_by_amount[abs(row.amount)].append(row)

    # Flag duplicates in the parsed rows
    for parsed_row in parsed_rows:
        if not (parsed_row.transaction_date and parsed_row.amount is not None):
            continue

        dedup_key = (parsed_row.transaction_date, parsed_row.amount)
        if dedup_key in existing_dedup:
            # Tier 1: exact same-date match wins outright.
            parsed_row.is_duplicate = True
            parsed_row.matching_transaction_id = existing_dedup[dedup_key]
            continue

        # Tier 2: same amount logged 1..LOOKBACK days before this row's date.
        candidates = [
            existing
            for existing in existing_by_amount.get(parsed_row.amount, [])
            if 1 <= (parsed_row.transaction_date - existing.transaction_date).days
            <= POSSIBLE_DUPLICATE_LOOKBACK_DAYS
        ]
        if candidates:
            parsed_row.possible_duplicate = True
            parsed_row.possible_duplicate_matches = [
                PossibleDuplicateMatch(
                    transaction_id=existing.id,
                    transaction_date=existing.transaction_date,
                    amount=abs(existing.amount),
                    description=existing.description,
                )
                # Show the most recent candidate first — it is the likeliest match.
                for existing in sorted(
                    candidates, key=lambda existing: existing.transaction_date, reverse=True
                )
            ]


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


def mark_import_job_failed(
    session: AsyncSession,
    import_job: ImportJob,
    error_message: str,
) -> ImportJob:
    """Flip an already-persisted ImportJob to FAILED (build/mutate only — no commit).

    Used when dispatch to the broker fails *after* the PENDING row was committed: the
    import would otherwise be stranded in PENDING forever and the frontend would poll
    a job that no worker will ever pick up. Flipping it to a terminal FAILED gives the
    user an honest "this import didn't start" state in the history grid. The handler
    owns the commit boundary (see backend/CLAUDE.md "Transaction ownership").
    """
    import_job.status = ImportJobStatus.FAILED
    # Truncate to match the worker's _mark_import_job behavior so an enormous broker
    # error string can't blow up the row width or the history grid.
    import_job.error_message = error_message[:1000]
    import_job.updated_at = datetime.utcnow()
    import_job.completed_at = datetime.utcnow()
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
