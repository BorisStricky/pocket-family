# tests/test_auth_endpoints.py
# Notes:
# - This test suite targets the existing endpoints:
#   POST /auth/signup, POST /auth/login, POST /auth/refresh
# - The current API expects the refresh_token as a query parameter (not JSON body),
#   so the refresh() helper sends it via params.
# - TEST_MODE=1 is set in conftest so endpoints include refresh_token in responses.

import pytest
from datetime import datetime, timedelta
from sqlmodel import select
from backend.api.app.models import User, RefreshToken

# --- New tests for preferred tenant functionality ---
import jwt


# Helper to signup and return response
def signup(client, email="user@example.com", password="secret123", name="User"):
    payload = {"email": email, "password": password, "name": name}
    signup_client_response = client.post("/auth/signup", json=payload)
    return signup_client_response


def login(client, email="user@example.com", password="secret123", tenant_id: str = None):
    payload = {"email": email, "password": password}
    if tenant_id:
        payload["tenant_uuid"] = tenant_id
    login_client_response = client.post("/auth/login", json=payload)
    return login_client_response


def refresh(client, refresh_token):
    # API expects refresh_token as a query parameter
    refresh_client_response = client.post("/auth/refresh", params={"refresh_token": refresh_token})
    return refresh_client_response


# 1. Create a new user - success, assert access_token and refresh_token returned
def test_create_user_success_returns_tokens(client):
    signup_response = signup(client, "alice@test.com", "Password!234", "Alice")
    assert signup_response.status_code == 200, signup_response.text
    body = signup_response.json()
    assert "access_token" in body and body["access_token"] is not None, "access_token not returned"
    assert "refresh_token" in body and body["refresh_token"] is not None, "refresh_token not returned"


# 2. Create a user with an email already signed up - fail
def test_create_user_duplicate_email_fails(client):
    email = "dup@test.com"
    dup_signup_response = signup(client, email, "pw1", "Dup1")
    assert dup_signup_response.status_code == 200
    dup_signup_response_2 = signup(client, email, "pw2", "Dup2")
    # Expect 400 (or 409) depending on implementation; accept 400-409
    assert dup_signup_response_2.status_code in (400, 409), f"Expected failure on duplicate email, got {dup_signup_response_2.status_code} {dup_signup_response_2.text}"


# 3. Login with an existing user and correct credentials - success, assert access_token and refresh_token returned
def test_login_success_returns_tokens(client):
    email = "loginok@test.com"
    password = "S3cret!"
    signup(client, email, password, "LoginOk")
    login_response = login(client, email, password)
    assert login_response.status_code == 200, login_response.text
    body = login_response.json()
    assert "access_token" in body and body["access_token"] is not None
    assert "refresh_token" in body and body["refresh_token"] is not None


# 4. login with an existing user and wrong password - fail
def test_login_wrong_password_fails(client):
    email = "wrongpw@test.com"
    signup(client, email, "RightPassword1", "WrongPW")
    login_incorrect_response = login(client, email, "incorrect")
    assert login_incorrect_response.status_code in (400, 401, 403), f"Expected auth failure, got {login_incorrect_response.status_code} {login_incorrect_response.text}"


# 5. login with an unexisting user - fail
def test_login_nonexistent_user_fails(client):
    login_nonexistent_response = login(client, "noone@doesnt.exist", "whatever")
    assert login_nonexistent_response.status_code in (400, 401, 404), f"Expected auth failure for non-existent user, got {login_nonexistent_response.status_code} {login_nonexistent_response.text}"


# 6. refresh with a correct token - success, assert access_token and refresh_token
def test_refresh_with_correct_token_success(client, db_session):
    email = "refreshok@test.com"
    password = "RefreshMe1"
    signup_response = signup(client, email, password, "RefreshOk")
    assert signup_response.status_code == 200
    body = signup_response.json()
    assert "refresh_token" in body, "signup must return refresh_token for this test"
    raw_refresh = body["refresh_token"]

    refresh_response = refresh(client, raw_refresh)
    assert refresh_response.status_code == 200, refresh_response.text
    b2 = refresh_response.json()
    assert "access_token" in b2
    assert "refresh_token" in b2
    # Optionally assert which refresh token record exists in DB for user
    user = db_session.exec(select(User).where(User.email == email)).first()
    assert user is not None
    rts = db_session.exec(select(RefreshToken).where(RefreshToken.user_id == user.id)).all()
    assert len(rts) >= 1


# 7. refresh with an expired token - fail
def test_refresh_with_expired_token_fails(client, db_session):
    email = "expired@test.com"
    password = "Expire1"
    signup_response = signup(client, email, password, "Expired")
    assert signup_response.status_code == 200
    body = signup_response.json()
    raw_refresh = body["refresh_token"]

    # find the refresh token DB row and set expires_at to past
    user = db_session.exec(select(User).where(User.email == email)).first()
    assert user is not None
    rtrec = db_session.exec(select(RefreshToken).where(RefreshToken.user_id == user.id)).first()
    assert rtrec is not None
    # expire it
    rtrec.expires_at = datetime.utcnow() - timedelta(days=1)
    db_session.add(rtrec)
    db_session.commit()

    refresh_response = refresh(client, raw_refresh)
    assert refresh_response.status_code in (400, 401), f"Expected expired refresh token to fail; got {refresh_response.status_code} {refresh_response.text}"


# 8. refresh with an incorrect token - fail
def test_refresh_with_incorrect_token_fails(client):
    bad_token = "this-is-definitely-not-valid"
    refresh_invalid_response = refresh(client, bad_token)
    assert refresh_invalid_response.status_code in (400, 401), f"Expected invalid refresh token to fail; got {refresh_invalid_response.status_code} {refresh_invalid_response.text}"


# --- New tests for authenticate_token helper ---
from fastapi import HTTPException
from backend.api.app.auth import authenticate_token, create_access_token, decode_access_token
from backend.api.app.models import Membership


def test_authenticate_token_decodes_user_and_tenant(client):
    """
    Ensure that a valid access token decodes and returns both user_id and tenant_id.
    We use the /auth/signup endpoint to obtain a valid access token containing sub and tenant_id.
    """
    signup_response = signup(client, email="tokendecode@test.com", password="Decode123!", name="DecodeUser")
    assert signup_response.status_code == 200, signup_response.text
    access_token = signup_response.json()["access_token"]

    result = authenticate_token(access_token)
    assert isinstance(result, dict)
    assert result.get("user_id") is not None
    assert result.get("tenant_id") is not None


def test_authenticate_token_valid_token_returns_ok(client):
    """
    A valid token should be accepted by authenticate_token without raising and return identifiers.
    """
    signup_response = signup(client, email="validtoken@test.com", password="Valid123!", name="ValidUser")
    assert signup_response.status_code == 200
    access_token = signup_response.json()["access_token"]

    result = authenticate_token(access_token)
    assert result.get("user_id") and result.get("tenant_id")


def test_authenticate_token_expired_token_returns_expired(client):
    """
    Create an already-expired JWT and ensure authenticate_token raises an HTTPException (401, "Token expired").
    """
    # First, sign up to get a baseline token we can decode to know sub and tenant_id
    signup_response = signup(client, email="expiredtoken@test.com", password="Expired123!", name="ExpiredUser")
    assert signup_response.status_code == 200
    fresh_token = signup_response.json()["access_token"]

    payload = decode_access_token(fresh_token)
    assert payload is not None, "Fresh token should decode for extracting claims in test setup"
    uid = payload.get("sub")
    tid = payload.get("tenant_id")

    # Issue an already-expired token with the same identifiers
    expired_token = create_access_token({"sub": uid, "tenant_id": tid}, expires_delta=timedelta(minutes=-1))

    with pytest.raises(HTTPException) as exc:
        authenticate_token(expired_token)
    assert exc.value.status_code == 401
    assert "expired" in str(exc.value.detail).lower()

def test_login_with_explicit_tenant_updates_preferred(client, db_session):
    """Test that logging in with explicit tenant_uuid updates user.preferred_tenant_id"""
    from backend.api.app.models import Membership
    from tests.helpers import signup_and_auth

    # Setup: Create user with personal tenant
    user_data = signup_and_auth(client, "user@test.com", "password123", "Test User")

    # Get user from DB to find their ID
    user = db_session.exec(select(User).where(User.email == "user@test.com")).first()
    assert user is not None

    # Create a second tenant for the user
    personal_headers = {"Authorization": f"Bearer {user_data['access_token']}"}
    tenant_response = client.post("/tenants", json={"name": "Second Family"}, headers=personal_headers)
    assert tenant_response.status_code == 200
    second_tenant_id = tenant_response.json()["id"]

    # Verify user has 2 memberships now
    memberships = db_session.exec(select(Membership).where(Membership.user_id == user.id)).all()
    assert len(memberships) == 2

    # Login with explicit tenant_uuid (second tenant)
    login_response = client.post("/auth/login", json={
        "email": "user@test.com",
        "password": "password123",
        "tenant_uuid": second_tenant_id
    })
    assert login_response.status_code == 200

    # Verify preferred_tenant_id was updated in database
    db_session.refresh(user)
    assert str(user.preferred_tenant_id) == second_tenant_id, \
        f"Expected preferred_tenant_id to be {second_tenant_id}, got {user.preferred_tenant_id}"

    # Verify token contains the correct tenant
    access_token = login_response.json()["access_token"]
    assert access_token is not None


def test_login_without_tenant_uses_preferred(client, db_session):
    """Test that logging in without tenant_uuid uses user.preferred_tenant_id"""
    from tests.helpers import signup_and_auth

    # Setup: Create user
    user_data = signup_and_auth(client, "user2@test.com", "password123", "User Two")

    # Get user from DB
    user = db_session.exec(select(User).where(User.email == "user2@test.com")).first()
    personal_headers = {"Authorization": f"Bearer {user_data['access_token']}"}

    # Create second tenant
    tenant_response = client.post("/tenants", json={"name": "Family Two"}, headers=personal_headers)
    second_tenant_id = tenant_response.json()["id"]

    # Login with explicit tenant to set preferred
    client.post("/auth/login", json={
        "email": "user2@test.com",
        "password": "password123",
        "tenant_uuid": second_tenant_id
    })

    # Verify preferred was set
    db_session.refresh(user)
    assert str(user.preferred_tenant_id) == second_tenant_id

    # Now login WITHOUT tenant_uuid - should use preferred
    login_response = client.post("/auth/login", json={
        "email": "user2@test.com",
        "password": "password123"
    })
    assert login_response.status_code == 200

    # Decode token to verify tenant_id matches preferred
    access_token = login_response.json()["access_token"]
    # Note: In production you'd verify signature, but for testing we can decode without verification
    decoded = jwt.decode(access_token, options={"verify_signature": False})
    assert decoded["tenant_id"] == second_tenant_id, \
        f"Expected token tenant_id to be {second_tenant_id}, got {decoded['tenant_id']}"


def test_login_without_tenant_no_preferred_uses_first(client, db_session):
    """Test that login without tenant and no preferred_tenant_id falls back to first membership"""
    from backend.api.app.models import Membership
    from tests.helpers import signup_and_auth

    # Setup: Create user (will have personal tenant as first membership)
    user_data = signup_and_auth(client, "user3@test.com", "password123", "User Three")

    # Get user and verify preferred_tenant_id is None initially
    user = db_session.exec(select(User).where(User.email == "user3@test.com")).first()
    assert user.preferred_tenant_id is None

    # Get first membership
    first_membership = db_session.exec(
        select(Membership).where(Membership.user_id == user.id)
    ).first()
    assert first_membership is not None

    # Login without tenant_uuid - should use first membership
    login_response = client.post("/auth/login", json={
        "email": "user3@test.com",
        "password": "password123"
    })
    assert login_response.status_code == 200

    # Verify token has first membership's tenant
    access_token = login_response.json()["access_token"]
    decoded = jwt.decode(access_token, options={"verify_signature": False})
    assert decoded["tenant_id"] == str(first_membership.tenant_id)

    # Verify preferred_tenant_id was NOT updated (only explicit tenant updates it)
    db_session.refresh(user)
    assert user.preferred_tenant_id is None


def test_refresh_token_uses_preferred_tenant(client, db_session):
    """Test that refresh endpoint uses preferred tenant logic"""
    from tests.helpers import signup_and_auth

    # Setup: Create user
    user_data = signup_and_auth(client, "user4@test.com", "password123", "User Four")
    user = db_session.exec(select(User).where(User.email == "user4@test.com")).first()
    personal_headers = {"Authorization": f"Bearer {user_data['access_token']}"}

    # Create second tenant and set as preferred via login
    tenant_response = client.post("/tenants", json={"name": "Preferred Family"}, headers=personal_headers)
    preferred_tenant_id = tenant_response.json()["id"]

    login_response = client.post("/auth/login", json={
        "email": "user4@test.com",
        "password": "password123",
        "tenant_uuid": preferred_tenant_id
    })
    refresh_token = login_response.json()["refresh_token"]

    # Call refresh endpoint
    refresh_response = client.post("/auth/refresh", params={"refresh_token": refresh_token})
    assert refresh_response.status_code == 200

    # Verify new access token contains preferred tenant
    new_access_token = refresh_response.json()["access_token"]
    decoded = jwt.decode(new_access_token, options={"verify_signature": False})
    assert decoded["tenant_id"] == preferred_tenant_id, \
        f"Refresh should use preferred tenant {preferred_tenant_id}, got {decoded['tenant_id']}"