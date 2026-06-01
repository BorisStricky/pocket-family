# import-service/Dockerfile
# Celery worker that processes CSV import jobs dispatched by the main backend.
# Runs in its own container so import processing never blocks API responses.

FROM python:3.11-slim

# Copy the uv binary from the official image for fast, reproducible installs
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install all worker dependencies directly into the system Python.
# We use --system so the celery command is available without activating a venv.
# Package versions are pinned to match the import-service pyproject.toml.
COPY pyproject.toml ./
RUN uv pip install --system --no-cache \
    "celery==5.4.0" \
    "kombu[sqs]>=5.3.0" \
    "redis==5.1.1" \
    "sqlalchemy==2.0.35" \
    "psycopg2-binary>=2.9.9" \
    "boto3>=1.34.0" \
    "python-dateutil>=2.9.0" \
    "pydantic-settings>=2.6.0"

# Copy application code after dependencies are installed for better layer caching
COPY app/ ./app/

# Start the Celery worker with 2 concurrent task slots.
# The concurrency is intentionally low — imports are I/O heavy (DB writes) and
# we want to avoid overwhelming the database with concurrent bulk inserts.
CMD ["python", "-m", "celery", "-A", "app.celery_app:celery_app", "worker", \
     "--loglevel=info", "--concurrency=2"]
