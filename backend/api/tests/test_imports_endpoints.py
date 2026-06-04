"""
Tests for /imports/* endpoints in app/routers/imports.py.

Covers the four endpoints of the CSV import wizard:

- POST /imports/upload    — multipart CSV upload, content-type/size/extension checks
- POST /imports/analyze   — CSV parsing with column mapping + duplicate detection
- POST /imports/execute   — dispatch Celery task (VIEWER role rejected, account verified)
- GET  /imports/jobs/{id} — map Celery state to import status

Mocking strategy:
- A `LocalAdapter` backed by `tmp_path` replaces the real storage in
  `app.routers.imports.get_storage_backend` so no test writes to /uploads.
- `app.routers.imports.celery_client.send_task` is monkeypatched to a fake
  that records the dispatched task and returns a stub task object — no Redis
  or worker is involved.
- Job-status tests seed an `ImportJob` row via the `owner_job_id` fixture and
  mutate `status` / `imported_rows` / `error_message` directly on that row
  before calling the endpoint, since `GET /imports/jobs/{id}` reads state
  from the `importjob` table and no longer consults Celery.

Each endpoint test also validates multi-tenant isolation: requests for a
tenant the user does not belong to, file_keys prefixed with a different
tenant's UUID, and accounts/transactions belonging to other tenants must
all be rejected.
"""

from datetime import date
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Account,
    AccountType,
    Category,
    CategoryKind,
    Currency,
    ImportJob,
    ImportJobStatus,
    Membership,
    MembershipRole,
    MembershipStatus,
    Tenant,
    Transaction,
    TransactionSource,
    User,
)
from app.storage.local import LocalAdapter
from app.routers import imports as imports_module


# ---------------------------------------------------------------------------
# Fixtures specific to import endpoint tests
# ---------------------------------------------------------------------------


@pytest.fixture
def storage_directory(tmp_path: Path) -> Path:
    """Provide a clean temp directory to back the LocalAdapter for one test."""
    return tmp_path / "csv-uploads"


@pytest.fixture
def patched_storage(monkeypatch: pytest.MonkeyPatch, storage_directory: Path):
    """Replace the storage backend used by the imports router with a tmp-backed LocalAdapter.

    The router calls `get_storage_backend()` inside each endpoint, so we patch
    that symbol in the router module's namespace. The fixture yields the
    adapter so individual tests can write/read directly for assertion or
    setup without going through the API.
    """
    local_adapter = LocalAdapter(upload_dir=str(storage_directory))

    def _fake_get_storage_backend() -> LocalAdapter:
        return local_adapter

    monkeypatch.setattr(imports_module, "get_storage_backend", _fake_get_storage_backend)
    yield local_adapter


@pytest.fixture
def fake_celery_dispatch(monkeypatch: pytest.MonkeyPatch):
    """Replace `celery_client.send_task` with a recorder that returns a stub task.

    Yields a list to which every dispatched task is appended as a dict:
        {"name": str, "kwargs": dict, "task_id": str}
    Tests inspect this list to assert the correct task was dispatched without
    contacting Redis or running a worker.
    """
    dispatched_tasks: list[dict[str, Any]] = []

    def _fake_send_task(name: str, *, kwargs: dict | None = None, **_ignored):
        task_id = str(uuid4())
        dispatched_tasks.append(
            {"name": name, "kwargs": kwargs or {}, "task_id": task_id}
        )
        return SimpleNamespace(id=task_id)

    monkeypatch.setattr(imports_module.celery_client, "send_task", _fake_send_task)
    yield dispatched_tasks


@pytest_asyncio.fixture
async def imported_account(
    async_session: AsyncSession, test_user: User, test_tenant: Tenant
) -> Account:
    """Create an account owned by test_user inside test_tenant for import tests.

    Used as the target account for analyze/execute requests.
    """
    account = Account(
        user_id=test_user.id,
        name="Import Target Account",
        type=AccountType.DEBIT,
        currency=Currency.BRL,
        balance=Decimal("0.00"),
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)
    return account


@pytest_asyncio.fixture
async def owner_job_id(
    async_session: AsyncSession,
    test_user: User,
    test_tenant: Tenant,
    imported_account: Account,
) -> str:
    """Persist a PENDING ImportJob for test_tenant and return its celery_task_id.

    The job-status endpoint enforces tenant scoping by requiring an ImportJob
    row whose celery_task_id matches the requested job_id and whose tenant_id
    matches the caller. Tests that drive the Celery state machine need that
    row to exist; otherwise they would get a 404 before the state mapping
    code is reached.
    """
    job_id = str(uuid4())
    import_job = ImportJob(
        tenant_id=test_tenant.id,
        account_id=imported_account.id,
        created_by=test_user.id,
        file_key=f"{test_tenant.id}/{uuid4()}.csv",
        filename="statement.csv",
        total_rows=10,
        imported_rows=0,
        status=ImportJobStatus.PENDING,
        celery_task_id=job_id,
    )
    async_session.add(import_job)
    await async_session.commit()
    return job_id


@pytest_asyncio.fixture
async def other_tenant_account(
    async_session: AsyncSession, other_tenant_owner: tuple
) -> Account:
    """Create an account owned by another tenant's owner.

    Used by isolation tests to verify execute() rejects accounts that exist
    but live outside the requester's tenant.
    """
    other_user, _other_membership = other_tenant_owner
    account = Account(
        user_id=other_user.id,
        name="Other Tenant Account",
        type=AccountType.DEBIT,
        currency=Currency.BRL,
        balance=Decimal("0.00"),
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)
    return account


# ---------------------------------------------------------------------------
# Helper to assemble a multipart CSV upload payload for httpx
# ---------------------------------------------------------------------------


def _csv_upload_files(csv_text: str, filename: str = "statement.csv", content_type: str = "text/csv"):
    """Build the `files=` dict for httpx.AsyncClient.post with a CSV payload."""
    return {"file": (filename, BytesIO(csv_text.encode("utf-8")), content_type)}


def _bearer(token: str) -> dict:
    """Build an Authorization header dict for tests."""
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# POST /imports/upload
# ===========================================================================


class TestUploadEndpoint:
    """Tests for POST /imports/upload."""

    async def test_upload_success_returns_columns_and_sample_rows(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        patched_storage: LocalAdapter,
    ):
        """Successful upload returns detected_columns, sample_rows, row_count, file_key.

        Validates:
        - 200 response with the documented response shape
        - file_key is prefixed with the active tenant's UUID + a UUID suffix + .csv
        - Stored bytes match the uploaded bytes
        - sample_rows is capped at 5 rows
        """
        csv_text = (
            "date,amount,description\n"
            "2024-01-01,-10.50,Coffee\n"
            "2024-01-02,-25.00,Lunch\n"
            "2024-01-03,1500.00,Salary\n"
            "2024-01-04,-3.00,Bus\n"
            "2024-01-05,-8.20,Snack\n"
            "2024-01-06,-42.10,Dinner\n"  # 6th data row — should NOT be in sample
        )

        response = await async_client.post(
            "/imports/upload",
            files=_csv_upload_files(csv_text),
            headers=_bearer(owner_token),
        )

        assert response.status_code == 200, response.text
        response_body = response.json()

        # file_key must be '{tenant_id}/{uuid}.csv'
        assert response_body["file_key"].startswith(f"{test_tenant.id}/")
        assert response_body["file_key"].endswith(".csv")

        # Detected columns come straight from the header row
        assert response_body["detected_columns"] == ["date", "amount", "description"]

        # row_count counts ALL data rows, sample_rows is capped at 5
        assert response_body["row_count"] == 6
        assert len(response_body["sample_rows"]) == 5
        assert response_body["sample_rows"][0]["description"] == "Coffee"

        # Verify the bytes were actually stored under the returned key
        stored_bytes = patched_storage.read(response_body["file_key"])
        assert stored_bytes.decode("utf-8") == csv_text

    async def test_upload_rejects_non_csv_extension(
        self,
        async_client: AsyncClient,
        owner_token: str,
        patched_storage: LocalAdapter,
    ):
        """Files without a .csv extension must be rejected with 422."""
        response = await async_client.post(
            "/imports/upload",
            files=_csv_upload_files("date,amount\n", filename="statement.txt"),
            headers=_bearer(owner_token),
        )

        assert response.status_code == 422
        assert "csv" in response.json()["detail"].lower()

    async def test_upload_rejects_files_over_size_cap(
        self,
        async_client: AsyncClient,
        owner_token: str,
        patched_storage: LocalAdapter,
    ):
        """Files larger than 5 MB must be rejected with 413 Request Entity Too Large.

        We construct a CSV payload just over the 5 MB limit using a header
        followed by repeated cheap rows.
        """
        # Build a CSV that exceeds the 5 MB cap. The router reads MAX + 1 bytes
        # then checks against MAX, so anything > 5*1024*1024 bytes triggers.
        oversize_payload = b"date,amount\n" + (b"2024-01-01,1.00\n" * 350_000)
        assert len(oversize_payload) > 5 * 1024 * 1024

        response = await async_client.post(
            "/imports/upload",
            files={
                "file": (
                    "huge.csv",
                    BytesIO(oversize_payload),
                    "text/csv",
                )
            },
            headers=_bearer(owner_token),
        )

        assert response.status_code == 413
        assert "5 MB" in response.json()["detail"]

    async def test_upload_requires_authentication(
        self,
        async_client: AsyncClient,
        patched_storage: LocalAdapter,
    ):
        """An unauthenticated upload must be rejected with 401."""
        response = await async_client.post(
            "/imports/upload",
            files=_csv_upload_files("date,amount\n2024-01-01,1.00\n"),
        )

        assert response.status_code == 401

    async def test_upload_file_key_uses_active_tenant_id(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        other_tenant: Tenant,
        patched_storage: LocalAdapter,
    ):
        """Multi-tenant isolation: file_key prefix is the active tenant's UUID.

        Even if another tenant exists and the user has another active context
        elsewhere, the upload must use the tenant from the JWT — there is no
        way for the user to spoof tenant_id via this endpoint.
        """
        response = await async_client.post(
            "/imports/upload",
            files=_csv_upload_files("date,amount\n2024-01-01,5.00\n"),
            headers=_bearer(owner_token),
        )

        assert response.status_code == 200
        file_key = response.json()["file_key"]
        assert file_key.startswith(f"{test_tenant.id}/")
        assert not file_key.startswith(f"{other_tenant.id}/")

    async def test_upload_rejects_viewer_role(
        self,
        async_client: AsyncClient,
        viewer_token: str,
        viewer_membership: Membership,
        test_tenant: Tenant,
        patched_storage: LocalAdapter,
    ):
        """A user with VIEWER role must be denied upload access with 403.

        Verifies that the viewer role check fires on the upload endpoint
        before any file processing occurs. The error detail must contain
        "Viewers" to match the role-rejection message from the router.
        """
        response = await async_client.post(
            "/imports/upload",
            files=_csv_upload_files("date,amount\n2024-01-01,1.00\n"),
            headers=_bearer(viewer_token),
        )

        assert response.status_code == 403
        assert "Viewers" in response.json()["detail"]


# ===========================================================================
# POST /imports/analyze
# ===========================================================================


class TestAnalyzeEndpoint:
    """Tests for POST /imports/analyze."""

    async def _upload_csv(
        self,
        async_client: AsyncClient,
        token: str,
        csv_text: str,
    ) -> str:
        """Helper: upload a CSV and return the file_key from the response."""
        upload_response = await async_client.post(
            "/imports/upload",
            files=_csv_upload_files(csv_text),
            headers=_bearer(token),
        )
        assert upload_response.status_code == 200, upload_response.text
        return upload_response.json()["file_key"]

    async def test_analyze_parses_rows_and_flags_no_duplicates_on_empty_db(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        imported_account: Account,
        patched_storage: LocalAdapter,
    ):
        """Analyzing a fresh CSV with no matching transactions flags zero duplicates."""
        csv_text = (
            "date,amount,description\n"
            "2024-01-01,-10.50,Coffee\n"
            "2024-01-02,1500.00,Salary\n"
        )
        file_key = await self._upload_csv(async_client, owner_token, csv_text)

        analyze_payload = {
            "file_key": file_key,
            "account_id": str(imported_account.id),
            "column_mapping": {
                "date_column": "date",
                "amount_column": "amount",
                "description_column": "description",
            },
            "start_row": 0,
            "currency": "BRL",
        }

        response = await async_client.post(
            "/imports/analyze", json=analyze_payload, headers=_bearer(owner_token)
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["duplicate_count"] == 0
        assert body["parse_error_count"] == 0
        assert len(body["rows"]) == 2

        # Sign inference: -10.50 → expense, 1500.00 → income
        assert body["rows"][0]["transaction_type"] == "expense"
        assert body["rows"][0]["amount"] == "10.50"
        assert body["rows"][1]["transaction_type"] == "income"
        assert body["rows"][1]["amount"] == "1500.00"

        # date_range covers all valid rows
        assert body["date_range_start"] == "2024-01-01"
        assert body["date_range_end"] == "2024-01-02"

    async def test_analyze_flips_sign_classification_for_credit_card_convention(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        imported_account: Account,
        patched_storage: LocalAdapter,
    ):
        """positive_amounts_are_expenses=True flips sign-based inference.

        Credit-card exports list purchases (expenses) as positive and payments
        as negative. With the flag set, a positive amount must come back as an
        expense and a negative amount as income — the opposite of the default
        bank convention validated in the test above.
        """
        csv_text = (
            "date,amount,description\n"
            "2024-01-01,150.00,Card purchase\n"   # positive → expense under credit convention
            "2024-01-02,-500.00,Card payment\n"   # negative → income under credit convention
        )
        file_key = await self._upload_csv(async_client, owner_token, csv_text)

        response = await async_client.post(
            "/imports/analyze",
            json={
                "file_key": file_key,
                "account_id": str(imported_account.id),
                "column_mapping": {
                    "date_column": "date",
                    "amount_column": "amount",
                    "description_column": "description",
                },
                "positive_amounts_are_expenses": True,
            },
            headers=_bearer(owner_token),
        )

        assert response.status_code == 200, response.text
        body = response.json()
        rows_by_index = {row["row_index"]: row for row in body["rows"]}

        # Positive purchase classified as an expense; value stays absolute
        assert rows_by_index[0]["transaction_type"] == "expense"
        assert rows_by_index[0]["amount"] == "150.00"
        # Negative payment classified as income
        assert rows_by_index[1]["transaction_type"] == "income"
        assert rows_by_index[1]["amount"] == "500.00"

    async def test_analyze_defaults_to_bank_convention_when_flag_omitted(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        imported_account: Account,
        patched_storage: LocalAdapter,
    ):
        """Omitting positive_amounts_are_expenses keeps the bank convention (regression guard).

        A positive amount must remain income and a negative amount an expense,
        exactly as before the credit-card feature was added.
        """
        csv_text = (
            "date,amount,description\n"
            "2024-01-01,150.00,Deposit\n"
            "2024-01-02,-500.00,Withdrawal\n"
        )
        file_key = await self._upload_csv(async_client, owner_token, csv_text)

        response = await async_client.post(
            "/imports/analyze",
            json={
                "file_key": file_key,
                "account_id": str(imported_account.id),
                "column_mapping": {
                    "date_column": "date",
                    "amount_column": "amount",
                    "description_column": "description",
                },
            },
            headers=_bearer(owner_token),
        )

        assert response.status_code == 200, response.text
        rows_by_index = {row["row_index"]: row for row in response.json()["rows"]}
        assert rows_by_index[0]["transaction_type"] == "income"
        assert rows_by_index[1]["transaction_type"] == "expense"

    async def test_analyze_credit_flag_governs_rows_with_empty_type_cell(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        imported_account: Account,
        patched_storage: LocalAdapter,
    ):
        """An explicit type cell wins; an empty type cell falls back to the flipped sign.

        When a Type column is mapped, a populated cell drives classification, but a
        blank cell falls back to sign-based inference — which the credit-card flag
        flips. This locks in the fallback path so the two behaviors stay consistent.
        """
        csv_text = (
            "date,amount,type,description\n"
            "2024-01-01,150.00,credit,Refund\n"   # explicit type wins → income
            "2024-01-02,150.00,,Card purchase\n"  # empty type → flipped sign → expense
        )
        file_key = await self._upload_csv(async_client, owner_token, csv_text)

        response = await async_client.post(
            "/imports/analyze",
            json={
                "file_key": file_key,
                "account_id": str(imported_account.id),
                "column_mapping": {
                    "date_column": "date",
                    "amount_column": "amount",
                    "type_column": "type",
                    "description_column": "description",
                },
                "positive_amounts_are_expenses": True,
            },
            headers=_bearer(owner_token),
        )

        assert response.status_code == 200, response.text
        rows_by_index = {row["row_index"]: row for row in response.json()["rows"]}
        # Explicit 'credit' type cell wins regardless of the flag
        assert rows_by_index[0]["transaction_type"] == "income"
        # Empty type cell falls back to sign inference, flipped by the credit flag
        assert rows_by_index[1]["transaction_type"] == "expense"

    async def test_analyze_flags_duplicates_against_existing_transactions(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_user: User,
        test_tenant: Tenant,
        imported_account: Account,
        patched_storage: LocalAdapter,
    ):
        """A row matching (account_id, date, abs(amount)) is flagged is_duplicate=True."""
        # Pre-existing transaction that should be detected as a duplicate
        existing_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=imported_account.id,
            transaction_date=date(2024, 1, 1),
            amount=Decimal("10.50"),
            currency=Currency.BRL,
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
            source=TransactionSource.MANUAL,
        )
        async_session.add(existing_transaction)
        await async_session.commit()
        await async_session.refresh(existing_transaction)

        csv_text = (
            "date,amount,description\n"
            "2024-01-01,-10.50,Coffee\n"   # duplicate of existing
            "2024-01-02,1500.00,Salary\n"  # not a duplicate
        )
        file_key = await self._upload_csv(async_client, owner_token, csv_text)

        response = await async_client.post(
            "/imports/analyze",
            json={
                "file_key": file_key,
                "account_id": str(imported_account.id),
                "column_mapping": {
                    "date_column": "date",
                    "amount_column": "amount",
                    "description_column": "description",
                },
            },
            headers=_bearer(owner_token),
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["duplicate_count"] == 1

        duplicate_row = next(r for r in body["rows"] if r["row_index"] == 0)
        non_dup_row = next(r for r in body["rows"] if r["row_index"] == 1)

        assert duplicate_row["is_duplicate"] is True
        assert duplicate_row["matching_transaction_id"] == str(existing_transaction.id)
        assert non_dup_row["is_duplicate"] is False

    async def test_analyze_records_parse_errors_per_row(
        self,
        async_client: AsyncClient,
        owner_token: str,
        imported_account: Account,
        patched_storage: LocalAdapter,
    ):
        """Rows with unparseable date or amount produce parse_error on that row only.

        The endpoint must NOT fail outright — the wizard's review step needs
        every row (good and bad) to display to the user.
        """
        csv_text = (
            "date,amount,description\n"
            "2024-01-01,-10.50,Good row\n"
            ",-25.00,Missing date\n"
            "2024-01-03,not-a-number,Bad amount\n"
            "2024-01-04,42.00,Another good row\n"
        )
        file_key = await self._upload_csv(async_client, owner_token, csv_text)

        response = await async_client.post(
            "/imports/analyze",
            json={
                "file_key": file_key,
                "account_id": str(imported_account.id),
                "column_mapping": {
                    "date_column": "date",
                    "amount_column": "amount",
                    "description_column": "description",
                },
            },
            headers=_bearer(owner_token),
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["parse_error_count"] == 2

        rows_by_index = {row["row_index"]: row for row in body["rows"]}
        assert rows_by_index[0]["parse_error"] is None
        assert rows_by_index[1]["parse_error"] is not None  # missing date
        assert rows_by_index[2]["parse_error"] is not None  # bad amount
        assert rows_by_index[3]["parse_error"] is None

    async def test_analyze_rejects_file_key_with_other_tenant_prefix(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        other_tenant: Tenant,
        imported_account: Account,
        patched_storage: LocalAdapter,
    ):
        """A file_key prefixed with another tenant's UUID must return 403."""
        # Build a file_key as if it belonged to other_tenant
        spoofed_file_key = f"{other_tenant.id}/{uuid4()}.csv"

        response = await async_client.post(
            "/imports/analyze",
            json={
                "file_key": spoofed_file_key,
                "account_id": str(imported_account.id),
                "column_mapping": {
                    "date_column": "date",
                    "amount_column": "amount",
                },
            },
            headers=_bearer(owner_token),
        )

        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]

    async def test_analyze_returns_404_when_file_key_missing_from_storage(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        imported_account: Account,
        patched_storage: LocalAdapter,
    ):
        """A correctly prefixed but non-existent file_key must return 404.

        The frontend uses this to prompt the user to re-upload after the
        file has been purged by the worker.
        """
        missing_file_key = f"{test_tenant.id}/{uuid4()}.csv"

        response = await async_client.post(
            "/imports/analyze",
            json={
                "file_key": missing_file_key,
                "account_id": str(imported_account.id),
                "column_mapping": {
                    "date_column": "date",
                    "amount_column": "amount",
                },
            },
            headers=_bearer(owner_token),
        )

        assert response.status_code == 404
        assert "re-upload" in response.json()["detail"].lower()

    async def test_analyze_dedupe_filters_by_tenant_id(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        other_tenant: Tenant,
        other_tenant_owner: tuple,
        imported_account: Account,
        other_tenant_account: Account,
        patched_storage: LocalAdapter,
    ):
        """Duplicates must be detected only within the active tenant's transactions.

        A transaction with matching (date, amount) in ANOTHER tenant must not
        be flagged as a duplicate — that would leak the existence of data
        across tenant boundaries.
        """
        other_user, _ = other_tenant_owner

        # Insert a transaction in the OTHER tenant with values that would match
        cross_tenant_transaction = Transaction(
            tenant_id=other_tenant.id,
            account_id=other_tenant_account.id,
            transaction_date=date(2024, 1, 1),
            amount=Decimal("10.50"),
            currency=Currency.BRL,
            transaction_type=CategoryKind.EXPENSE,
            created_by=other_user.id,
            source=TransactionSource.MANUAL,
        )
        async_session.add(cross_tenant_transaction)
        await async_session.commit()

        csv_text = "date,amount\n2024-01-01,-10.50\n"
        upload_response = await async_client.post(
            "/imports/upload",
            files=_csv_upload_files(csv_text),
            headers=_bearer(owner_token),
        )
        file_key = upload_response.json()["file_key"]

        response = await async_client.post(
            "/imports/analyze",
            json={
                "file_key": file_key,
                "account_id": str(imported_account.id),
                "column_mapping": {
                    "date_column": "date",
                    "amount_column": "amount",
                },
            },
            headers=_bearer(owner_token),
        )

        assert response.status_code == 200
        body = response.json()
        # The matching transaction lives in the OTHER tenant — must NOT be flagged
        assert body["duplicate_count"] == 0
        assert body["rows"][0]["is_duplicate"] is False

    async def test_analyze_requires_authentication(
        self,
        async_client: AsyncClient,
        imported_account: Account,
        patched_storage: LocalAdapter,
    ):
        """Analyze must reject anonymous requests with 401."""
        response = await async_client.post(
            "/imports/analyze",
            json={
                "file_key": f"{uuid4()}/{uuid4()}.csv",
                "account_id": str(imported_account.id),
                "column_mapping": {"date_column": "date", "amount_column": "amount"},
            },
        )

        assert response.status_code == 401


# ===========================================================================
# POST /imports/execute
# ===========================================================================


class TestExecuteEndpoint:
    """Tests for POST /imports/execute."""

    def _execute_payload(
        self, *, file_key: str, account_id: UUID
    ) -> dict:
        """Build a minimal valid ExecuteRequest body."""
        return {
            "file_key": file_key,
            "account_id": str(account_id),
            "currency": "BRL",
            "rows": [
                {
                    "row_index": 0,
                    "transaction_date": "2024-01-01",
                    "amount": "10.50",
                    "transaction_type": "expense",
                    "description": "Coffee",
                    "category_id": None,
                }
            ],
        }

    async def test_execute_dispatches_celery_task_with_correct_payload(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_user: User,
        test_tenant: Tenant,
        imported_account: Account,
        fake_celery_dispatch,
        patched_storage: LocalAdapter,
    ):
        """A valid execute() request must call celery_client.send_task exactly once.

        Validates the task name, the kwargs payload (tenant_id, account_id,
        created_by, currency, file_key, serialized rows), and that the
        returned job_id matches the stub task id.
        """
        file_key = f"{test_tenant.id}/{uuid4()}.csv"
        payload = self._execute_payload(
            file_key=file_key, account_id=imported_account.id
        )

        response = await async_client.post(
            "/imports/execute", json=payload, headers=_bearer(owner_token)
        )

        assert response.status_code == 200, response.text
        assert len(fake_celery_dispatch) == 1

        dispatched = fake_celery_dispatch[0]
        assert dispatched["name"] == "import_service.execute_import"

        task_kwargs = dispatched["kwargs"]["payload"]
        assert task_kwargs["tenant_id"] == str(test_tenant.id)
        assert task_kwargs["account_id"] == str(imported_account.id)
        assert task_kwargs["created_by"] == str(test_user.id)
        assert task_kwargs["currency"] == "BRL"
        assert task_kwargs["file_key"] == file_key
        assert len(task_kwargs["rows"]) == 1

        serialized_row = task_kwargs["rows"][0]
        assert serialized_row["row_index"] == 0
        assert serialized_row["transaction_date"] == "2024-01-01"
        assert serialized_row["amount"] == "10.50"
        assert serialized_row["transaction_type"] == "expense"

        # job_id in the response matches the stub task id
        assert response.json()["job_id"] == dispatched["task_id"]

    async def test_execute_rejects_viewer_role(
        self,
        async_client: AsyncClient,
        viewer_token: str,
        viewer_membership: Membership,
        test_tenant: Tenant,
        imported_account: Account,
        fake_celery_dispatch,
        patched_storage: LocalAdapter,
    ):
        """A user with VIEWER role must be denied with 403 — no task dispatched."""
        file_key = f"{test_tenant.id}/{uuid4()}.csv"
        payload = self._execute_payload(
            file_key=file_key, account_id=imported_account.id
        )

        response = await async_client.post(
            "/imports/execute", json=payload, headers=_bearer(viewer_token)
        )

        assert response.status_code == 403
        assert "Viewers" in response.json()["detail"]
        # No Celery dispatch must occur when the role check fails
        assert fake_celery_dispatch == []

    async def test_execute_rejects_file_key_prefixed_with_other_tenant(
        self,
        async_client: AsyncClient,
        owner_token: str,
        other_tenant: Tenant,
        imported_account: Account,
        fake_celery_dispatch,
        patched_storage: LocalAdapter,
    ):
        """Cross-tenant file_key on execute() must return 403 — no task dispatched."""
        spoofed_file_key = f"{other_tenant.id}/{uuid4()}.csv"
        payload = self._execute_payload(
            file_key=spoofed_file_key, account_id=imported_account.id
        )

        response = await async_client.post(
            "/imports/execute", json=payload, headers=_bearer(owner_token)
        )

        assert response.status_code == 403
        assert fake_celery_dispatch == []

    async def test_execute_rejects_unknown_account_id(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        fake_celery_dispatch,
        patched_storage: LocalAdapter,
    ):
        """A non-existent account must return 404 — no task dispatched."""
        file_key = f"{test_tenant.id}/{uuid4()}.csv"
        payload = self._execute_payload(file_key=file_key, account_id=uuid4())

        response = await async_client.post(
            "/imports/execute", json=payload, headers=_bearer(owner_token)
        )

        assert response.status_code == 404
        assert fake_celery_dispatch == []

    async def test_execute_rejects_empty_rows(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        imported_account: Account,
        fake_celery_dispatch,
        patched_storage: LocalAdapter,
    ):
        """An execute() with no rows must return 422 — nothing to import."""
        file_key = f"{test_tenant.id}/{uuid4()}.csv"
        response = await async_client.post(
            "/imports/execute",
            json={
                "file_key": file_key,
                "account_id": str(imported_account.id),
                "currency": "BRL",
                "rows": [],
            },
            headers=_bearer(owner_token),
        )

        assert response.status_code == 422
        assert fake_celery_dispatch == []

    async def test_execute_requires_authentication(
        self,
        async_client: AsyncClient,
        imported_account: Account,
        fake_celery_dispatch,
        patched_storage: LocalAdapter,
    ):
        """Unauthenticated execute() must return 401 — no task dispatched."""
        response = await async_client.post(
            "/imports/execute",
            json=self._execute_payload(
                file_key=f"{uuid4()}/{uuid4()}.csv",
                account_id=imported_account.id,
            ),
        )

        assert response.status_code == 401
        assert fake_celery_dispatch == []


# ===========================================================================
# GET /imports/jobs/{job_id}
# ===========================================================================


class TestJobStatusEndpoint:
    """Tests for GET /imports/jobs/{job_id} — Celery state mapping."""

    async def test_pending_state_maps_to_pending(
        self,
        async_client: AsyncClient,
        owner_token: str,
        owner_job_id: str,
    ):
        """ImportJob status PENDING → response status 'pending'.

        `total` is set by the API at dispatch time (the planned row count) and
        the endpoint returns it as soon as the row exists; `imported` is None
        because the fixture seeds `imported_rows=0` and the endpoint maps
        falsy → None for the progress field.
        """
        response = await async_client.get(
            f"/imports/jobs/{owner_job_id}", headers=_bearer(owner_token)
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "pending"
        assert body["imported"] is None
        assert body["total"] == 10
        assert body["error"] is None

    async def test_started_state_maps_to_started_with_progress(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        owner_job_id: str,
    ):
        """ImportJob status STARTED with imported_rows → progress in response."""
        import_job = (
            await async_session.execute(
                select(ImportJob).where(ImportJob.celery_task_id == owner_job_id)
            )
        ).scalar_one()
        import_job.status = ImportJobStatus.STARTED
        import_job.imported_rows = 3
        await async_session.commit()

        response = await async_client.get(
            f"/imports/jobs/{owner_job_id}", headers=_bearer(owner_token)
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "started"
        assert body["imported"] == 3
        assert body["total"] == 10

    async def test_success_state_maps_to_done(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        owner_job_id: str,
    ):
        """ImportJob status DONE → response status 'done' with final imported count."""
        import_job = (
            await async_session.execute(
                select(ImportJob).where(ImportJob.celery_task_id == owner_job_id)
            )
        ).scalar_one()
        import_job.status = ImportJobStatus.DONE
        import_job.imported_rows = 7
        await async_session.commit()

        response = await async_client.get(
            f"/imports/jobs/{owner_job_id}", headers=_bearer(owner_token)
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "done"
        assert body["imported"] == 7

    async def test_failure_state_maps_to_failed_with_error(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        owner_job_id: str,
    ):
        """ImportJob status FAILED + error_message → status 'failed' with error."""
        import_job = (
            await async_session.execute(
                select(ImportJob).where(ImportJob.celery_task_id == owner_job_id)
            )
        ).scalar_one()
        import_job.status = ImportJobStatus.FAILED
        import_job.error_message = "database is down"
        await async_session.commit()

        response = await async_client.get(
            f"/imports/jobs/{owner_job_id}", headers=_bearer(owner_token)
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "failed"
        assert "database is down" in body["error"]

    async def test_job_status_rejects_job_id_from_other_tenant(
        self,
        async_client: AsyncClient,
        owner_token: str,
        other_tenant: Tenant,
        other_tenant_owner: tuple,
        other_tenant_account: Account,
        async_session: AsyncSession,
    ):
        """A user must not be able to poll a job_id owned by another tenant.

        Returns 403 to deny access to cross-tenant jobs. The legitimate UI
        never asks about another tenant's job_id, so 403 (authenticated but
        unauthorized) is the correct semantic; a 404 would falsely imply the
        ID could exist in the caller's tenant.
        """
        # Persist an ImportJob in the other tenant with DONE status so that a
        # leak would surface as a 200 with progress fields — making the
        # assertion below unambiguous if the tenant check were missing.
        other_user, _ = other_tenant_owner
        cross_tenant_job_id = str(uuid4())
        foreign_job = ImportJob(
            tenant_id=other_tenant.id,
            account_id=other_tenant_account.id,
            created_by=other_user.id,
            file_key=f"{other_tenant.id}/{uuid4()}.csv",
            filename="foreign.csv",
            total_rows=5,
            imported_rows=5,
            status=ImportJobStatus.DONE,
            celery_task_id=cross_tenant_job_id,
        )
        async_session.add(foreign_job)
        await async_session.commit()

        response = await async_client.get(
            f"/imports/jobs/{cross_tenant_job_id}",
            headers=_bearer(owner_token),
        )

        assert response.status_code == 403
        # Body must not leak the foreign job's progress
        assert "imported" not in response.text or response.json().get("imported") is None

    async def test_job_status_requires_authentication(
        self,
        async_client: AsyncClient,
    ):
        """An unauthenticated request must be rejected with 401."""
        response = await async_client.get(f"/imports/jobs/{uuid4()}")

        assert response.status_code == 401

    async def test_job_status_rejects_viewer_role(
        self,
        async_client: AsyncClient,
        viewer_token: str,
        viewer_membership: Membership,
        test_tenant: Tenant,
    ):
        """A user with VIEWER role must be denied job-status access with 403.

        Even though no matching ImportJob exists for the requested id, the
        role guard runs first and must short-circuit with 403 before the DB
        lookup.
        """
        response = await async_client.get(
            f"/imports/jobs/{uuid4()}", headers=_bearer(viewer_token)
        )

        assert response.status_code == 403
        assert "Viewers" in response.json()["detail"]


# ===========================================================================
# GET /imports/jobs
# ===========================================================================


class TestListImportJobsEndpoint:
    """Tests for GET /imports/jobs — list import jobs for the active tenant."""

    async def test_list_jobs_rejects_viewer_role(
        self,
        async_client: AsyncClient,
        viewer_token: str,
        viewer_membership: Membership,
        test_tenant: Tenant,
    ):
        """A user with VIEWER role must be denied access to the job list with 403.

        Verifies that the viewer role check fires on the list endpoint before
        any database query is made. The error detail must contain "Viewers" to
        match the role-rejection message from the router.
        """
        response = await async_client.get(
            "/imports/jobs", headers=_bearer(viewer_token)
        )

        assert response.status_code == 403
        assert "Viewers" in response.json()["detail"]

    async def test_list_jobs_requires_authentication(
        self,
        async_client: AsyncClient,
    ):
        """An unauthenticated request to the job list must be rejected with 401."""
        response = await async_client.get("/imports/jobs")

        assert response.status_code == 401


# ===========================================================================
# Cross-cutting multi-tenant isolation tests
# ===========================================================================


class TestImportTenantIsolation:
    """Aggregate tenant-isolation checks across endpoints.

    The per-endpoint test classes above cover each isolation case individually;
    this class adds two scenarios that span multiple endpoints to make the
    isolation invariant explicit.
    """

    async def test_user_from_one_tenant_cannot_analyze_file_from_other_tenant(
        self,
        async_client: AsyncClient,
        owner_token: str,
        other_tenant_token: str,
        test_tenant: Tenant,
        imported_account: Account,
        patched_storage: LocalAdapter,
    ):
        """User A uploads a CSV; User B (different tenant) cannot analyze it.

        Even if User B somehow learns User A's file_key, the file_key prefix
        check must block access.
        """
        # User A uploads
        upload_response = await async_client.post(
            "/imports/upload",
            files=_csv_upload_files("date,amount\n2024-01-01,-1.00\n"),
            headers=_bearer(owner_token),
        )
        assert upload_response.status_code == 200
        user_a_file_key = upload_response.json()["file_key"]
        assert user_a_file_key.startswith(f"{test_tenant.id}/")

        # User B (other tenant) tries to analyze that file_key
        response = await async_client.post(
            "/imports/analyze",
            json={
                "file_key": user_a_file_key,
                "account_id": str(imported_account.id),
                "column_mapping": {
                    "date_column": "date",
                    "amount_column": "amount",
                },
            },
            headers=_bearer(other_tenant_token),
        )

        # The cross-tenant file_key prefix must trigger 403 before the file
        # is even read from storage.
        assert response.status_code == 403

    async def test_user_cannot_execute_against_account_from_other_tenant(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
        other_tenant_account: Account,
        fake_celery_dispatch,
        patched_storage: LocalAdapter,
    ):
        """An execute() against an account owned by a different tenant's user must 403.

        The active user does not own the account and the account is not shared
        with the active tenant via AccountShare, so the executor refuses to
        dispatch and no Celery task is enqueued.
        """
        file_key = f"{test_tenant.id}/{uuid4()}.csv"
        payload = {
            "file_key": file_key,
            "account_id": str(other_tenant_account.id),
            "currency": "BRL",
            "rows": [
                {
                    "row_index": 0,
                    "transaction_date": "2024-01-01",
                    "amount": "10.50",
                    "transaction_type": "expense",
                    "description": "X",
                    "category_id": None,
                }
            ],
        }

        response = await async_client.post(
            "/imports/execute", json=payload, headers=_bearer(owner_token)
        )

        assert response.status_code == 403
        assert len(fake_celery_dispatch) == 0
