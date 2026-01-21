import pytest
from tests.helpers import signup_and_auth, auth_header


# Fixture: account_factory
# Purpose:
# - Create (or obtain) a user via signup_and_auth
# - Capture the personal (default) access token and tenant id
# - Create a new account for use by tests
# - Return useful context (headers, account id, payload) so individual
#   tests can remain focused on a single behavior.
#
# This mirrors the fixture style used elsewhere in the test suite and
# centralizes setup so each test is concise and deterministic.
@pytest.fixture
def account_factory(client):
    # Sign up (or login) a test user and obtain an access token
    email = "acc_owner@test.com"
    password = "AccPw1!"
    creds = signup_and_auth(client, email, password, "AccOwner")
    personal_access_token = creds["access_token"]
    headers = auth_header(personal_access_token)

    # Discover the personal tenant id for informational purposes. Tests in
    # this file currently operate against the personal tenant that is
    # automatically created at signup. We record the id here so tests can
    # reference it if needed.
    tenants_list_response = client.get("/tenants", headers=headers)
    assert tenants_list_response.status_code == 200, tenants_list_response.text
    tenants_for_user = tenants_list_response.json()
    assert len(tenants_for_user) >= 1
    personal_tenant_id = tenants_for_user[0]["id"]

    # Create a sample account that will be used by read/list/update/delete
    # tests. Keeping a single canonical account in the fixture simplifies
    # assertions and mirrors the original combined test behavior.
    create_payload = {
        "name": "My Checking",
        "type": "credit",
        "currency": "USD",
        "balance": "100.00",
    }
    account_create_response = client.post("/accounts", json=create_payload, headers=headers)
    assert account_create_response.status_code == 200, account_create_response.text
    account = account_create_response.json()

    return {
        "email": email,
        "password": password,
        "personal_access_token": personal_access_token,
        "headers": headers,
        "personal_tenant_id": personal_tenant_id,
        "created_account": account,
        "created_account_id": account["id"],
        "create_payload": create_payload,
    }


# 1) Create: verify creating an account works as expected.
# Note: This test performs a create operation similar to the original
# combined test. It creates a fresh account (in addition to the fixture's
# account) to isolate the create behavior in its own test.
def test_account_create_basic(client):
    creds = signup_and_auth(client, "acc_creator@test.com", "AccPw1!", "AccCreator")
    headers = auth_header(creds["access_token"])

    payload = {"name": "Creator Checking", "type": "credit", "currency": "USD", "balance": "100.00"}
    account_response = client.post("/accounts", json=payload, headers=headers)
    assert account_response.status_code == 200, account_response.text
    acc = account_response.json()
    assert acc["name"] == payload["name"]
    # Balance may be returned as a string or numeric type; accept either.
    assert acc["balance"] == "100.00" or float(acc["balance"]) == 100.0


# 2) Read: fetch the account created by the fixture and validate the payload.
def test_account_read_existing_account(account_factory, client):
    headers = account_factory["headers"]
    acc_id = account_factory["created_account_id"]

    account_get_response = client.get(f"/accounts/{acc_id}", headers=headers)
    assert account_get_response.status_code == 200, account_get_response.text
    assert account_get_response.json()["id"] == acc_id


# 3) List: ensure the user's account list includes the created account.
def test_list_accounts_includes_created_account(account_factory, client):
    headers = account_factory["headers"]
    acc_id = account_factory["created_account_id"]

    accounts_list_response = client.get("/accounts", headers=headers)
    assert accounts_list_response.status_code == 200, accounts_list_response.text
    assert any(a["id"] == acc_id for a in accounts_list_response.json())


# 4) Update: modify the account name and validate the change is persisted.
def test_update_account_name(account_factory, client):
    headers = account_factory["headers"]
    acc_id = account_factory["created_account_id"]

    account_update_response = client.patch(f"/accounts/{acc_id}", json={"name": "My Checking v2"}, headers=headers)
    assert account_update_response.status_code == 200, account_update_response.text
    assert account_update_response.json()["name"] == "My Checking v2"


# 5) Delete: remove the created account and accept 200 or 204 (matching
# original behavior from the combined test).
def test_delete_account(account_factory, client):
    headers = account_factory["headers"]
    acc_id = account_factory["created_account_id"]

    account_delete_response = client.delete(f"/accounts/{acc_id}", headers=headers)
    assert account_delete_response.status_code in (200, 204), account_delete_response.text

    #after deletion list the accounts and assert the deleted one is not in
    accounts_list_response = client.get("/accounts", headers=headers)
    assert accounts_list_response.status_code == 200, accounts_list_response.text
    assert not any(a["id"] == acc_id for a in accounts_list_response.json())
