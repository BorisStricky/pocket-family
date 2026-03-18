import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routers import auth, tenants, accounts, categories, transactions, budgets

app = FastAPI(title="Expense SaaS API")

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
    """
    await init_db()

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
