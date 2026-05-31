# import-service/tests/conftest.py
# Shared pytest fixtures for the import-service unit tests.
#
# Goal: exercise the real `process_import` core against an in-memory SQLite
# database — no Postgres, no network, no boto3/SQS. The production tables in
# app/db.py use PostgreSQL-specific UUID columns and build a psycopg2 engine at
# import time, so for tests we define SQLite-compatible mirror tables and
# monkeypatch the core module to use a SQLite-backed session + those tables.

import sys
from contextlib import contextmanager
from pathlib import Path
from uuid import UUID

import pytest
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    TypeDecorator,
    create_engine,
)
from sqlalchemy.orm import sessionmaker

# Ensure the import-service root (containing the `app` package) is importable
# when pytest is run from that directory.
IMPORT_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(IMPORT_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(IMPORT_SERVICE_ROOT))


class UUIDString(TypeDecorator):
    """A String column that accepts real `uuid.UUID` objects, storing them as their
    canonical hyphenated string.

    Why this exists: the production core builds `uuid.UUID` objects (uuid4() for new
    rows, UUID(...) parsed from the payload) and uses them both as INSERT values and
    in the idempotency-claim `WHERE id = :id` clause. Postgres' UUID columns accept
    them natively, but SQLite does not. Crucially, if a bare `UUID` reaches SQLite it gets
    rendered **without hyphens** (`111…` 32-char hex) — which would NOT match the
    hyphenated id strings the tests seed, so the claim's `WHERE id = UUID(...)` would
    silently match zero rows and the import would wrongly report "skipped".
    Coercing to `str(value)` here (hyphenated) at the bind layer makes the INSERT
    value and the WHERE parameter the same string form, exactly as Postgres treats
    them interchangeably — deterministic, and with no change to product code.
    """

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)


# SQLite-compatible mirror of the three tables the import core touches. The
# production schema (app/db.py) uses PGUUID + Postgres enums; SQLite has neither,
# so UUID columns use the UUIDString decorator above and enum columns use String.
# Column names and the subset of behavior the core relies on (insert rows, add to
# account.balance, conditional status update) match exactly.
sqlite_metadata = MetaData()

sqlite_transaction_table = Table(
    "transaction",
    sqlite_metadata,
    Column("id", UUIDString, primary_key=True),
    Column("tenant_id", UUIDString, nullable=False),
    Column("account_id", UUIDString, nullable=True),
    Column("category_id", UUIDString, nullable=True),
    Column("transaction_date", Date, nullable=False),
    Column("transaction_type", String, nullable=False),
    Column("amount", Numeric(18, 2), nullable=False),
    Column("currency", String, nullable=False),
    Column("created_by", UUIDString, nullable=False),
    Column("description", String, nullable=True),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    Column("reconciled", Boolean, default=False),
    Column("source", String, nullable=False),
)

sqlite_account_table = Table(
    "account",
    sqlite_metadata,
    Column("id", UUIDString, primary_key=True),
    Column("balance", Numeric(18, 2), nullable=False),
)

sqlite_import_job_table = Table(
    "importjob",
    sqlite_metadata,
    Column("id", UUIDString, primary_key=True),
    Column("status", String, nullable=False),
    Column("imported_rows", Integer, nullable=False),
    Column("error_message", String, nullable=True),
    Column("updated_at", DateTime, nullable=False),
    Column("completed_at", DateTime, nullable=True),
)


@pytest.fixture()
def sqlite_session_factory():
    """Yield a sessionmaker bound to a fresh in-memory SQLite database.

    A single shared connection is used (StaticPool) so every session in the test
    sees the same in-memory database — otherwise SQLite would create a separate
    empty database per connection.
    """
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    sqlite_metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    yield session_factory
    engine.dispose()


@pytest.fixture()
def patched_import_core(monkeypatch, sqlite_session_factory):
    """Patch the import core to run against SQLite and skip real storage.

    Returns the `import_csv` module so tests can call `process_import` and
    inspect/seed data through the SQLite-backed `get_session()`.
    """
    from app.tasks import import_csv

    @contextmanager
    def sqlite_get_session():
        # Mirror the production get_session() contract: rollback on error,
        # always close. Tests rely on explicit commits inside process_import.
        session = sqlite_session_factory()
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    # Point the core at the SQLite session + SQLite-compatible tables. Both the
    # core module name and the imported `get_session` alias inside it must be
    # patched (it does `from ..db import get_session`).
    monkeypatch.setattr(import_csv, "get_session", sqlite_get_session)
    monkeypatch.setattr(import_csv, "transaction_table", sqlite_transaction_table)
    monkeypatch.setattr(import_csv, "account_table", sqlite_account_table)
    monkeypatch.setattr(import_csv, "import_job_table", sqlite_import_job_table)

    # Make storage cleanup a no-op so no real local/S3 backend is touched.
    class _NoOpStorage:
        def delete(self, file_key):
            return None

    monkeypatch.setattr(import_csv, "get_storage", lambda: _NoOpStorage())

    return import_csv
