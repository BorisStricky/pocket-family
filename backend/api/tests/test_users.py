"""Tests for the /users/me profile endpoints.

Validates the language-preference round-trip added for the language-selection
feature: reading the default, updating to a supported language, rejecting an
unsupported value, and requiring authentication. These endpoints are
user-scoped (identity only), so there is no tenant-isolation surface to test
here — `get_authenticated_user` resolves the user purely from the JWT `sub`.
"""

import pytest


@pytest.mark.asyncio
async def test_read_current_user_returns_default_language(
    async_client, test_user, auth_headers
):
    """GET /users/me returns the user's profile with the default language 'en'."""
    response = await async_client.get("/users/me", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == test_user.email
    assert body["language"] == "en"
    # The public schema must never leak the password hash.
    assert "password_hash" not in body


@pytest.mark.asyncio
async def test_update_language_persists_supported_value(
    async_client, test_user, auth_headers
):
    """PATCH /users/me updates the language and the change persists on re-read."""
    update_response = await async_client.patch(
        "/users/me", json={"language": "pt-BR"}, headers=auth_headers
    )
    assert update_response.status_code == 200
    assert update_response.json()["language"] == "pt-BR"

    # Re-read to confirm the new value was committed, not just echoed back.
    read_response = await async_client.get("/users/me", headers=auth_headers)
    assert read_response.status_code == 200
    assert read_response.json()["language"] == "pt-BR"


@pytest.mark.asyncio
async def test_update_language_rejects_unsupported_value(
    async_client, test_user, auth_headers
):
    """PATCH /users/me with an unsupported language code returns 422."""
    response = await async_client.patch(
        "/users/me", json={"language": "fr"}, headers=auth_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_language_rejects_explicit_null(
    async_client, test_user, auth_headers
):
    """PATCH /users/me with an explicit null language returns 422, not 500.

    `language` is non-nullable, so an explicit `null` must be rejected at
    validation time rather than reaching the database and triggering an
    integrity error. (Omitting the field entirely remains a valid no-op,
    covered implicitly by the supported-value update test.)
    """
    response = await async_client.patch(
        "/users/me", json={"language": None}, headers=auth_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_language_with_empty_body_is_noop(
    async_client, test_user, auth_headers
):
    """PATCH /users/me with no fields leaves the language unchanged.

    Omitting `language` must not run the validator or alter stored state, so
    the user keeps the default 'en'.
    """
    response = await async_client.patch(
        "/users/me", json={}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["language"] == "en"


@pytest.mark.asyncio
async def test_read_current_user_requires_authentication(async_client):
    """GET /users/me without an Authorization header returns 401."""
    response = await async_client.get("/users/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_current_user_requires_authentication(async_client):
    """PATCH /users/me without an Authorization header returns 401."""
    response = await async_client.patch("/users/me", json={"language": "pt-BR"})
    assert response.status_code == 401
