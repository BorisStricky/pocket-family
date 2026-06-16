from uuid import uuid4

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


# ---------------------------------------------------------------------------
# Authorization of the target tenant on POST /accounts/{account_id}/shares
# (QCSD Finding 1 — broken access control). The account owner may only share
# INTO a family they are an active, non-viewer member of. These tests exercise
# the dedicated /shares endpoint, which previously only checked account ownership.
# ---------------------------------------------------------------------------


def test_create_account_share_forbidden_when_caller_is_viewer_of_target_tenant(client):
    """A viewer of the target tenant cannot share an account into it (403)."""
    # Arrange: the actor owns an account AND is the owner of a tenant, but is only
    # a VIEWER of a *different* tenant they want to share into.
    actor = signup_and_auth(client, "viewer_sharer@test.com", "ViewerPw1!", "ViewerSharer")
    actor_header = auth_header(actor["access_token"])

    # A separate user owns the target tenant and invites the actor as a viewer.
    target_owner = signup_and_auth(client, "viewer_target_owner@test.com", "OwnerPw1!", "TargetOwner")
    target_owner_header = auth_header(target_owner["access_token"])
    target_tenant_response = client.post("/tenants", json={"name": "ViewerTargetFamily"}, headers=target_owner_header)
    assert target_tenant_response.status_code == 200, target_tenant_response.text
    target_tenant = target_tenant_response.json()

    switch_response = client.post(f"/tenants/{target_tenant['id']}/switch", headers=target_owner_header)
    assert switch_response.status_code == 200, switch_response.text
    target_tenant_header = auth_header(switch_response.json()["access_token"])
    viewer_membership_response = client.post(
        f"/tenants/{target_tenant['id']}/members",
        json={"user_email": "viewer_sharer@test.com", "role": "viewer"},
        headers=target_tenant_header,
    )
    assert viewer_membership_response.status_code == 200, viewer_membership_response.text

    # Actor owns an account to share.
    account_response = client.post(
        "/accounts",
        json={"name": "Viewer Account", "type": "cash", "currency": "USD", "balance": "10.00"},
        headers=actor_header,
    )
    assert account_response.status_code == 200, account_response.text
    account = account_response.json()

    # Act: the viewer attempts to share the account into the target tenant.
    share_response = client.post(
        f"/accounts/{account['id']}/shares",
        json={"tenant_id": target_tenant["id"], "visibility": "visible"},
        headers=actor_header,
    )

    # Assert: rejected with the consolidated viewer message.
    assert share_response.status_code == 403, share_response.text
    assert "Viewers cannot share" in share_response.json()["detail"]


def test_create_account_share_forbidden_when_caller_not_member_of_target_tenant(client):
    """A non-member of the target tenant cannot share an account into it (403)."""
    # Arrange: the actor owns an account but has no membership in the target tenant.
    actor = signup_and_auth(client, "nonmember_sharer@test.com", "NonMemberPw1!", "NonMember")
    actor_header = auth_header(actor["access_token"])

    target_owner = signup_and_auth(client, "nonmember_target_owner@test.com", "OwnerPw1!", "TargetOwner2")
    target_owner_header = auth_header(target_owner["access_token"])
    target_tenant_response = client.post("/tenants", json={"name": "NonMemberFamily"}, headers=target_owner_header)
    assert target_tenant_response.status_code == 200, target_tenant_response.text
    target_tenant = target_tenant_response.json()

    account_response = client.post(
        "/accounts",
        json={"name": "NonMember Account", "type": "cash", "currency": "USD", "balance": "10.00"},
        headers=actor_header,
    )
    assert account_response.status_code == 200, account_response.text
    account = account_response.json()

    # Act: the non-member attempts to share into a tenant they don't belong to.
    share_response = client.post(
        f"/accounts/{account['id']}/shares",
        json={"tenant_id": target_tenant["id"], "visibility": "visible"},
        headers=actor_header,
    )

    # Assert: rejected as not an active member.
    assert share_response.status_code == 403, share_response.text
    assert "not an active member" in share_response.json()["detail"]


def test_create_account_share_not_found_when_target_tenant_missing(client):
    """Sharing into a non-existent target tenant returns 404."""
    # Arrange: the actor owns an account; the target tenant id does not exist.
    actor = signup_and_auth(client, "missing_tenant_sharer@test.com", "MissingPw1!", "MissingSharer")
    actor_header = auth_header(actor["access_token"])

    account_response = client.post(
        "/accounts",
        json={"name": "Missing Tenant Account", "type": "cash", "currency": "USD", "balance": "10.00"},
        headers=actor_header,
    )
    assert account_response.status_code == 200, account_response.text
    account = account_response.json()

    # Act: share into a random (non-existent) tenant id.
    share_response = client.post(
        f"/accounts/{account['id']}/shares",
        json={"tenant_id": str(uuid4()), "visibility": "visible"},
        headers=actor_header,
    )

    # Assert: 404 with the consolidated target-tenant message.
    assert share_response.status_code == 404, share_response.text
    assert "Target tenant not found" in share_response.json()["detail"]


def test_create_account_share_succeeds_when_caller_is_active_member_of_target_tenant(client):
    """Happy path: an active member (owner) of the target tenant can share (200)."""
    # Arrange: the actor owns both the account and the target tenant (owner role),
    # so they are an active, non-viewer member authorized to share.
    actor = signup_and_auth(client, "member_sharer@test.com", "MemberSharePw1!", "MemberSharer")
    actor_header = auth_header(actor["access_token"])

    target_tenant_response = client.post("/tenants", json={"name": "MemberShareFamily"}, headers=actor_header)
    assert target_tenant_response.status_code == 200, target_tenant_response.text
    target_tenant = target_tenant_response.json()

    account_response = client.post(
        "/accounts",
        json={"name": "Member Share Account", "type": "cash", "currency": "USD", "balance": "10.00"},
        headers=actor_header,
    )
    assert account_response.status_code == 200, account_response.text
    account = account_response.json()

    # Act: the active member shares the account into their own tenant.
    share_response = client.post(
        f"/accounts/{account['id']}/shares",
        json={"tenant_id": target_tenant["id"], "visibility": "visible"},
        headers=actor_header,
    )

    # Assert: the share is created and bound to the account + tenant.
    assert share_response.status_code == 200, share_response.text
    share = share_response.json()
    assert share["account_id"] == account["id"]
    assert share["tenant_id"] == target_tenant["id"]


def test_create_account_with_share_with_creates_account_and_one_share(client):
    """create_account with share_with stays a 200 happy path creating exactly one share.

    Guards that the new `except HTTPException` arm in the create_account handler does
    not regress the atomic account+share creation path.
    """
    # Arrange: the actor owns a tenant they are an active owner of.
    actor = signup_and_auth(client, "atomic_sharer@test.com", "AtomicPw1!", "AtomicSharer")
    actor_header = auth_header(actor["access_token"])
    target_tenant_response = client.post("/tenants", json={"name": "AtomicShareFamily"}, headers=actor_header)
    assert target_tenant_response.status_code == 200, target_tenant_response.text
    target_tenant = target_tenant_response.json()

    # Act: create an account AND share it with the tenant in one request.
    account_response = client.post(
        "/accounts",
        json={
            "name": "Atomic Account",
            "type": "cash",
            "currency": "USD",
            "balance": "25.00",
            "share_with": {"tenant_id": target_tenant["id"], "visibility": "visible"},
        },
        headers=actor_header,
    )

    # Assert: account created, and exactly one share bound to the target tenant.
    assert account_response.status_code == 200, account_response.text
    account = account_response.json()

    shares_list_response = client.get(f"/accounts/{account['id']}/shares", headers=actor_header)
    assert shares_list_response.status_code == 200, shares_list_response.text
    shares = shares_list_response.json()
    assert len(shares) == 1
    assert shares[0]["tenant_id"] == target_tenant["id"]


def test_list_account_shares_returns_tenant_name_for_each_tenant(client):
    """GET /accounts/{id}/shares returns the correct tenant_name per share when an
    account is shared with multiple tenants (batched-join enrichment, item 5)."""
    # Arrange: the actor owns two distinct tenants and one account.
    actor = signup_and_auth(client, "multi_share@test.com", "MultiPw1!", "MultiSharer")
    actor_header = auth_header(actor["access_token"])

    first_tenant = client.post("/tenants", json={"name": "FirstShareFamily"}, headers=actor_header).json()
    second_tenant = client.post("/tenants", json={"name": "SecondShareFamily"}, headers=actor_header).json()

    account = client.post(
        "/accounts",
        json={"name": "Multi Share Account", "type": "cash", "currency": "USD", "balance": "50.00"},
        headers=actor_header,
    ).json()

    # Share the account with both tenants.
    for tenant in (first_tenant, second_tenant):
        share_response = client.post(
            f"/accounts/{account['id']}/shares",
            json={"tenant_id": tenant["id"], "visibility": "visible"},
            headers=actor_header,
        )
        assert share_response.status_code == 200, share_response.text

    # Act: list the account's shares.
    shares_list_response = client.get(f"/accounts/{account['id']}/shares", headers=actor_header)
    assert shares_list_response.status_code == 200, shares_list_response.text

    # Assert: each share carries its own tenant's name (correct join, no cross-up).
    tenant_name_by_id = {
        share["tenant_id"]: share["tenant_name"] for share in shares_list_response.json()
    }
    assert tenant_name_by_id[first_tenant["id"]] == "FirstShareFamily"
    assert tenant_name_by_id[second_tenant["id"]] == "SecondShareFamily"
