from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routers import auth, tenants, accounts, categories, transactions

app = FastAPI(title="Expense SaaS API")

# Add CORS middleware to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server (default)
        "http://localhost:5174",  # Vite dev server (alternative port)
        "http://localhost:3000",  # Alternative frontend port
    ],
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
