#!/usr/bin/env python3
"""
Safe DB recreate script for local/dev use.

Usage (example):
  # from host, run inside api container via docker compose
  docker compose exec api sh -c 'FORCE_RECREATE=1 python backend/scripts/recreate_db.py'

This script is intentionally defensive:
- Requires FORCE_RECREATE=1 or DEV_ENV=1 to run.
- Reads DATABASE_URL from the environment (falls back to the previous default).
- Ensures the app package is importable when run from the repo root or inside the container.
"""

import os
import sys

from sqlmodel import SQLModel, create_engine

# Make the app package importable when running from repo root or inside container
# This app package lives at backend/api/app ; adding backend/api to sys.path lets `from app.models import *` work.
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api")))

# Safety gate: require explicit env var to run
if os.getenv("FORCE_RECREATE", "0") != "1" and os.getenv("DEV_ENV", "0") != "1":
    raise SystemExit("Refusing to run: set FORCE_RECREATE=1 (or DEV_ENV=1) to confirm this will DROP ALL TABLES.")

# Prefer DATABASE_URL from environment; keep previous default for convenience (sync driver)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/expense_db"
)
# Note: for docker-compose usage you might set:
# DATABASE_URL="postgresql+psycopg://postgres:postgres@db:5432/expense_db"

# Import models so SQLModel.metadata includes all tables
from app.models import *  # noqa: F401,F403

def main():
    """Recreate the database schema from SQLModel metadata.

    WARNING: This will drop ALL TABLES. The script will only run when
    FORCE_RECREATE=1 or DEV_ENV=1 is set in the environment as a safety gate.

    Prints progress to stdout.
    """
    print(f"Using DATABASE_URL={DATABASE_URL}")
    engine = create_engine(DATABASE_URL, echo=True)

    print("Dropping all tables...")
    SQLModel.metadata.drop_all(engine)

    print("Creating all tables...")
    SQLModel.metadata.create_all(engine)

    print("Done. Database schema recreated.")

if __name__ == "__main__":
    main()
