# import-service/app/storage/__init__.py
# Factory that selects the storage adapter based on the STORAGE_BACKEND env var.

from .base import StorageAdapter
from .local import LocalAdapter
from .s3 import S3Adapter
from ..config import settings


def get_storage() -> StorageAdapter:
    """Return the configured storage adapter (local or S3)."""
    if settings.storage_backend == "s3":
        if not settings.s3_bucket:
            raise RuntimeError("S3_BUCKET must be set when STORAGE_BACKEND=s3")
        return S3Adapter(bucket=settings.s3_bucket, region=settings.s3_region)
    return LocalAdapter(upload_dir=settings.local_upload_dir)
