# tests/test_membership_crud.py
import pytest
from tests.helpers import signup_and_auth, auth_header


@pytest.fixture
def membership_setup(client):
    # Owner creates tenant and invites another user
    owner = signup_and_auth(client, "owner1@test.com", "OwnerPw1!", "Owner")
    owner_header = auth_header(owner["access_token"])

    # create a family/tenant
    tenant_response = client.post("/tenants", json={"name": "OwnersFamily"}, headers=owner_header)
    assert tenant_response.status_code == 200
    tenant = tenant_response.json()

    # switch the active tenant
    switch_tenant_response = client.post(f"/tenants/{tenant['id']}/switch", headers=owner_header)
    assert switch_tenant_response.status_code == 200
    assert "access_token" in switch_tenant_response.json()
    owner_header = auth_header(switch_tenant_response.json()["access_token"])

    # Create invitee
    Invitee_signup_response = signup_and_auth(client, "invitee@test.com", "Inv1teP!", "Invitee")

    # Create membership (owner grants membership) - endpoint expects tenant_id + user_id + role
    invitee_header = auth_header(Invitee_signup_response["access_token"])
    payload = {"user_email": "invitee@test.com", "role": "member"}
    membership_response = client.post(f"/tenants/{tenant['id']}/members", json=payload, headers=owner_header)
    assert membership_response.status_code == 200, membership_response.text
    membership = membership_response.json()
    assert membership["tenant_id"] == tenant["id"]
    assert membership["role"] == "member"

    # Switch invitee token to tenant context so invitee can perform self-removal (leave family)
    invitee_switch_response = client.post(f"/tenants/{tenant['id']}/switch", headers=invitee_header)
    assert invitee_switch_response.status_code == 200, invitee_switch_response.text
    invitee_tenant_header = auth_header(invitee_switch_response.json()["access_token"])

    # Discover owner membership id for self-removal tests
    members_response = client.get(f"/tenants/{tenant['id']}/members", headers=owner_header)
    assert members_response.status_code == 200, members_response.text
    owner_membership = next(
        member
        for member in members_response.json()
        if member["user_email"] == "owner1@test.com" and member["status"] == "active"
    )

    return {
        "owner_header": owner_header,
        "invitee_header": invitee_header,
        "invitee_tenant_header": invitee_tenant_header,
        "tenant_id": tenant['id'],
        "invitee_membership": membership,
        "owner_membership_id": owner_membership["id"],
    }


def test_membership_create(client, membership_setup):
    # membership_setup acts as the creator; validate minimal expectations
    assert membership_setup["invitee_membership"]["tenant_id"] == membership_setup["tenant_id"]
    assert membership_setup["invitee_membership"]["role"] == "member"
    assert membership_setup["invitee_membership"]["status"] == "active"

def test_list_tenant(client, membership_setup):
    owner_header = membership_setup["owner_header"]
    tenant_id = membership_setup["tenant_id"]
    invitee_membership = membership_setup["invitee_membership"]

    # list memberships for tenant
    memberships_list_response = client.get(f"/tenants/{tenant_id}/members", headers=owner_header)
    assert memberships_list_response.status_code == 200
    assert any(m["id"] == invitee_membership["id"] for m in memberships_list_response.json())


def test_update_membership(client, membership_setup):
    owner_header = membership_setup["owner_header"]
    tenant_id = membership_setup["tenant_id"]
    invitee_membership = membership_setup["invitee_membership"]

    payload = {"role": "owner"}
    update_membership_response = client.patch(
        f"/tenants/{tenant_id}/members/{invitee_membership['id']}",
        json=payload,
        headers=owner_header,
    )
    updated_membership = update_membership_response.json()
    assert update_membership_response.status_code == 200
    assert updated_membership["role"] == "owner"
    assert updated_membership["id"] == invitee_membership["id"]


def test_delete_membership(client, membership_setup):
    owner_header = membership_setup["owner_header"]
    tenant_id = membership_setup["tenant_id"]
    invitee_membership = membership_setup["invitee_membership"]
    # delete membership
    delete_membership_response = client.delete(f"/tenants/{tenant_id}/members/{invitee_membership['id']}", headers=owner_header)
    assert delete_membership_response.status_code in (200, 204)

    # list memberships for tenant, it should not be present
    memberships_list_response = client.get(f"/tenants/{tenant_id}/members", headers=owner_header)
    assert memberships_list_response.status_code == 200
    assert True not in [m["id"] == invitee_membership["id"] for m in memberships_list_response.json()]


def test_owner_can_leave_when_other_owner_exists(client, membership_setup):
    owner_header = membership_setup["owner_header"]
    invitee_tenant_header = membership_setup["invitee_tenant_header"]
    tenant_id = membership_setup["tenant_id"]
    invitee_membership = membership_setup["invitee_membership"]
    owner_membership_id = membership_setup["owner_membership_id"]

    # Promote invitee to owner so at least two active owners exist.
    promote_response = client.patch(
        f"/tenants/{tenant_id}/members/{invitee_membership['id']}",
        json={"role": "owner"},
        headers=owner_header,
    )
    assert promote_response.status_code == 200, promote_response.text

    # Owner removes their own membership (leave).
    leave_response = client.delete(
        f"/tenants/{tenant_id}/members/{owner_membership_id}",
        headers=owner_header,
    )
    assert leave_response.status_code in (200, 204), leave_response.text

    # Verify original owner can no longer switch to the tenant (membership removed).
    switch_response = client.post(f"/tenants/{tenant_id}/switch", headers=owner_header)
    assert switch_response.status_code == 403, switch_response.text

    # Remaining owner can still access tenant members.
    members_response = client.get(f"/tenants/{tenant_id}/members", headers=invitee_tenant_header)
    assert members_response.status_code == 200, members_response.text


def test_last_owner_cannot_leave_family(client, membership_setup):
    owner_header = membership_setup["owner_header"]
    tenant_id = membership_setup["tenant_id"]
    owner_membership_id = membership_setup["owner_membership_id"]

    leave_response = client.delete(
        f"/tenants/{tenant_id}/members/{owner_membership_id}",
        headers=owner_header,
    )
    assert leave_response.status_code == 400, leave_response.text
