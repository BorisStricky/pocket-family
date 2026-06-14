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
from datetime import date
from typing import List
from uuid import uuid4

from dateutil.parser import parse as dateutil_parse, ParserError
# NOTE (follow-up): starlette 1.x renamed the status constants used below
# (HTTP_422_UNPROCESSABLE_ENTITY -> HTTP_422_UNPROCESSABLE_CONTENT,
# HTTP_413_REQUEST_ENTITY_TOO_LARGE -> HTTP_413_CONTENT_TOO_LARGE) and
# deprecates the old names. We intentionally keep the old names for now
# because FastAPI itself still references them internally; rename once
# FastAPI drops them, to silence the DeprecationWarnings (values unchanged).
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..celery_client import celery_client
from ..db import get_db
from ..deps import get_active_context, require_writer
from ..models import ImportJobStatus
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
from ..services import imports as import_service

router = APIRouter(prefix="/imports", tags=["imports"])

# ── Constants ──────────────────────────────────────────────────────────────────

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB — protects the server from huge files
MAX_SAMPLE_ROWS = 5                  # preview rows returned by the upload endpoint


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=ImportUploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    context: ActiveContext = Depends(require_writer),
):
    """Store an uploaded CSV and return its column names plus a sample preview.

    Step 1 of the import wizard. The client uses the returned file_key in all
    subsequent requests. The CSV header is always assumed to be row 0 here;
    the analyze step supports a custom start_row for non-standard files.

    Viewers are blocked by the require_writer dependency (upload is a write op).
    """
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
    text = import_service.decode_csv_bytes(csv_bytes)
    try:
        headers, data_rows = import_service.parse_csv(text, start_row=0)
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
    context: ActiveContext = Depends(require_writer),
    db: AsyncSession = Depends(get_db),
):
    """Parse the uploaded CSV with the user's column mapping and flag duplicates.

    Step 2 of the import wizard. Reads the stored file, applies the column mapping,
    and compares each row against existing transactions in the same account and
    date range. Rows with matching (date, abs_amount) are flagged as duplicates.

    Viewers are blocked by the require_writer dependency.
    """
    import_service.validate_file_key_ownership(request.file_key, context.active_tenant.id)

    # Read file from storage in a thread to avoid blocking the async event loop
    storage = get_storage_backend()
    try:
        csv_bytes = await asyncio.to_thread(storage.read, request.file_key)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded file not found. Please re-upload the CSV.",
        )

    text = import_service.decode_csv_bytes(csv_bytes)
    try:
        _headers, data_rows = import_service.parse_csv(text, start_row=request.start_row)
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
            abs_amount, inferred_type = import_service.parse_amount(
                raw_amount,
                positive_is_expense=request.positive_amounts_are_expenses,
            )

            # --- Type ---
            if mapping.type_column:
                raw_type = row.get(mapping.type_column, "").strip()
                transaction_type = import_service.normalize_type(raw_type) if raw_type else inferred_type
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
    # Match criteria: same account + same date + same absolute amount. The query
    # and flagging live in the service; the handler just delegates.
    await import_service.flag_duplicate_rows(
        db,
        context.active_tenant.id,
        request.account_id,
        parsed_rows,
        valid_dates,
    )

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
    context: ActiveContext = Depends(require_writer),
    db: AsyncSession = Depends(get_db),
):
    """Dispatch the confirmed rows to the import worker as a background job.

    Step 3 of the import wizard. Returns a job_id immediately; the client
    polls /imports/jobs/{job_id} to track progress.

    Viewers are blocked by the require_writer dependency.
    """
    if not request.rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No rows to import",
        )

    import_service.validate_file_key_ownership(request.file_key, context.active_tenant.id)

    # Verify the target account is writable from the active tenant context
    # (ownership or an AccountShare into the active tenant). The query and the
    # 404/403 rules live in the service.
    await import_service.authorize_account_for_import(
        db,
        request.account_id,
        context.active_user.id,
        context.active_tenant.id,
    )

    # Persist a history row before dispatch so the user can see this import
    # even if the worker crashes before recording its own state. The worker
    # updates this same row (status, imported_rows, completed_at, error).
    # Service stages the row; the handler owns the commit/refresh boundary.
    import_job = import_service.create_import_job(
        db,
        tenant_id=context.active_tenant.id,
        account_id=request.account_id,
        created_by=context.active_user.id,
        file_key=request.file_key,
        filename=request.filename,
        total_rows=len(request.rows),
    )
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
    context: ActiveContext = Depends(require_writer),
    db: AsyncSession = Depends(get_db),
):
    """Poll the background import job for its current status and progress.

    Step 4 of the import wizard (polled repeatedly until done or failed).
    The frontend should poll every 2 seconds and stop when status is 'done' or 'failed'.
    Reads status from the ImportJob table directly — no Celery result backend required.

    Viewers are blocked by the require_writer dependency.
    """
    # Fetch the full ImportJob row and enforce tenant ownership. The lookup and
    # the 403-on-missing rule (cross-tenant isolation) live in the service.
    import_job = await import_service.get_import_job_or_403(
        db, job_id, context.active_tenant.id
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
    context: ActiveContext = Depends(require_writer),
    db: AsyncSession = Depends(get_db),
):
    """List all CSV import jobs for the active tenant, newest first.

    Used by the import history page in the UI. The account name is joined
    in so the grid can render the column without N+1 follow-up requests.

    Viewers are blocked by the require_writer dependency.
    """
    rows = await import_service.list_import_jobs_for_tenant(
        db, context.active_tenant.id
    )

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
