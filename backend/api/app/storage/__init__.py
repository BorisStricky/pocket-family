# backend/api/app/storage/__init__.py
# Factory that returns the correct storage adapter based on env config.

import os

from .base import StorageAdapter
from .local import LocalAdapter
from .s3 import S3Adapter


def get_storage_backend() -> StorageAdapter:
    """Return the configured storage adapter (local filesystem or AWS S3)."""
    storage_type = os.getenv("STORAGE_BACKEND", "local")
    if storage_type == "s3":
        bucket = os.getenv("S3_BUCKET")
        region = os.getenv("S3_REGION", "us-east-1")
        if not bucket:
            raise RuntimeError("S3_BUCKET env var is required when STORAGE_BACKEND=s3")
        return S3Adapter(bucket=bucket, region=region)

    upload_dir = os.getenv("LOCAL_UPLOAD_DIR", "/uploads")
    return LocalAdapter(upload_dir=upload_dir)
