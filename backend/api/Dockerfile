# Production backend image — uses uv for fast, deterministic installs
FROM python:3.11-slim

# Copy uv binary from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install production dependencies only (no dev extras)
# Build context is ./backend (set in docker-compose.yaml),
# so pyproject.toml and uv.lock are at the context root.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-editable

# Copy the contents of backend/api/ directly into /app/.
# COPY api/ . copies the directory's *contents* (not the directory itself),
# so the app package lands at /app/app/main.py where uvicorn expects it.
COPY api/ .

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
