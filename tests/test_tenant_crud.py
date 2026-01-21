import pytest
from tests.helpers import signup_and_auth, auth_header


# Fixture: tenant_factory
# Purpose:
# - Create (or obtain) a user via signup_and_auth
# - Capture the personal (default) access token and tenant id
# - Create a new tenant for that user
# - Switch active tenant to the created tenant and return the active token + ids
#
# This fixture lives at the top of this test file and is intended for use only by
# the tests below. It centralizes setup so each test can focus on a single behavior.
@pytest.fixture
def tenant_factory(client):
    # Sign up (or login) a test user and obtain the initial access token scoped to the personal tenant
    email = "tenant_owner@test.com"
    password = "T#st1234"
    creds = signup_and_auth(client, email, password, "Owner")
    personal_access_token = creds["access_token"]
    personal_headers = auth_header(personal_access_token)

    # Read the user's current tenants to discover the personal tenant id
    tenants_list_response = client.get("/tenants", headers=personal_headers)
    assert tenants_list_response.status_code == 200, tenants_list_response.text
    tenants_for_user = tenants_list_response.json()
    assert len(tenants_for_user) >= 1
    # We treat the first returned tenant as the personal tenant created at signup
    personal_tenant_id = tenants_for_user[0]["id"]

    # Create a new tenant (e.g., family)
    create_payload = {"name": "Smith Family"}
    tenant_create_response = client.post("/tenants", json=create_payload, headers=personal_headers)
    assert tenant_create_response.status_code == 200, tenant_create_response.text
    created_tenant = tenant_create_response.json()
    created_tenant_id = created_tenant["id"]

    # Switch active tenant to the created tenant and obtain an access token scoped to it
    switch_response = client.post(f"/tenants/{created_tenant_id}/switch", headers=personal_headers)
    assert switch_response.status_code == 200, switch_response.text
    active_access_token = switch_response.json()["access_token"]
    active_headers = auth_header(active_access_token)

    return {
        "personal_tenant_id": personal_tenant_id,
        "created_tenant_id": created_tenant_id,
        "personal_access_token": personal_access_token,
        "active_access_token": active_access_token,
        "personal_headers": personal_headers,
        "active_headers": active_headers,
        "email": email,
        "password": password
    }


# 1) Tenant create: validate the factory created a tenant and returned expected shape
def test_tenant_create_via_factory(tenant_factory, client):
    created_tenant_id = tenant_factory["created_tenant_id"]
    # Using active headers (scoped to created tenant) fetch the tenant record
    tenant_get_response = client.get(f"/tenants/{created_tenant_id}", headers=tenant_factory["active_headers"])
    assert tenant_get_response.status_code == 200, tenant_get_response.text
    tenant_body = tenant_get_response.json()
    assert tenant_body["id"] == created_tenant_id
    assert tenant_body["name"] == "Smith Family"


# 2) Tenant read - read both the default personal and created tenant
def test_tenant_read_personal_and_created(tenant_factory, client):
    personal_tenant_id = tenant_factory["personal_tenant_id"]
    created_tenant_id = tenant_factory["created_tenant_id"]

    # Switch back to personal tenant to get a token scoped to it
    # (needed because fixture switched to created tenant, updating preferred_tenant_id)
    switch_to_personal_response = client.post(
        f"/tenants/{personal_tenant_id}/switch",
        headers=tenant_factory["active_headers"]
    )
    assert switch_to_personal_response.status_code == 200
    personal_token = switch_to_personal_response.json()["access_token"]
    personal_headers_updated = auth_header(personal_token)

    # Read personal tenant using the switched token
    personal_get_response = client.get(f"/tenants/{personal_tenant_id}", headers=personal_headers_updated)
    assert personal_get_response.status_code == 200, personal_get_response.text
    personal_tenant = personal_get_response.json()
    assert personal_tenant["id"] == personal_tenant_id

    # Read created tenant using the active (switched) token
    created_get_response = client.get(f"/tenants/{created_tenant_id}", headers=tenant_factory["active_headers"])
    assert created_get_response.status_code == 200, created_get_response.text
    created_tenant = created_get_response.json()
    assert created_tenant["id"] == created_tenant_id


# 3) List tenants for the user
def test_list_tenants_for_user(tenant_factory, client):
    active_headers = tenant_factory['active_headers']
    personal_tenant_id = tenant_factory["personal_tenant_id"]
    created_tenant_id = tenant_factory["created_tenant_id"]
    #List tenants for the user
    list_tenants_response = client.get('/tenants', headers=active_headers)
    assert list_tenants_response.status_code == 200
    tenant_list = list_tenants_response.json()
    assert personal_tenant_id in [tenant['id'] for tenant in tenant_list]
    assert created_tenant_id in [tenant['id'] for tenant in tenant_list]

def test_sign_into_specific_tenant(tenant_factory, client):
    email = tenant_factory['email']
    password = tenant_factory['password']
    personal_tenant_id = tenant_factory["personal_tenant_id"]
    created_tenant_id = tenant_factory["created_tenant_id"]

    #sign into personal tenant
    payload = {"email": email, "password": password, "tenant_uuid":personal_tenant_id}
    login_client_response = client.post("/auth/login", json=payload)
    assert login_client_response.status_code == 200
    headers = auth_header(login_client_response.json()['access_token'])
    read_tenant_response = client.get(f"tenants/{personal_tenant_id}", headers = headers)
    assert read_tenant_response.status_code == 200

    #sign into created tenant
    payload = {"email": email, "password": password, "tenant_uuid":created_tenant_id}
    login_client_response = client.post("/auth/login", json=payload)
    assert login_client_response.status_code == 200
    headers = auth_header(login_client_response.json()['access_token'])
    read_tenant_response = client.get(f"tenants/{created_tenant_id}", headers = headers)
    assert read_tenant_response.status_code == 200


# 4) Update created tenant
def test_update_created_tenant(tenant_factory, client):
    created_tenant_id = tenant_factory["created_tenant_id"]
    new_name = "Smiths"
    update_response = client.patch(f"/tenants/{created_tenant_id}", json={"name": new_name}, headers=tenant_factory["active_headers"])
    assert update_response.status_code == 200, update_response.text
    updated_tenant = update_response.json()
    assert updated_tenant["name"] == new_name


# 5) Delete created tenant
def test_delete_created_tenant(tenant_factory, client):
    created_tenant_id = tenant_factory["created_tenant_id"]
    delete_response = client.delete(f"/tenants/{created_tenant_id}", headers=tenant_factory["active_headers"])
    # Accept 200 or 204 for delete
    assert delete_response.status_code in (200, 204), delete_response.text

    # Confirm deleted - subsequent GET should return 404 or 400
    confirm_get_response = client.get(f"/tenants/{created_tenant_id}", headers=tenant_factory["active_headers"])
    assert confirm_get_response.status_code in (404, 400), confirm_get_response.text


# 6) Test that switching tenant updates user's preferred_tenant_id
def test_switch_tenant_updates_preferred_tenant(client, db_session):
    """Test that switching tenants via POST /tenants/{id}/switch updates user.preferred_tenant_id

    This ensures when users log out and back in, they continue with their last active tenant.
    """
    from backend.api.app.models import User, Membership
    from backend.api.app.auth import decode_access_token
    from sqlmodel import select

    # Setup: Create user with personal tenant
    email = "tenant_switcher@test.com"
    password = "Switch#123"
    user_data = signup_and_auth(client, email, password, "Switcher")
    personal_access_token = user_data["access_token"]
    personal_headers = auth_header(personal_access_token)

    # Get user from database to verify preferred_tenant_id updates
    user = db_session.exec(select(User).where(User.email == email)).first()
    assert user is not None

    # Get user's personal tenant id
    tenants_response = client.get("/tenants", headers=personal_headers)
    assert tenants_response.status_code == 200
    tenants = tenants_response.json()
    assert len(tenants) >= 1
    personal_tenant_id = tenants[0]["id"]

    # Create a second tenant (e.g., family)
    create_response = client.post("/tenants", json={"name": "Test Family"}, headers=personal_headers)
    assert create_response.status_code == 200
    second_tenant_id = create_response.json()["id"]

    # Verify user now has 2 active memberships
    memberships = db_session.exec(select(Membership).where(Membership.user_id == user.id)).all()
    assert len(memberships) == 2

    # Switch to the second tenant
    switch_response = client.post(f"/tenants/{second_tenant_id}/switch", headers=personal_headers)
    assert switch_response.status_code == 200
    switched_access_token = switch_response.json()["access_token"]
    assert switched_access_token is not None

    # Verify preferred_tenant_id was updated in the database
    db_session.refresh(user)
    assert str(user.preferred_tenant_id) == second_tenant_id, \
        f"Expected preferred_tenant_id to be {second_tenant_id}, got {user.preferred_tenant_id}"

    # Verify the returned token contains the correct tenant_id
    decoded = decode_access_token(switched_access_token)
    assert decoded is not None, "Failed to decode switched access token"
    assert decoded["tenant_id"] == second_tenant_id, \
        f"Expected token tenant_id to be {second_tenant_id}, got {decoded['tenant_id']}"

    # Now test the full flow: logout and login again without specifying tenant
    # The user should get a token scoped to the second tenant (their preferred)
    login_response = client.post("/auth/login", json={
        "email": email,
        "password": password
        # Explicitly NOT passing tenant_uuid - should use preferred
    })
    assert login_response.status_code == 200

    # Verify the new token contains the preferred tenant (second tenant)
    new_access_token = login_response.json()["access_token"]
    new_decoded = decode_access_token(new_access_token)
    assert new_decoded is not None, "Failed to decode new access token after login"
    assert new_decoded["tenant_id"] == second_tenant_id, \
        f"After logout/login, expected token tenant_id to be {second_tenant_id} (preferred), got {new_decoded['tenant_id']}"
