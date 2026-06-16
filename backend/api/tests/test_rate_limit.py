"""Rate-limiting behavior test for POST /auth/login (brute-force protection).

The shared limiter is disabled when TEST_MODE=1 (so the suite-wide login
fallback in helpers.signup_and_auth isn't throttled), which means the
`@limiter.limit("10/minute")` cap on /auth/login is never exercised by the rest
of the suite. This test re-enables the limiter for one focused case and proves
the cap actually returns 429 once exceeded — a regression that dropped the
decorator would otherwise pass silently.

monkeypatch reverts `limiter.enabled` back to False after the test, so no other
test is affected.
"""
from app.rate_limit import limiter
from tests.helpers import signup_and_auth

# Mirrors the cap declared on the /auth/login route decorator.
LOGIN_RATE_LIMIT = 10


def test_login_returns_429_after_exceeding_rate_limit(client, monkeypatch):
    """Logins succeed up to the cap, then the next attempt is rejected with 429."""
    # Arrange: a real account, and the limiter switched on for this test only.
    credentials = {"email": "ratelimit@test.com", "password": "RateLimitPw1!"}
    signup_and_auth(client, credentials["email"], credentials["password"], "RateLimit")
    monkeypatch.setattr(limiter, "enabled", True)

    # Act + Assert: the first N requests are allowed (valid creds → not 429).
    for attempt in range(LOGIN_RATE_LIMIT):
        allowed_response = client.post("/auth/login", json=credentials)
        assert allowed_response.status_code != 429, (
            f"request {attempt + 1} was throttled before the cap: "
            f"{allowed_response.status_code} {allowed_response.text}"
        )

    # The request immediately past the cap is rejected by the limiter.
    blocked_response = client.post("/auth/login", json=credentials)
    assert blocked_response.status_code == 429, blocked_response.text
