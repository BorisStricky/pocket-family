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

    return {"owner_header": owner_header, "invitee_header": invitee_header, "tenant_id": tenant['id'], "invitee_membership": membership}


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
