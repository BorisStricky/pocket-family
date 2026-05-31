# import-service/tests/test_process_import.py
# Unit tests for the shared process_import core against in-memory SQLite.
#
# These verify the import core's real behavior without Postgres/network/SQS:
#   * all rows inserted (count matches)
#   * account balance updated (income adds, expense subtracts)
#   * importjob status transitions PENDING → DONE with imported_rows set
#   * idempotency: a second delivery for an already-DONE job no-ops (no dupes)
#   * retry safety: STARTED (lost worker) and FAILED (errored attempt) jobs are
#     re-claimable, and a mid-transaction failure rolls back the claim so the
#     redelivered message retries instead of being silently skipped
#
# The patched_import_core fixture (conftest.py) swaps the core's get_session +
# table objects for SQLite-backed equivalents and stubs storage cleanup.

from datetime import datetime
from decimal import Decimal

import pytest

from tests.conftest import (
    sqlite_account_table,
    sqlite_import_job_table,
    sqlite_transaction_table,
)


ACCOUNT_ID = "33333333-3333-3333-3333-333333333333"
IMPORT_JOB_ID = "11111111-1111-1111-1111-111111111111"
TENANT_ID = "22222222-2222-2222-2222-222222222222"
CREATED_BY = "44444444-4444-4444-4444-444444444444"


def _seed_account_and_job(import_csv_module, *, starting_balance, job_status="PENDING"):
    """Insert a starting account row and an ImportJob row via the SQLite session."""
    now = datetime.utcnow()
    with import_csv_module.get_session() as session:
        session.execute(
            sqlite_account_table.insert().values(
                id=ACCOUNT_ID, balance=Decimal(starting_balance)
            )
        )
        session.execute(
            sqlite_import_job_table.insert().values(
                id=IMPORT_JOB_ID,
                status=job_status,
                imported_rows=0,
                updated_at=now,
            )
        )
        session.commit()


def _make_payload(rows):
    return {
        "import_job_id": IMPORT_JOB_ID,
        "tenant_id": TENANT_ID,
        "account_id": ACCOUNT_ID,
        "created_by": CREATED_BY,
        "currency": "BRL",
        "file_key": "uploads/example.csv",
        "rows": rows,
    }


def _count_transactions(import_csv_module) -> int:
    with import_csv_module.get_session() as session:
        return session.query(sqlite_transaction_table).count()


def _get_account_balance(import_csv_module) -> Decimal:
    with import_csv_module.get_session() as session:
        row = session.execute(
            sqlite_account_table.select().where(sqlite_account_table.c.id == ACCOUNT_ID)
        ).first()
        return Decimal(str(row.balance))


def _get_job_status(import_csv_module):
    with import_csv_module.get_session() as session:
        row = session.execute(
            sqlite_import_job_table.select().where(
                sqlite_import_job_table.c.id == IMPORT_JOB_ID
            )
        ).first()
        return row.status, row.imported_rows


def test_process_import_inserts_rows_and_updates_balance(patched_import_core):
    """Income adds and expense subtracts; rows inserted; status → DONE."""
    import_csv_module = patched_import_core
    _seed_account_and_job(import_csv_module, starting_balance="100.00")

    rows = [
        {"transaction_date": "2026-01-01", "amount": "50.00", "transaction_type": "income", "description": "Salary", "category_id": None},
        {"transaction_date": "2026-01-02", "amount": "30.00", "transaction_type": "expense", "description": "Groceries", "category_id": None},
        {"transaction_date": "2026-01-03", "amount": "20.00", "transaction_type": "expense", "description": "Gas", "category_id": None},
    ]

    result = import_csv_module.process_import(_make_payload(rows))

    assert result == {"status": "done", "imported": 3}
    assert _count_transactions(import_csv_module) == 3
    # 100 + 50 (income) - 30 - 20 (expenses) = 100
    assert _get_account_balance(import_csv_module) == Decimal("100.00")

    status, imported_rows = _get_job_status(import_csv_module)
    assert status == "DONE"
    assert imported_rows == 3


def test_process_import_uppercases_transaction_type(patched_import_core):
    """transaction_type is stored uppercased to match the Postgres enum labels."""
    import_csv_module = patched_import_core
    _seed_account_and_job(import_csv_module, starting_balance="0.00")

    rows = [
        {"transaction_date": "2026-02-01", "amount": "10.00", "transaction_type": "income", "description": None, "category_id": None},
    ]
    import_csv_module.process_import(_make_payload(rows))

    with import_csv_module.get_session() as session:
        stored = session.execute(sqlite_transaction_table.select()).first()
    assert stored.transaction_type == "INCOME"
    assert stored.source == "MANUAL"


def test_process_import_is_idempotent_on_already_done_job(patched_import_core):
    """A second delivery for an already-DONE job no-ops (no duplicate rows)."""
    import_csv_module = patched_import_core
    _seed_account_and_job(import_csv_module, starting_balance="100.00")

    rows = [
        {"transaction_date": "2026-01-01", "amount": "50.00", "transaction_type": "income", "description": "Salary", "category_id": None},
    ]
    payload = _make_payload(rows)

    # First delivery succeeds and claims the job.
    first_result = import_csv_module.process_import(payload)
    assert first_result == {"status": "done", "imported": 1}
    assert _count_transactions(import_csv_module) == 1
    assert _get_account_balance(import_csv_module) == Decimal("150.00")

    # Second delivery of the SAME message: the job is now DONE, so the
    # idempotency claim matches zero rows and the import is skipped — no new
    # rows, balance unchanged.
    second_result = import_csv_module.process_import(payload)
    assert second_result == {"status": "skipped", "reason": "already-done"}
    assert _count_transactions(import_csv_module) == 1
    assert _get_account_balance(import_csv_module) == Decimal("150.00")


def test_started_job_is_reclaimable_after_lost_worker(patched_import_core):
    """A STARTED job (worker died after claiming, before committing) re-runs.

    The old separate-transaction claim committed PENDING → STARTED on its own,
    so if the worker was then killed before the insert, the redelivered message
    saw status='STARTED' (not PENDING) and was silently skipped — the import was
    lost. Folding the claim into the insert transaction means a STARTED row is
    still re-claimable (status != 'DONE'), so the retry actually imports.
    """
    import_csv_module = patched_import_core
    # Simulate the leftover state of a worker that claimed then died: STARTED
    # with zero rows inserted (the insert never committed).
    _seed_account_and_job(import_csv_module, starting_balance="100.00", job_status="STARTED")

    rows = [
        {"transaction_date": "2026-04-01", "amount": "25.00", "transaction_type": "income", "description": "Refund", "category_id": None},
    ]
    result = import_csv_module.process_import(_make_payload(rows))

    assert result == {"status": "done", "imported": 1}
    assert _count_transactions(import_csv_module) == 1
    assert _get_account_balance(import_csv_module) == Decimal("125.00")
    status, imported_rows = _get_job_status(import_csv_module)
    assert status == "DONE"
    assert imported_rows == 1


def test_failed_job_is_reclaimable_on_redelivery(patched_import_core):
    """A FAILED job is re-claimable so a transient error can retry to success.

    A prior attempt marked the job FAILED (best-effort, after its transaction
    rolled back). Because FAILED is still != 'DONE', a redelivered message must
    re-claim and import rather than being skipped — otherwise the very first
    transient error would be permanent and never reach the DLQ.
    """
    import_csv_module = patched_import_core
    _seed_account_and_job(import_csv_module, starting_balance="100.00", job_status="FAILED")

    rows = [
        {"transaction_date": "2026-04-02", "amount": "10.00", "transaction_type": "expense", "description": "Coffee", "category_id": None},
    ]
    result = import_csv_module.process_import(_make_payload(rows))

    assert result == {"status": "done", "imported": 1}
    assert _count_transactions(import_csv_module) == 1
    assert _get_account_balance(import_csv_module) == Decimal("90.00")
    status, _imported_rows = _get_job_status(import_csv_module)
    assert status == "DONE"


def test_transient_failure_rolls_back_claim_then_retry_succeeds(patched_import_core):
    """A mid-transaction failure rolls back the claim, and a retry imports.

    The first delivery raises *after* the claim ran but before commit (here via
    a malformed transaction_date). The whole transaction — including the
    PENDING → STARTED claim — must roll back, leaving no rows. The job is marked
    FAILED best-effort. A second delivery (the SQS retry) with a valid payload
    must then import successfully, proving the claim was not committed
    independently of the work.
    """
    import_csv_module = patched_import_core
    _seed_account_and_job(import_csv_module, starting_balance="100.00")

    bad_rows = [
        {"transaction_date": "not-a-real-date", "amount": "10.00", "transaction_type": "expense", "description": None, "category_id": None},
    ]
    # The malformed date raises inside the import transaction, after the claim.
    with pytest.raises(ValueError):
        import_csv_module.process_import(_make_payload(bad_rows))

    # Nothing was inserted and the balance is untouched (transaction rolled back).
    assert _count_transactions(import_csv_module) == 0
    assert _get_account_balance(import_csv_module) == Decimal("100.00")
    # Best-effort bookkeeping recorded the failure for the UI.
    status, _imported_rows = _get_job_status(import_csv_module)
    assert status == "FAILED"

    # The SQS retry delivers the same job with a valid payload — it must import,
    # not skip (FAILED is re-claimable).
    good_rows = [
        {"transaction_date": "2026-04-03", "amount": "10.00", "transaction_type": "expense", "description": None, "category_id": None},
    ]
    retry_result = import_csv_module.process_import(_make_payload(good_rows))
    assert retry_result == {"status": "done", "imported": 1}
    assert _count_transactions(import_csv_module) == 1
    assert _get_account_balance(import_csv_module) == Decimal("90.00")
    status, imported_rows = _get_job_status(import_csv_module)
    assert status == "DONE"
    assert imported_rows == 1


def test_process_import_without_job_id_still_imports(patched_import_core):
    """When import_job_id is omitted there is no job to claim — import proceeds."""
    import_csv_module = patched_import_core
    _seed_account_and_job(import_csv_module, starting_balance="0.00")

    payload = _make_payload([
        {"transaction_date": "2026-03-01", "amount": "5.00", "transaction_type": "expense", "description": None, "category_id": None},
    ])
    del payload["import_job_id"]

    result = import_csv_module.process_import(payload)

    assert result == {"status": "done", "imported": 1}
    assert _count_transactions(import_csv_module) == 1
    assert _get_account_balance(import_csv_module) == Decimal("-5.00")
