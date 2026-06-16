"""Hardening tests for the transactions router.

Covers the two ship-blocking defects and the mandatory multi-tenant isolation
gap surfaced by the QCSD development swarm:

- Blocker 1 (Security C-1): create_transaction must reject an account that is not
  owned by the active user nor shared with the active tenant (cross-tenant write).
- Blocker 2: editing or deleting a transaction must reverse/re-apply the account
  balance so money stays correct.
- I-1: transactions must be isolated across tenants (list filters, cross-tenant
  read returns 404).

These use the sync `client` fixture and a file-backed SQLite DB shared across the
session, so every test uses unique emails to stay order-independent.
"""
from decimal import Decimal

from tests.helpers import signup_and_auth, auth_header


def _create_account(client, headers, name, balance):
    """Create an account and return its serialized JSON."""
    response = client.post(
        "/accounts",
        json={"name": name, "type": "cash", "currency": "USD", "balance": balance},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def _create_category(client, headers, name="Dining", kind="expense"):
    """Create a category and return its serialized JSON."""
    response = client.post("/categories", json={"name": name, "kind": kind}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _create_transaction(client, headers, account_id, category_id, amount, transaction_type="expense"):
    """Create a transaction and return the API response (not asserted here)."""
    payload = {
        "account_id": account_id,
        "category_id": category_id,
        "amount": amount,
        "currency": "USD",
        "transaction_date": "2025-03-01",
        "transaction_type": transaction_type,
        "description": "Hardening test",
    }
    return client.post("/transactions", json=payload, headers=headers)


def _get_balance(client, headers, account_id) -> Decimal:
    """Read an account's current balance as a Decimal (owner sees the real value)."""
    response = client.get(f"/accounts/{account_id}", headers=headers)
    assert response.status_code == 200, response.text
    return Decimal(response.json()["balance"])


# ---------------------------------------------------------------------------
# Blocker 1 — cross-tenant account write in create_transaction
# ---------------------------------------------------------------------------
def test_create_transaction_rejects_account_from_another_user(client):
    """A member cannot post a transaction against an account they neither own nor share."""
    # Arrange: owner with an account, plus an unrelated attacker user.
    owner = signup_and_auth(client, "b1_owner@test.com", "OwnerPw1!", "B1Owner")
    owner_headers = auth_header(owner["access_token"])
    owner_account = _create_account(client, owner_headers, "Owner Wallet", "100.00")

    attacker = signup_and_auth(client, "b1_attacker@test.com", "AttackPw1!", "B1Attacker")
    attacker_headers = auth_header(attacker["access_token"])
    attacker_category = _create_category(client, attacker_headers)

    # Act: attacker tries to write a transaction against the owner's account UUID.
    response = _create_transaction(
        client, attacker_headers, owner_account["id"], attacker_category["id"], "25.00"
    )

    # Assert: access is denied and the owner's balance is untouched.
    assert response.status_code == 403, response.text
    assert _get_balance(client, owner_headers, owner_account["id"]) == Decimal("100.00")


def test_create_transaction_succeeds_for_owned_account(client):
    """The owner can post against their own account and the balance updates."""
    owner = signup_and_auth(client, "b1_self@test.com", "SelfPw1!", "B1Self")
    headers = auth_header(owner["access_token"])
    account = _create_account(client, headers, "Self Wallet", "100.00")
    category = _create_category(client, headers)

    response = _create_transaction(client, headers, account["id"], category["id"], "40.00")

    assert response.status_code == 200, response.text
    assert _get_balance(client, headers, account["id"]) == Decimal("60.00")


# ---------------------------------------------------------------------------
# Blocker 2 — balance reversal on UPDATE and DELETE
# ---------------------------------------------------------------------------
def test_update_transaction_amount_rebalances_account(client):
    """Editing the amount reverses the old effect and applies the new one."""
    user = signup_and_auth(client, "b2_update@test.com", "UpdatePw1!", "B2Update")
    headers = auth_header(user["access_token"])
    account = _create_account(client, headers, "Update Wallet", "100.00")
    category = _create_category(client, headers)

    created = _create_transaction(client, headers, account["id"], category["id"], "30.00").json()
    assert _get_balance(client, headers, account["id"]) == Decimal("70.00")

    # Act: reduce the expense from 30 to 10 → balance should rise to 90.
    update_response = client.patch(
        f"/transactions/{created['id']}", json={"amount": "10.00"}, headers=headers
    )
    assert update_response.status_code == 200, update_response.text

    # Assert: 100 - 10 = 90, proving the original -30 was reversed.
    assert _get_balance(client, headers, account["id"]) == Decimal("90.00")


def test_update_transaction_type_flips_balance_direction(client):
    """Changing expense→income reverses the debit and applies a credit."""
    user = signup_and_auth(client, "b2_type@test.com", "TypePw1!", "B2Type")
    headers = auth_header(user["access_token"])
    account = _create_account(client, headers, "Type Wallet", "100.00")
    category = _create_category(client, headers)

    created = _create_transaction(client, headers, account["id"], category["id"], "20.00").json()
    assert _get_balance(client, headers, account["id"]) == Decimal("80.00")

    update_response = client.patch(
        f"/transactions/{created['id']}", json={"transaction_type": "income"}, headers=headers
    )
    assert update_response.status_code == 200, update_response.text

    # 100, then +20 income instead of -20 expense → 120.
    assert _get_balance(client, headers, account["id"]) == Decimal("120.00")


def test_update_transaction_account_moves_balance_between_accounts(client):
    """Reassigning a transaction's account reverses the old account and debits the new."""
    user = signup_and_auth(client, "b2_move@test.com", "MovePw1!", "B2Move")
    headers = auth_header(user["access_token"])
    source_account = _create_account(client, headers, "Source", "100.00")
    target_account = _create_account(client, headers, "Target", "100.00")
    category = _create_category(client, headers)

    created = _create_transaction(client, headers, source_account["id"], category["id"], "25.00").json()
    assert _get_balance(client, headers, source_account["id"]) == Decimal("75.00")

    update_response = client.patch(
        f"/transactions/{created['id']}", json={"account_id": target_account["id"]}, headers=headers
    )
    assert update_response.status_code == 200, update_response.text

    # Source restored to 100; target debited to 75.
    assert _get_balance(client, headers, source_account["id"]) == Decimal("100.00")
    assert _get_balance(client, headers, target_account["id"]) == Decimal("75.00")


def test_delete_transaction_reverses_account_balance(client):
    """Deleting a transaction restores the account balance it had affected."""
    user = signup_and_auth(client, "b2_delete@test.com", "DeletePw1!", "B2Delete")
    headers = auth_header(user["access_token"])
    account = _create_account(client, headers, "Delete Wallet", "100.00")
    category = _create_category(client, headers)

    created = _create_transaction(client, headers, account["id"], category["id"], "35.00").json()
    assert _get_balance(client, headers, account["id"]) == Decimal("65.00")

    delete_response = client.delete(f"/transactions/{created['id']}", headers=headers)
    assert delete_response.status_code in (200, 204), delete_response.text

    assert _get_balance(client, headers, account["id"]) == Decimal("100.00")


# ---------------------------------------------------------------------------
# I-1 — cross-tenant isolation for transactions
# ---------------------------------------------------------------------------
def test_list_transactions_excludes_other_tenants(client):
    """A user never sees another tenant's transactions in the default tenant scope."""
    owner = signup_and_auth(client, "iso_owner@test.com", "IsoPw1!", "IsoOwner")
    owner_headers = auth_header(owner["access_token"])
    owner_account = _create_account(client, owner_headers, "Iso Wallet", "100.00")
    owner_category = _create_category(client, owner_headers)
    created = _create_transaction(
        client, owner_headers, owner_account["id"], owner_category["id"], "10.00"
    ).json()

    other = signup_and_auth(client, "iso_other@test.com", "OtherPw1!", "IsoOther")
    other_headers = auth_header(other["access_token"])

    list_response = client.get("/transactions", headers=other_headers)
    assert list_response.status_code == 200, list_response.text
    assert all(transaction["id"] != created["id"] for transaction in list_response.json())


def test_get_transaction_from_another_tenant_returns_404(client):
    """Fetching a transaction outside the active tenant is not found (isolation)."""
    owner = signup_and_auth(client, "iso_get_owner@test.com", "IsoGetPw1!", "IsoGetOwner")
    owner_headers = auth_header(owner["access_token"])
    owner_account = _create_account(client, owner_headers, "Iso Get Wallet", "100.00")
    owner_category = _create_category(client, owner_headers)
    created = _create_transaction(
        client, owner_headers, owner_account["id"], owner_category["id"], "10.00"
    ).json()

    other = signup_and_auth(client, "iso_get_other@test.com", "OtherGetPw1!", "IsoGetOther")
    other_headers = auth_header(other["access_token"])

    get_response = client.get(f"/transactions/{created['id']}", headers=other_headers)
    assert get_response.status_code == 404, get_response.text
