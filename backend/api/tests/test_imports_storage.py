"""
Tests for the LocalAdapter storage backend used by the CSV import feature.

Validates:
- Round-trip: writing then reading bytes returns the same payload
- Idempotent writes: subsequent writes to the same key overwrite the prior file
- Delete removes the file and is silent for missing keys
- read() raises FileNotFoundError when the file is absent
- _safe_path rejects path-traversal payloads (../, absolute paths, embedded ..)
- Nested directories inside the upload base are created on demand

These tests use tmp_path to avoid touching the real /uploads docker volume.
"""

from pathlib import Path

import pytest

from app.storage.local import LocalAdapter


class TestLocalAdapterRoundTrip:
    """Tests verifying write → read → delete behavior on the local filesystem."""

    def test_write_then_read_returns_identical_bytes(self, tmp_path: Path):
        """Writing bytes under a file_key must return identical bytes on read.

        Verifies the basic contract of the StorageAdapter interface: a write
        followed by a read with the same key returns the original payload
        byte-for-byte. This is the core round-trip relied on by the import
        wizard (upload → store → analyze → execute → worker reads).
        """
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))
        original_bytes = b"date,amount,description\n2024-01-01,10.50,Coffee\n"

        returned_key = local_adapter.write("tenant-abc/file.csv", original_bytes)
        retrieved_bytes = local_adapter.read("tenant-abc/file.csv")

        assert returned_key == "tenant-abc/file.csv"
        assert retrieved_bytes == original_bytes

    def test_write_creates_nested_directories(self, tmp_path: Path):
        """Writes under nested keys (tenant_id/uuid.csv) must auto-create dirs.

        The upload endpoint generates keys shaped like '{tenant_id}/{uuid}.csv'.
        The adapter must transparently create the tenant subdirectory on first
        write to that tenant so the upload does not fail.
        """
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))

        local_adapter.write("tenantA/sub/dir/file.csv", b"hello")

        target_path = tmp_path / "tenantA" / "sub" / "dir" / "file.csv"
        assert target_path.exists()
        assert target_path.read_bytes() == b"hello"

    def test_write_overwrites_existing_file(self, tmp_path: Path):
        """Re-writing the same key replaces the previous content.

        Documents that the adapter does not append or version. Important so the
        import worker can safely delete by key without race conditions.
        """
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))
        local_adapter.write("file.csv", b"first")
        local_adapter.write("file.csv", b"second")

        assert local_adapter.read("file.csv") == b"second"

    def test_delete_removes_file(self, tmp_path: Path):
        """Delete must remove the file so subsequent reads fail with FileNotFoundError."""
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))
        local_adapter.write("ephemeral.csv", b"to-be-removed")
        assert (tmp_path / "ephemeral.csv").exists()

        local_adapter.delete("ephemeral.csv")

        assert not (tmp_path / "ephemeral.csv").exists()
        with pytest.raises(FileNotFoundError):
            local_adapter.read("ephemeral.csv")

    def test_delete_missing_file_is_silent(self, tmp_path: Path):
        """Deleting a non-existent file is a no-op per the StorageAdapter contract."""
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))

        # Should not raise — the contract documents silent no-op behavior
        local_adapter.delete("never-existed.csv")

    def test_read_missing_file_raises_file_not_found(self, tmp_path: Path):
        """read() must raise FileNotFoundError when the file does not exist.

        The analyze endpoint catches FileNotFoundError and converts it to a 404,
        so the contract must be honored exactly.
        """
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))

        with pytest.raises(FileNotFoundError):
            local_adapter.read("nonexistent.csv")

    def test_constructor_creates_base_directory_if_missing(self, tmp_path: Path):
        """The base upload directory should be created if it does not already exist.

        In production the /uploads docker volume exists but in tests a fresh
        tmp_path subdir might not — the adapter handles both transparently.
        """
        new_base = tmp_path / "uploads-not-yet-created"
        assert not new_base.exists()

        LocalAdapter(upload_dir=str(new_base))

        assert new_base.exists()
        assert new_base.is_dir()


class TestLocalAdapterPathTraversalProtection:
    """Tests for _safe_path's path-traversal protection.

    file_key is supplied by clients (after tenant prefix validation), so the
    adapter must defend against malicious or buggy keys trying to escape the
    upload base directory.
    """

    def test_dotdot_in_key_is_rejected(self, tmp_path: Path):
        """A file_key containing '../' that would escape the base must raise ValueError."""
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))

        with pytest.raises(ValueError, match="Rejected unsafe file_key"):
            local_adapter.write("../escape.csv", b"malicious")

    def test_deeply_nested_traversal_is_rejected(self, tmp_path: Path):
        """Multiple ../ segments that escape the base must be rejected."""
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))

        with pytest.raises(ValueError, match="Rejected unsafe file_key"):
            local_adapter.read("../../../../etc/passwd")

    def test_absolute_path_key_is_rejected(self, tmp_path: Path):
        """An absolute path as file_key must be rejected — would write outside base."""
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))

        # An absolute path resolves outside the base directory
        with pytest.raises(ValueError, match="Rejected unsafe file_key"):
            local_adapter.write("/tmp/evil.csv", b"x")

    def test_dotdot_inside_legitimate_prefix_is_rejected(self, tmp_path: Path):
        """'tenantA/../escape' resolves outside the tenant dir and must be rejected."""
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))

        # tenantA/../../escape.csv would resolve to tmp_path's parent
        with pytest.raises(ValueError, match="Rejected unsafe file_key"):
            local_adapter.read("tenantA/../../escape.csv")

    def test_legitimate_nested_key_is_accepted(self, tmp_path: Path):
        """A normal '{tenant_id}/{uuid}.csv' key must pass validation.

        Sanity check that the protection does not over-reach and reject the
        well-formed keys produced by the upload endpoint.
        """
        local_adapter = LocalAdapter(upload_dir=str(tmp_path))

        # Should succeed without raising
        local_adapter.write(
            "11111111-1111-1111-1111-111111111111/abc.csv", b"ok"
        )
        retrieved = local_adapter.read(
            "11111111-1111-1111-1111-111111111111/abc.csv"
        )
        assert retrieved == b"ok"
