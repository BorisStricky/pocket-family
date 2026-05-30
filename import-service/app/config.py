# import-service/app/config.py
# Pydantic-based settings for the import worker.
# All values are read from environment variables so the same Docker image
# works for both local (Redis + volume) and AWS (SQS + S3) deployments.

from typing import Literal, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Celery broker URL.
    # Local dev:  redis://redis:6379/0
    # AWS SQS:    sqs://  (kombu reads AWS credentials from the environment)
    broker_url: str = "redis://localhost:6379/0"

    # Where Celery stores task results (optional).
    # Leave empty (the default) on AWS — job status is read from the importjob
    # PostgreSQL table instead, so no result backend is needed.
    # Set to redis://... in local dev if you also want Celery's built-in result store.
    result_backend: str = ""

    # Celery default queue name. Must match the SQS queue name on AWS.
    # Defaults to "celery" which is Kombu's built-in default.
    celery_default_queue: str = "celery"

    # Synchronous PostgreSQL URL (psycopg2 driver) — Celery tasks run outside
    # asyncio so we cannot use the async asyncpg driver used by the main backend.
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/pfinancedb_dev"

    # Which storage backend to use for CSV files.
    storage_backend: Literal["local", "s3"] = "local"

    # Filesystem path where uploaded CSVs are stored (used when storage_backend=local).
    # Must match the volume mount path in docker-compose.
    local_upload_dir: str = "/uploads"

    # AWS S3 bucket name (used when storage_backend=s3)
    s3_bucket: Optional[str] = None

    # AWS region for the S3 bucket
    s3_region: str = "us-east-1"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
