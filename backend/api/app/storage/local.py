# backend/api/app/storage/local.py
# Local filesystem storage adapter for the backend API endpoints.
# Writes uploaded CSV files to the shared Docker volume that the
# import-service worker also mounts to read and process files.

from pathlib import Path

from .base import StorageAdapter


class LocalAdapter(StorageAdapter):
    """Stores files on the local filesystem."""

    def __init__(self, upload_dir: str) -> None:
        self._base = Path(upload_dir).resolve()
        self._base.mkdir(parents=True, exist_ok=True)

    def _safe_path(self, file_key: str) -> Path:
        """Resolve file_key within the base directory, rejecting path traversal."""
        resolved = (self._base / file_key).resolve()
        if not str(resolved).startswith(str(self._base)):
            raise ValueError(f"Rejected unsafe file_key: {file_key!r}")
        return resolved

    def read(self, file_key: str) -> bytes:
        path = self._safe_path(file_key)
        if not path.exists():
            raise FileNotFoundError(f"File not found in local storage: {file_key!r}")
        return path.read_bytes()

    def write(self, file_key: str, data: bytes) -> str:
        path = self._safe_path(file_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return file_key

    def delete(self, file_key: str) -> None:
        self._safe_path(file_key).unlink(missing_ok=True)
