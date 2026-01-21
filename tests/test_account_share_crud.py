import pytest
from tests.helpers import signup_and_auth, auth_header


# Fixture: account_share_factory
# Purpose:
# - Create an owner user and a tenant for sharing
# - Create a member user and add membership to that tenant
# - Create an owner-owned account
# - Create an account share for that tenant
# - Return useful context for focused tests (create, read, list, duplicate, revoke)
@pytest.fixture
def account_share_factory(client):
    # Owner who will share
    owner = signup_and_auth(client, "share_owner@test.com", "SharePw1!", "Owner")
    owner_header = auth_header(owner["access_token"])

    # Create tenant
    tenant_response = client.post("/tenants", json={"name": "ShareFamily"}, headers=owner_header)
    assert tenant_response.status_code == 200, tenant_response.text
    tenant = tenant_response.json()

    # Create invitee user
    member = signup_and_auth(client, "family_member@test.com", "MemberPw1!", "Member")
    member_header = auth_header(member["access_token"])

    # Switch into the tenant to obtain a tenant-scoped token, then create membership for invitee
    switch_response = client.post(f"/tenants/{tenant['id']}/switch", headers=owner_header)
    assert switch_response.status_code == 200, switch_response.text
    tenant_token = switch_response.json()["access_token"]
    tenant_header = auth_header(tenant_token)

    membership_response = client.post(f"/tenants/{tenant['id']}/members", json={"user_email": "family_member@test.com", "role": "member"}, headers=tenant_header)
    assert membership_response.status_code == 200, membership_response.text
    membership = membership_response.json()

    # Owner creates an account
    account_response = client.post("/accounts", json={"name": "Owner CC", "type": "credit", "currency": "USD", "balance": "1000.00"}, headers=owner_header)
    assert account_response.status_code == 200, account_response.text
    account = account_response.json()

    # Owner shares the account with membership (new tenant-based API)
    payload = {"tenant_id": tenant["id"], "visibility": "visible"}
    share_response = client.post(f"/accounts/{account['id']}/shares", json=payload, headers=owner_header)
    assert share_response.status_code == 200, share_response.text
    share = share_response.json()

    return {
        "owner_header": owner_header,
        "member_header": member_header,
        "tenant_header": tenant_header,
        "tenant": tenant,
        "tenant_id": tenant["id"],
        "membership": membership,
        "account": account,
        "account_id": account["id"],
        "share": share,
        "share_id": share["id"],
        "share_payload": payload,
    }


# 1) Create: validate the factory created a share and returned expected shape
def test_account_share_create_and_binding(account_share_factory, client):
    share = account_share_factory["share"]
    account = account_share_factory["account"]
    tenant = account_share_factory["tenant"]

    assert share["account_id"] == account["id"]
    assert share["tenant_id"] == tenant["id"]


# 2) Visibility: both owner and member can read the account
def test_account_share_allows_owner_and_member_access(account_share_factory, client):
    account = account_share_factory["account"]
    owner_header = account_share_factory["owner_header"]
    member_header = account_share_factory["member_header"]

    owner_read_response = client.get(f"/accounts/{account['id']}", headers=owner_header)
    assert owner_read_response.status_code == 200, owner_read_response.text

    member_read_response = client.get(f"/accounts/{account['id']}", headers=member_header)
    assert member_read_response.status_code == 200, member_read_response.text


# 3) List shares for account
def test_list_account_shares_includes_created_share(account_share_factory, client):
    account = account_share_factory["account"]
    owner_header = account_share_factory["owner_header"]
    share_id = account_share_factory["share_id"]

    shares_list_response = client.get(f"/accounts/{account['id']}/shares", headers=owner_header)
    assert shares_list_response.status_code == 200, shares_list_response.text
    assert any(s["id"] == share_id for s in shares_list_response.json())


# 4) Duplicate share returns 409
def test_duplicate_account_share_returns_conflict(account_share_factory, client):
    account = account_share_factory["account"]
    owner_header = account_share_factory["owner_header"]
    payload = account_share_factory["share_payload"]

    duplicate_response = client.post(f"/accounts/{account['id']}/shares", json=payload, headers=owner_header)
    assert duplicate_response.status_code == 409
    assert "already exists" in duplicate_response.json()["detail"]


# 5) Revoke share
def test_revoke_account_share_by_tenant_id(account_share_factory, client):
    account = account_share_factory["account"]
    owner_header = account_share_factory["owner_header"]
    tenant_id = account_share_factory["tenant_id"]
    share_id = account_share_factory["share_id"]

    delete_share_response = client.delete(f"/accounts/{account['id']}/shares/{tenant_id}", headers=owner_header)
    assert delete_share_response.status_code in (200, 204), delete_share_response.text

    #check that the revoked account is not in the list anymore
    shares_list_response = client.get(f"/accounts/{account['id']}/shares", headers=owner_header)
    assert shares_list_response.status_code == 200, shares_list_response.text
    assert not any(s["id"] == share_id for s in shares_list_response.json())
