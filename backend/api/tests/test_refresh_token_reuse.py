"""Refresh-token reuse detection tests (Security H-2).

Refresh tokens are single-use and rotate on every /auth/refresh. Replaying an
already-rotated token signals theft, so the whole token family is revoked — both
the attacker's and the victim's descendant tokens stop working, forcing re-login.

TEST_MODE returns the raw refresh token in the response body; the endpoint itself
reads the token from the HttpOnly cookie, so each call sets that cookie explicitly.
"""
from tests.helpers import signup_and_auth


def _refresh_with(client, refresh_token):
    """Call /auth/refresh presenting the given refresh token via cookie."""
    client.cookies.set("refresh_token", refresh_token)
    return client.post("/auth/refresh")


def test_refresh_rotates_token_once(client):
    """A valid refresh token rotates to a new token exactly once."""
    user = signup_and_auth(client, "rt_rotate@test.com", "RotatePw1!", "RtRotate")
    original_token = user["refresh_token"]
    assert original_token is not None  # TEST_MODE exposes the raw token

    response = _refresh_with(client, original_token)

    assert response.status_code == 200, response.text
    assert response.json()["refresh_token"] != original_token


def test_reused_refresh_token_is_rejected_and_revokes_family(client):
    """Replaying a rotated token is rejected AND invalidates the rotated successor."""
    user = signup_and_auth(client, "rt_reuse@test.com", "ReusePw1!", "RtReuse")
    original_token = user["refresh_token"]

    # First rotation succeeds and yields the new (current) token.
    first_rotation = _refresh_with(client, original_token)
    assert first_rotation.status_code == 200, first_rotation.text
    rotated_token = first_rotation.json()["refresh_token"]

    # Act: replay the original (now-revoked) token — this is the reuse signal.
    reuse_response = _refresh_with(client, original_token)

    # Assert: reuse is rejected...
    assert reuse_response.status_code == 401, reuse_response.text
    # ...and the legitimate successor token is also revoked (whole family killed).
    successor_response = _refresh_with(client, rotated_token)
    assert successor_response.status_code == 401, successor_response.text
