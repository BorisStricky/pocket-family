# tests/helpers.py
# Helper utilities used by tests in the test suite.
#
# Purpose:
# - Provide a simple helper to sign up a user and return auth tokens for tests
# - Make the helper resilient so tests are idempotent when run in a shared,
#   session-scoped test database (the common cause of flaky tests when running
#   entire files or the whole suite).
#
# Strategy:
# - Attempt to sign up via POST /auth/signup
# - If signup succeeds return the tokens
# - If signup fails with a 400 "Email already registered" error, automatically
#   fall back to POST /auth/login to obtain tokens for the existing account
# - For any other unexpected response, assert so the test fails loudly and we
#   can investigate unexpected API behavior.
#
# This approach is minimal, keeps application code unchanged, and ensures tests
# can be executed individually or together without order-dependent failures.

from backend.api.app.models import User
from backend.api.app.auth import decode_access_token
from sqlmodel import select
from datetime import datetime


def signup_and_auth(client, email="user@example.com", password="secret123", name="User"):
    """Attempt to register a user and return auth tokens.

    Behavior:
    - Try POST /auth/signup. If it returns 200, return the tokens.
    - If signup returns 400 with detail "Email already registered", then
      perform a login (POST /auth/login) using the provided credentials and
      return tokens obtained from login. This makes tests idempotent when the
      user was already created in a previous test run within the same DB.
    - For any other error response, assert False so the test fails and the
      unexpected behavior is investigated.

    Returns:
        dict with keys: access_token, refresh_token (when available in test mode), user_email
    """
    # Try to create the user first
    signup_response = client.post(
        "/auth/signup",
        json={"email": email, "password": password, "name": name},
    )

    if signup_response.status_code == 200:
        tokens = signup_response.json()
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "user_email": email,
        }

    # If the email is already registered, attempt to login instead of failing
    if signup_response.status_code == 400:
        # Safely parse response to check for expected error detail
        try:
            detail = signup_response.json().get("detail", "")
        except Exception:
            detail = ""

        if "Email already registered" in detail:
            login_response = client.post("/auth/login", json={"email": email, "password": password})
            assert login_response.status_code == 200, f"Login fallback failed: {login_response.text}"
            tokens = login_response.json()
            return {
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "user_email": email,
            }

    # For any other failure, raise an assertion so test fails with context
    assert False, f"Unable to signup or login user {email}: {signup_response.status_code} {signup_response.text}"


def auth_header(access_token: str):
    """Return an Authorization header dict for the given access token.

    This small helper keeps tests concise when sending authenticated requests.
    """
    return {"Authorization": f"Bearer {access_token}"}
