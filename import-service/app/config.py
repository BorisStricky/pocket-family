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

    # Where Celery stores task results so the backend can poll for status.
    # Must be Redis for the current setup; DynamoDB is a possible AWS alternative.
    result_backend: str = "redis://localhost:6379/1"

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
