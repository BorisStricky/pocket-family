# import-service/app/tasks/import_csv.py
# The core Celery task that performs the atomic bulk CSV import.
#
# This task receives pre-parsed transaction rows from the backend's
# /imports/execute endpoint. All CSV parsing and duplicate detection
# happened in the backend; the task only needs to insert rows and
# update the account balance.

import logging
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from ..celery_app import celery_app
from ..db import (
    account_table,
    get_session,
    import_job_table,
    transaction_table,
)
from ..storage import get_storage

logger = logging.getLogger(__name__)


def _mark_import_job(
    import_job_id: UUID | None,
    *,
    status: str,
    imported_rows: int | None = None,
    error_message: str | None = None,
    terminal: bool = False,
) -> None:
    """Best-effort update of the ImportJob row owned by the API.

    Failures here must not crash the task — the import itself either committed
    or did not, independent of bookkeeping. We log and move on if the update
    fails so the task's actual outcome is what gets reported back to Celery.
    """
    if not import_job_id:
        return
    try:
        now = datetime.utcnow()
        values: dict = {"status": status, "updated_at": now}
        if imported_rows is not None:
            values["imported_rows"] = imported_rows
        if error_message is not None:
            # Truncate to a reasonable length so an enormous traceback doesn't
            # blow up the row width or the import history grid.
            values["error_message"] = error_message[:1000]
        if terminal:
            values["completed_at"] = now

        with get_session() as session:
            session.execute(
                import_job_table.update()
                .where(import_job_table.c.id == import_job_id)
                .values(**values)
            )
            session.commit()
    except Exception as bookkeeping_error:
        logger.warning(
            "Could not update ImportJob %s to %s: %s",
            import_job_id, status, bookkeeping_error,
        )


@celery_app.task(bind=True, name="import_service.execute_import")
def execute_import(self, payload: dict) -> dict:
    """Atomically insert all pre-parsed transactions and update account balance.

    Uses a single DB transaction so either all rows are committed or none are.
    The account balance update is included in the same commit for consistency.

    Args:
        payload: dict with keys:
            import_job_id: str (UUID) — persistent history row to update
            tenant_id:   str (UUID)
            account_id:  str (UUID)
            created_by:  str (UUID) — the user who initiated the import
            currency:    str (e.g. "BRL", "USD")
            file_key:    str — storage key to delete after success
            rows:        list of dicts, each with:
                           transaction_date  (YYYY-MM-DD string)
                           amount            (decimal string, always positive)
                           transaction_type  ("expense" or "income")
                           description       (str or None)
                           category_id       (UUID str or None)

    Returns:
        dict with status="done" and imported=N on success.
        Raises on failure (Celery marks the task as FAILURE automatically).
    """
    rows = payload.get("rows", [])
    total = len(rows)

    raw_job_id = payload.get("import_job_id")
    import_job_id = UUID(raw_job_id) if raw_job_id else None

    # Notify the backend that processing has started so it can show progress
    self.update_state(state="STARTED", meta={"imported": 0, "total": total})
    _mark_import_job(import_job_id, status="STARTED")

    tenant_id = UUID(payload["tenant_id"])
    account_id = UUID(payload["account_id"])
    created_by = UUID(payload["created_by"])
    currency = payload["currency"]
    file_key = payload.get("file_key")
    now = datetime.utcnow()

    try:
        with get_session() as session:
            # Build all transaction dicts for bulk insert — one DB round-trip
            transaction_rows = []
            balance_delta = Decimal("0")

            for row in rows:
                amount = Decimal(str(row["amount"]))
                # Normalize to lowercase for our balance logic; the DB enum labels
                # are uppercase (EXPENSE/INCOME) — that's what SQLAlchemy's SAEnum
                # writes from the backend (it stores enum *names*, not values).
                transaction_type = row["transaction_type"].lower()

                transaction_rows.append({
                    "id": uuid4(),
                    "tenant_id": tenant_id,
                    "account_id": account_id,
                    "category_id": UUID(row["category_id"]) if row.get("category_id") else None,
                    "transaction_date": date.fromisoformat(row["transaction_date"]),
                    # PostgreSQL enum labels are uppercase — see DB enums
                    # transaction_type {EXPENSE, INCOME} and transaction_source
                    # {MANUAL, RECURRING}. The backend ORM uses SAEnum which
                    # serializes Python enum *names* (uppercase), so to stay
                    # consistent we uppercase here too.
                    "transaction_type": transaction_type.upper(),
                    "amount": amount,
                    "currency": currency,
                    "created_by": created_by,
                    "description": row.get("description"),
                    "created_at": now,
                    "updated_at": now,
                    "reconciled": False,
                    "source": "MANUAL",
                })

                # Accumulate balance change to apply in a single UPDATE
                if transaction_type == "income":
                    balance_delta += amount
                else:
                    balance_delta -= amount

            # Atomic commit: all transactions + balance update in one round-trip
            if transaction_rows:
                session.execute(transaction_table.insert(), transaction_rows)

            session.execute(
                account_table.update()
                .where(account_table.c.id == account_id)
                .values(balance=account_table.c.balance + balance_delta)
            )

            session.commit()
            logger.info("Imported %d transactions for account %s", total, account_id)
    except Exception as task_error:
        # Mark the history row as failed before re-raising so Celery sees the
        # exception and the UI can render the failure reason.
        _mark_import_job(
            import_job_id,
            status="FAILED",
            error_message=f"{type(task_error).__name__}: {task_error}",
            terminal=True,
        )
        raise

    _mark_import_job(
        import_job_id,
        status="DONE",
        imported_rows=total,
        terminal=True,
    )

    # Best-effort cleanup of the uploaded CSV after a successful import.
    # If cleanup fails we log and continue — the import itself succeeded.
    if file_key:
        try:
            get_storage().delete(file_key)
        except Exception as cleanup_error:
            logger.warning("Could not delete upload file %r: %s", file_key, cleanup_error)

    return {"status": "done", "imported": total}
