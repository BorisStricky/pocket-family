# backend/api/app/routers/imports.py
# CSV import API: upload → analyze → execute → poll status.
#
# The flow is designed for a multi-step wizard in the frontend:
#   1. POST /imports/upload   — store CSV, return column names + sample rows
#   2. POST /imports/analyze  — parse with user mapping, flag duplicates
#   3. POST /imports/execute  — dispatch background import job
#   4. GET  /imports/jobs/{id} — poll Celery result backend for progress
#
# The client (not the server) holds wizard state between steps.
# file_key and column_mapping are re-sent on each request so no server session is needed.

import asyncio
import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import List
from uuid import uuid4, UUID

from dateutil.parser import parse as dateutil_parse, ParserError
# NOTE (follow-up): starlette 1.x renamed the status constants used below
# (HTTP_422_UNPROCESSABLE_ENTITY -> HTTP_422_UNPROCESSABLE_CONTENT,
# HTTP_413_REQUEST_ENTITY_TOO_LARGE -> HTTP_413_CONTENT_TOO_LARGE) and
# deprecates the old names. We intentionally keep the old names for now
# because FastAPI itself still references them internally; rename once
# FastAPI drops them, to silence the DeprecationWarnings (values unchanged).
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..celery_client import celery_client
from ..db import get_db
from ..deps import get_active_context
from ..models import (
    Account,
    AccountShare,
    ImportJob,
    ImportJobStatus,
    MembershipRole,
    Transaction,
)
from ..schemas import (
    ActiveContext,
    AnalyzeRequest,
    AnalyzeResponse,
    ExecuteRequest,
    ExecuteResponse,
    ImportJobRead,
    ImportUploadResponse,
    JobStatusResponse,
    ParsedRow,
)
from ..storage import get_storage_backend

router = APIRouter(prefix="/imports", tags=["imports"])

# ── Constants ──────────────────────────────────────────────────────────────────

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB — protects the server from huge files
MAX_SAMPLE_ROWS = 5                  # preview rows returned by the upload endpoint

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


# ── Helpers ────────────────────────────────────────────────────────────────────

def _decode_csv_bytes(raw: bytes) -> str:
    """Decode CSV bytes to a string, handling BOM and common encodings."""
    # utf-8-sig strips the BOM that Excel prepends to UTF-8 exports
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


def _parse_csv(text: str, start_row: int) -> tuple[list[str], list[dict]]:
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


def _parse_amount(raw: str, positive_is_expense: bool = False) -> tuple[Decimal, str]:
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


def _normalize_type(raw: str) -> str:
    """Map a raw type column value to 'expense' or 'income'.

    Defaults to 'expense' for unrecognized values since expenses are more common
    in bank statements and an incorrect type is more visible to the user.
    """
    cleaned = raw.strip().lower()
    if cleaned in _INCOME_VALUES:
        return "income"
    return "expense"


def _validate_file_key_ownership(file_key: str, tenant_id: UUID) -> None:
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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=ImportUploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    context: ActiveContext = Depends(get_active_context),
):
    """Store an uploaded CSV and return its column names plus a sample preview.

    Step 1 of the import wizard. The client uses the returned file_key in all
    subsequent requests. The CSV header is always assumed to be row 0 here;
    the analyze step supports a custom start_row for non-standard files.
    """
    # Viewers have read-only access — CSV upload is a write operation
    if context.active_membership.role == MembershipRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot upload imports",
        )

    # Validate file extension before reading to fail fast on obvious errors
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only .csv files are accepted",
        )

    # Validate content type to ensure the file is actually CSV data
    if file.content_type not in ("text/csv", "application/csv", ""):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only CSV content type accepted",
        )

    # Read the file content with a hard cap to prevent memory exhaustion
    csv_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(csv_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 5 MB limit",
        )

    # Build a storage key scoped to the tenant so cross-tenant access is detectable
    file_key = f"{context.active_tenant.id}/{uuid4()}.csv"

    # File I/O is synchronous; run it in a thread pool to avoid blocking the event loop
    storage = get_storage_backend()
    await asyncio.to_thread(storage.write, file_key, csv_bytes)

    # Parse headers and a small sample for the column mapping preview
    text = _decode_csv_bytes(csv_bytes)
    try:
        headers, data_rows = _parse_csv(text, start_row=0)
    except HTTPException:
        raise
    except Exception as parse_error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse CSV: {parse_error}",
        )

    sample_rows = data_rows[:MAX_SAMPLE_ROWS]
    return ImportUploadResponse(
        file_key=file_key,
        filename=filename or None,
        detected_columns=headers,
        sample_rows=sample_rows,
        row_count=len(data_rows),
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_csv(
    request: AnalyzeRequest,
    context: ActiveContext = Depends(get_active_context),
    db: AsyncSession = Depends(get_db),
):
    """Parse the uploaded CSV with the user's column mapping and flag duplicates.

    Step 2 of the import wizard. Reads the stored file, applies the column mapping,
    and compares each row against existing transactions in the same account and
    date range. Rows with matching (date, abs_amount) are flagged as duplicates.
    """
    # Only non-viewer members may run analysis — it queries the tenant's transactions
    if context.active_membership.role == MembershipRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot analyze imports",
        )

    _validate_file_key_ownership(request.file_key, context.active_tenant.id)

    # Read file from storage in a thread to avoid blocking the async event loop
    storage = get_storage_backend()
    try:
        csv_bytes = await asyncio.to_thread(storage.read, request.file_key)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded file not found. Please re-upload the CSV.",
        )

    text = _decode_csv_bytes(csv_bytes)
    try:
        _headers, data_rows = _parse_csv(text, start_row=request.start_row)
    except HTTPException:
        raise
    except Exception as parse_error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse CSV: {parse_error}",
        )

    mapping = request.column_mapping

    # Parse every data row and collect successful rows for dedup lookup
    parsed_rows: list[ParsedRow] = []
    valid_dates: list[date] = []

    for index, row in enumerate(data_rows):
        try:
            # --- Date ---
            raw_date = row.get(mapping.date_column, "").strip()
            if not raw_date:
                raise ValueError("Empty date value")
            try:
                parsed_date = date.fromisoformat(raw_date)
            except ValueError:
                # dateutil handles DD/MM/YYYY, MM-DD-YYYY, and many other formats
                parsed_date = dateutil_parse(raw_date, dayfirst=True).date()

            # --- Amount ---
            raw_amount = row.get(mapping.amount_column, "").strip()
            if not raw_amount:
                raise ValueError("Empty amount value")
            abs_amount, inferred_type = _parse_amount(
                raw_amount,
                positive_is_expense=request.positive_amounts_are_expenses,
            )

            # --- Type ---
            if mapping.type_column:
                raw_type = row.get(mapping.type_column, "").strip()
                transaction_type = _normalize_type(raw_type) if raw_type else inferred_type
            else:
                transaction_type = inferred_type

            # --- Description ---
            description = None
            if mapping.description_column:
                description = row.get(mapping.description_column, "").strip() or None

            parsed_rows.append(ParsedRow(
                row_index=index,
                transaction_date=parsed_date,
                amount=abs_amount,
                transaction_type=transaction_type,
                description=description,
            ))
            valid_dates.append(parsed_date)

        except (ValueError, ParserError, OverflowError) as row_error:
            # Record parse failures but continue processing remaining rows
            parsed_rows.append(ParsedRow(
                row_index=index,
                parse_error=str(row_error),
            ))

    # Deduplicate against existing transactions in the relevant date range.
    # Match criteria: same account + same date + same absolute amount.
    if valid_dates:
        min_date = min(valid_dates)
        max_date = max(valid_dates)

        existing_result = await db.execute(
            select(Transaction.id, Transaction.transaction_date, Transaction.amount)
            .where(
                Transaction.tenant_id == context.active_tenant.id,
                Transaction.account_id == request.account_id,
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

    duplicate_count = sum(1 for row in parsed_rows if row.is_duplicate)
    parse_error_count = sum(1 for row in parsed_rows if row.parse_error is not None)

    return AnalyzeResponse(
        rows=parsed_rows,
        duplicate_count=duplicate_count,
        parse_error_count=parse_error_count,
        date_range_start=min(valid_dates) if valid_dates else None,
        date_range_end=max(valid_dates) if valid_dates else None,
    )


@router.post("/execute", response_model=ExecuteResponse)
async def execute_import(
    request: ExecuteRequest,
    context: ActiveContext = Depends(get_active_context),
    db: AsyncSession = Depends(get_db),
):
    """Dispatch the confirmed rows to the import worker as a background job.

    Step 3 of the import wizard. Returns a job_id immediately; the client
    polls /imports/jobs/{job_id} to track progress.
    """
    # Only non-viewer members may import transactions
    if context.active_membership.role == MembershipRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot import transactions",
        )

    if not request.rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No rows to import",
        )

    _validate_file_key_ownership(request.file_key, context.active_tenant.id)

    # Verify the target account is writable from the active tenant context.
    # Access rule: the active user must own the account directly, OR the account
    # must be shared with the active tenant via an AccountShare record.
    account_result = await db.execute(
        select(Account).where(Account.id == request.account_id)
    )
    account = account_result.scalars().first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    if account.user_id != context.active_user.id:
        share_result = await db.execute(
            select(AccountShare).where(
                AccountShare.account_id == account.id,
                AccountShare.tenant_id == context.active_tenant.id,
            )
        )
        if share_result.scalars().first() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is not accessible from the active family",
            )

    # Persist a history row before dispatch so the user can see this import
    # even if the worker crashes before recording its own state. The worker
    # updates this same row (status, imported_rows, completed_at, error).
    import_job = ImportJob(
        tenant_id=context.active_tenant.id,
        account_id=request.account_id,
        created_by=context.active_user.id,
        file_key=request.file_key,
        filename=request.filename,
        total_rows=len(request.rows),
        imported_rows=0,
        status=ImportJobStatus.PENDING,
    )
    db.add(import_job)
    await db.commit()
    await db.refresh(import_job)

    # Serialize rows to plain dicts for JSON-safe Celery task payload
    serialized_rows = [
        {
            "row_index": row.row_index,
            "transaction_date": row.transaction_date.isoformat(),
            "amount": str(row.amount),
            "transaction_type": row.transaction_type,
            "description": row.description,
            "category_id": str(row.category_id) if row.category_id else None,
        }
        for row in request.rows
    ]

    # Dispatch the background task — the worker picks it up from the queue.
    # import_job_id lets the worker update the ImportJob row directly.
    task = celery_client.send_task(
        "import_service.execute_import",
        kwargs={
            "payload": {
                "import_job_id": str(import_job.id),
                "tenant_id": str(context.active_tenant.id),
                "account_id": str(request.account_id),
                "created_by": str(context.active_user.id),
                "currency": request.currency.value if request.currency else "BRL",
                "file_key": request.file_key,
                "rows": serialized_rows,
            }
        },
    )

    # Store the Celery task id back on the ImportJob for traceability with
    # the existing /imports/jobs/{job_id} polling endpoint.
    import_job.celery_task_id = task.id
    await db.commit()

    return ExecuteResponse(job_id=task.id)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    context: ActiveContext = Depends(get_active_context),
    db: AsyncSession = Depends(get_db),
):
    """Poll the background import job for its current status and progress.

    Step 4 of the import wizard (polled repeatedly until done or failed).
    The frontend should poll every 2 seconds and stop when status is 'done' or 'failed'.
    Reads status from the ImportJob table directly — no Celery result backend required.
    """
    if context.active_membership.role == MembershipRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot access import jobs",
        )

    # Fetch the full ImportJob row and enforce tenant ownership in one query.
    # The celery_task_id is what the frontend received from /execute and uses
    # as the polling key; mapping back through the DB ensures cross-tenant isolation.
    job_result = await db.execute(
        select(ImportJob).where(
            ImportJob.celery_task_id == job_id,
            ImportJob.tenant_id == context.active_tenant.id,
        )
    )
    import_job = job_result.scalars().first()
    if import_job is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this import job",
        )

    status_map = {
        ImportJobStatus.PENDING: "pending",
        ImportJobStatus.STARTED: "started",
        ImportJobStatus.DONE: "done",
        ImportJobStatus.FAILED: "failed",
    }
    job_status = status_map.get(import_job.status, "pending")

    return JobStatusResponse(
        job_id=job_id,
        status=job_status,
        imported=import_job.imported_rows or None,
        total=import_job.total_rows,
        error=import_job.error_message,
    )


@router.get("/jobs", response_model=List[ImportJobRead])
async def list_import_jobs(
    context: ActiveContext = Depends(get_active_context),
    db: AsyncSession = Depends(get_db),
):
    """List all CSV import jobs for the active tenant, newest first.

    Used by the import history page in the UI. The account name is joined
    in so the grid can render the column without N+1 follow-up requests.
    """
    if context.active_membership.role == MembershipRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot access import history",
        )

    result = await db.execute(
        select(ImportJob, Account.name)
        .join(Account, Account.id == ImportJob.account_id, isouter=True)
        .where(ImportJob.tenant_id == context.active_tenant.id)
        .order_by(ImportJob.created_at.desc())
    )
    rows = result.all()

    return [
        ImportJobRead(
            id=import_job.id,
            account_id=import_job.account_id,
            account_name=account_name,
            filename=import_job.filename,
            total_rows=import_job.total_rows,
            imported_rows=import_job.imported_rows,
            status=import_job.status,
            error_message=import_job.error_message,
            created_at=import_job.created_at,
            completed_at=import_job.completed_at,
        )
        for import_job, account_name in rows
    ]
