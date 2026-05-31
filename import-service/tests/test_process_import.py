# import-service/tests/test_process_import.py
# Unit tests for the shared process_import core against in-memory SQLite.
#
# These verify the import core's real behavior without Postgres/network/SQS:
#   * all rows inserted (count matches)
#   * account balance updated (income adds, expense subtracts)
#   * importjob status transitions PENDING → DONE with imported_rows set
#   * idempotency: a second delivery for an already-DONE job no-ops (no dupes)
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

    # Second delivery of the SAME message: job is no longer PENDING, so the
    # idempotency claim fails and the import is skipped — no new rows, balance
    # unchanged.
    second_result = import_csv_module.process_import(payload)
    assert second_result == {"status": "skipped", "reason": "already-claimed"}
    assert _count_transactions(import_csv_module) == 1
    assert _get_account_balance(import_csv_module) == Decimal("150.00")


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
