# import-service/app/storage/base.py
# Abstract base class for file storage backends.
# Both LocalAdapter and S3Adapter implement this interface so callers
# never need to know which backend is active.

from abc import ABC, abstractmethod


class StorageAdapter(ABC):
    """Abstract file storage interface."""

    @abstractmethod
    def read(self, file_key: str) -> bytes:
        """Return the raw bytes stored under file_key.

        Raises FileNotFoundError when the key does not exist.
        """
        ...

    @abstractmethod
    def write(self, file_key: str, data: bytes) -> str:
        """Persist data under file_key and return the key."""
        ...

    @abstractmethod
    def delete(self, file_key: str) -> None:
        """Remove the file at file_key. Silent no-op if it does not exist."""
        ...
