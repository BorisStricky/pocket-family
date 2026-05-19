import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .db import init_db
from .routers import auth, tenants, accounts, categories, transactions, budgets
from .auth import is_demo_mode
from .rate_limit import limiter

app = FastAPI(title="Expense SaaS API")

# Wire the shared rate limiter into the app. Per-route limits are declared via
# the @limiter.limit(...) decorator on individual endpoints (e.g. /auth/login).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Read allowed CORS origins from the environment so the same Docker image can
# be used in both dev and production without rebuilding.
# The value is a comma-separated string, e.g.:
#   CORS_ORIGINS="http://localhost:3000,http://192.168.1.101:3000"
# Falls back to common dev origins if the variable is not set.
_cors_origins_raw = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://192.168.1.101:5173",
)
cors_origins = [origin.strip() for origin in _cors_origins_raw.split(",")]

# Add CORS middleware to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    # Restrict to only necessary HTTP methods for security
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    # Restrict to only necessary headers for security
    allow_headers=["Content-Type", "Authorization"],
)

@app.on_event("startup")
async def on_startup():
    """Application startup handler.

    Initializes the database schema (using init_db()). This runs during
    application startup and is suitable for development/test environments.

    On demo instances (DEMO_MODE=1) also ensures the shared demo account
    exists so a fresh deploy is immediately usable.
    """
    await init_db()

    if is_demo_mode():
        # Lazy import to keep the scripts/ directory off the normal import
        # path for non-demo runs.
        import logging
        import sys
        from pathlib import Path

        # Local layout:  backend/api/app/main.py  → backend/scripts/
        # Docker layout: /app/app/main.py        → /app/scripts/
        # (Dockerfile flattens backend/api/ into /app/ but keeps scripts/ at /app/scripts/.)
        here = Path(__file__).resolve()
        for scripts_dir in (here.parent.parent.parent / "scripts", here.parent.parent / "scripts"):
            if scripts_dir.is_dir():
                sys.path.append(str(scripts_dir))
                break
        from ensure_demo_user import ensure_demo_user  # type: ignore

        try:
            await ensure_demo_user()
        except Exception:
            # Don't crash the API if the seed step fails — log and continue
            # so an operator can fix it without bringing the service down.
            logging.getLogger(__name__).exception("Failed to ensure demo user")

@app.get("/ping")
async def ping():
    """Health-check endpoint returning a simple ok response."""
    return {"ok": True}

app.include_router(auth.router, prefix="/auth", tags=["auth"]) 

# API routers
app.include_router(tenants.router)
app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
