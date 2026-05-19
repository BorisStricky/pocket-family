import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter instance. Importing this from both main.py (for
# app-state registration) and routers (for per-route @limiter.limit decorators)
# keeps the limit registry consistent and avoids circular imports.
#
# Rate limiting is disabled in TEST_MODE so the signup_and_auth helper's
# /auth/login fallback doesn't exhaust the per-minute cap across the test suite.
_rate_limiting_enabled = os.environ.get("TEST_MODE", "0") != "1"

limiter = Limiter(key_func=get_remote_address, enabled=_rate_limiting_enabled)
