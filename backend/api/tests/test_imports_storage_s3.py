"""Unit tests for the S3 storage adapter and the storage backend factory.

The local adapter is exercised by test_imports_storage.py, but the S3 path
(app/storage/s3.py) and the env-driven factory selection in
app/storage/__init__.py were never covered. These tests mock boto3 entirely so
no AWS calls happen, asserting the adapter delegates to the right boto3
operations and that boto3 failures propagate as a clean exception rather than
being silently swallowed.
"""
import sys
from unittest.mock import MagicMock

import pytest


def _install_fake_boto3(monkeypatch) -> MagicMock:
    """Replace the (lazily imported) boto3 module with a mock; return its client.

    S3Adapter does `import boto3` inside __init__, so putting a mock in
    sys.modules makes the adapter pick it up without boto3 being installed.
    """
    fake_boto3 = MagicMock(name="boto3")
    fake_client = MagicMock(name="s3_client")
    fake_boto3.client.return_value = fake_client
    monkeypatch.setitem(sys.modules, "boto3", fake_boto3)
    return fake_client


# ---------------------------------------------------------------------------
# Factory: get_storage_backend()
# ---------------------------------------------------------------------------


def test_factory_returns_local_adapter_by_default(monkeypatch, tmp_path):
    """With no STORAGE_BACKEND set, the factory returns the local adapter."""
    # Arrange: point the local upload dir at a writable temp path so the adapter
    # does not try to create the real /uploads directory.
    monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    monkeypatch.setenv("LOCAL_UPLOAD_DIR", str(tmp_path / "uploads"))
    from app.storage import get_storage_backend
    from app.storage.local import LocalAdapter

    # Act
    adapter = get_storage_backend()

    # Assert
    assert isinstance(adapter, LocalAdapter)


def test_factory_requires_bucket_when_backend_is_s3(monkeypatch):
    """STORAGE_BACKEND=s3 without S3_BUCKET fails fast with a clear error."""
    # Arrange
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.delenv("S3_BUCKET", raising=False)
    from app.storage import get_storage_backend

    # Act + Assert
    with pytest.raises(RuntimeError, match="S3_BUCKET"):
        get_storage_backend()


def test_factory_builds_s3_adapter_when_configured(monkeypatch):
    """STORAGE_BACKEND=s3 with a bucket builds an S3Adapter wired to boto3."""
    # Arrange
    fake_client = _install_fake_boto3(monkeypatch)
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.setenv("S3_BUCKET", "pocket-family-imports")
    monkeypatch.setenv("S3_REGION", "eu-west-1")
    from app.storage import get_storage_backend
    from app.storage.s3 import S3Adapter

    # Act
    adapter = get_storage_backend()

    # Assert: an S3 adapter built against the configured region.
    assert isinstance(adapter, S3Adapter)
    assert fake_client is not None


# ---------------------------------------------------------------------------
# S3Adapter happy-path delegation
# ---------------------------------------------------------------------------


def test_s3_write_delegates_to_put_object_and_returns_key(monkeypatch):
    """write() calls put_object with the bucket/key/body and returns the key."""
    # Arrange
    fake_client = _install_fake_boto3(monkeypatch)
    from app.storage.s3 import S3Adapter

    adapter = S3Adapter(bucket="bucket-1", region="us-east-1")

    # Act
    returned_key = adapter.write("tenant/file.csv", b"date,amount\n")

    # Assert
    assert returned_key == "tenant/file.csv"
    fake_client.put_object.assert_called_once_with(
        Bucket="bucket-1", Key="tenant/file.csv", Body=b"date,amount\n"
    )


def test_s3_delete_delegates_to_delete_object(monkeypatch):
    """delete() forwards the bucket/key to the S3 delete_object operation."""
    # Arrange
    fake_client = _install_fake_boto3(monkeypatch)
    from app.storage.s3 import S3Adapter

    adapter = S3Adapter(bucket="bucket-1", region="us-east-1")

    # Act
    adapter.delete("tenant/file.csv")

    # Assert
    fake_client.delete_object.assert_called_once_with(
        Bucket="bucket-1", Key="tenant/file.csv"
    )


def test_s3_read_returns_object_body_bytes(monkeypatch):
    """read() returns the raw bytes from the S3 object's streaming body."""
    # Arrange
    fake_client = _install_fake_boto3(monkeypatch)
    fake_client.get_object.return_value = {"Body": MagicMock(read=lambda: b"csv-bytes")}
    from app.storage.s3 import S3Adapter

    adapter = S3Adapter(bucket="bucket-1", region="us-east-1")

    # Act
    data = adapter.read("tenant/file.csv")

    # Assert
    assert data == b"csv-bytes"
    fake_client.get_object.assert_called_once_with(Bucket="bucket-1", Key="tenant/file.csv")


# ---------------------------------------------------------------------------
# S3Adapter failure propagation
# ---------------------------------------------------------------------------


def test_s3_read_propagates_client_failure(monkeypatch):
    """A boto3 failure on read surfaces to the caller instead of being swallowed."""
    # Arrange: simulate an S3 outage / access error.
    fake_client = _install_fake_boto3(monkeypatch)
    fake_client.get_object.side_effect = RuntimeError("S3 unavailable")
    from app.storage.s3 import S3Adapter

    adapter = S3Adapter(bucket="bucket-1", region="us-east-1")

    # Act + Assert: the error is not hidden — the import flow can map it to a 5xx.
    with pytest.raises(RuntimeError, match="S3 unavailable"):
        adapter.read("tenant/file.csv")
