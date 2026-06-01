# backend/api/app/storage/base.py
# Abstract base class for file storage backends.
# Identical interface to import-service/app/storage/base.py so both
# services share the same adapter contract (local volume or S3).

from abc import ABC, abstractmethod


class StorageAdapter(ABC):
    """Abstract file storage interface used by the import API endpoints."""

    @abstractmethod
    def read(self, file_key: str) -> bytes:
        """Return raw bytes for file_key. Raises FileNotFoundError if missing."""
        ...

    @abstractmethod
    def write(self, file_key: str, data: bytes) -> str:
        """Persist data under file_key and return the key."""
        ...

    @abstractmethod
    def delete(self, file_key: str) -> None:
        """Remove the file at file_key. Silent no-op if it does not exist."""
        ...
