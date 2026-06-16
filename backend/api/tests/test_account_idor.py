"""IDOR access-control tests for GET /accounts/{id} (Security H-1).

An authenticated user must not be able to read another user's account metadata
(owner name/PII, type, currency) by guessing the account UUID. Access is allowed
only to the owner or to a member of a tenant the account is shared with.
"""
from tests.helpers import signup_and_auth, auth_header


def _create_account(client, headers, name="Wallet", balance="50.00"):
    response = client.post(
        "/accounts",
        json={"name": name, "type": "cash", "currency": "USD", "balance": balance},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_get_account_owned_by_other_user_returns_404(client):
    """An unrelated user gets 404 (not the account body) for someone else's account."""
    owner = signup_and_auth(client, "idor_owner@test.com", "IdorPw1!", "IdorOwner")
    owner_headers = auth_header(owner["access_token"])
    account = _create_account(client, owner_headers, "Private Wallet")

    stranger = signup_and_auth(client, "idor_stranger@test.com", "StrangerPw1!", "IdorStranger")
    stranger_headers = auth_header(stranger["access_token"])

    response = client.get(f"/accounts/{account['id']}", headers=stranger_headers)

    assert response.status_code == 404, response.text


def test_get_own_account_succeeds(client):
    """The owner can still read their own account (no regression)."""
    owner = signup_and_auth(client, "idor_self@test.com", "SelfPw1!", "IdorSelf")
    headers = auth_header(owner["access_token"])
    account = _create_account(client, headers, "My Wallet")

    response = client.get(f"/accounts/{account['id']}", headers=headers)

    assert response.status_code == 200, response.text
    assert response.json()["id"] == account["id"]
