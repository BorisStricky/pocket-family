# import-service/app/tasks/import_csv.py
# The shared core that performs the atomic bulk CSV import.
#
# This module holds the framework-agnostic import logic: `process_import()` and
# its bookkeeping helper `_mark_import_job()`. It deliberately does NOT import
# Celery so that the AWS Lambda image (which excludes celery/kombu/redis) can
# import `process_import` directly. The Celery task that wraps this core lives in
# a separate module (`app/tasks/celery_tasks.py`) which is the only place that
# imports `celery_app`. See `import-service/CLAUDE.md` for the two-entry-point
# design (local Celery task vs AWS Lambda handler, one shared core).
#
# This core receives pre-parsed transaction rows from the backend's
# /imports/execute endpoint. All CSV parsing and duplicate detection happened in
# the backend; this core only inserts rows and updates the account balance.

import logging
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from ..db import (
    account_table,
    get_session,
    import_job_table,
    transaction_table,
)
from ..storage import get_storage

# Transaction source constants - must match PostgreSQL enum labels (uppercase)
TRANSACTION_SOURCE_MANUAL = "MANUAL"
TRANSACTION_SOURCE_RECURRING = "RECURRING"

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

    Failures here must not crash the import — the import itself either committed
    or did not, independent of bookkeeping. We log and move on if the update
    fails so the actual outcome is what gets reported back to the caller.
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


def process_import(payload: dict) -> dict:
    """Atomically insert all pre-parsed transactions and update account balance.

    This is the shared core invoked by BOTH entry points:
      * the local/self-host Celery task (`app/tasks/celery_tasks.py`)
      * the AWS Lambda handler (`app/lambda_handler.py`)

    Uses a single DB transaction so either all rows are committed or none are.
    The account balance update — AND the ImportJob claim + final DONE flip — are
    included in that same commit for consistency.

    Idempotency (plan A3), folded into the import transaction so failure
    semantics stay correct:
      * Claim: a conditional `UPDATE importjob SET status='STARTED'
        WHERE id=:id AND status != 'DONE'` runs as the first statement of the
        import transaction. A delivery for an already-finished job matches zero
        rows (rowcount == 0) and returns `{"status": "skipped"}` without
        inserting, so transactions are never double-inserted.
      * Success: the job is flipped to DONE *in the same transaction* as the
        inserts. The success state therefore becomes visible atomically with the
        rows — never before — which is what makes the `!= 'DONE'` guard safe
        against a concurrent re-delivery that hasn't committed yet (row-level
        locking serializes the two claims; the loser re-reads `status='DONE'`).
      * Retry: because the claim, inserts, balance update, and DONE flip share
        ONE transaction, any rollback (transient DB error, OOM/timeout/SIGKILL
        before commit) leaves the job in its prior, still-re-claimable state
        (PENDING / STARTED / FAILED). SQS / Celery re-delivery then re-runs it,
        and only a message that exhausts its retries lands in the DLQ. We
        deliberately do NOT skip on STARTED or FAILED — those mean a previous
        attempt died or errored and the import must be allowed to retry.

    When `import_job_id` is None there is no job row to claim (local/test
    invocations may omit it), so we simply proceed — preserving the prior
    unconditional behavior for that case.

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
        dict with status="done" and imported=N on success, or
        status="skipped" when the job was already finished (idempotent no-op).
        Raises on failure (the caller marks the task/invocation as FAILURE).
    """
    rows = payload.get("rows", [])
    total = len(rows)

    import_job_id_string = payload.get("import_job_id")
    import_job_id = UUID(import_job_id_string) if import_job_id_string else None

    tenant_id = UUID(payload["tenant_id"])
    account_id = UUID(payload["account_id"])
    created_by = UUID(payload["created_by"])
    currency = payload["currency"]
    file_key = payload.get("file_key")
    now = datetime.utcnow()

    try:
        with get_session() as session:
            # Idempotency claim, folded into the import transaction (see the
            # docstring for the full failure-mode reasoning). When there is a job
            # row, atomically flip any not-yet-finished status to STARTED; if it
            # is already DONE (rowcount == 0) a prior delivery completed this
            # import, so we no-op to avoid a duplicate insert. When there is no
            # job row (import_job_id is None) there is nothing to claim and we
            # fall through to the import — keeping prior local/test behavior.
            if import_job_id is not None:
                claim_result = session.execute(
                    import_job_table.update()
                    .where(import_job_table.c.id == import_job_id)
                    .where(import_job_table.c.status != "DONE")
                    .values(status="STARTED", updated_at=now)
                )
                if claim_result.rowcount == 0:
                    logger.info(
                        "ImportJob %s already DONE (or gone); skipping to avoid "
                        "duplicate insert.",
                        import_job_id,
                    )
                    return {"status": "skipped", "reason": "already-done"}

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
                    "source": TRANSACTION_SOURCE_MANUAL,
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

            # Flip the job to DONE in the SAME transaction as the inserts. This
            # is what makes the `status != 'DONE'` claim above safe against a
            # concurrent re-delivery: the success state is committed atomically
            # with the rows, so any other delivery either blocks on the row lock
            # and then sees DONE, or never sees a half-finished STARTED+rows
            # state it could mistake for re-claimable work.
            if import_job_id is not None:
                session.execute(
                    import_job_table.update()
                    .where(import_job_table.c.id == import_job_id)
                    .values(
                        status="DONE",
                        imported_rows=total,
                        updated_at=now,
                        completed_at=now,
                    )
                )

            session.commit()
            logger.info("Imported %d transactions for account %s", total, account_id)
    except Exception as task_error:
        # The import transaction rolled back, so the job is back in its prior,
        # still-re-claimable state. Record FAILED best-effort (a separate
        # transaction) so the UI can render a reason. FAILED is still != 'DONE',
        # so a subsequent SQS / Celery re-delivery re-claims and retries; only
        # the final, retry-exhausted attempt's FAILED is the one that sticks —
        # exactly the state we want surfaced once the message reaches the DLQ.
        _mark_import_job(
            import_job_id,
            status="FAILED",
            error_message=f"{type(task_error).__name__}: {task_error}",
            terminal=True,
        )
        raise

    # Best-effort cleanup of the uploaded CSV after a successful import.
    # If cleanup fails we log and continue — the import itself succeeded.
    if file_key:
        try:
            get_storage().delete(file_key)
        except Exception as cleanup_error:
            logger.warning("Could not delete upload file %r: %s", file_key, cleanup_error)

    return {"status": "done", "imported": total}
