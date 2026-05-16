from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter instance. Importing this from both main.py (for
# app-state registration) and routers (for per-route @limiter.limit decorators)
# keeps the limit registry consistent and avoids circular imports.
limiter = Limiter(key_func=get_remote_address)
