"""Error-branch tests for app/deps.py::get_active_context.

get_active_context is the single tenant-isolation gate every protected route
depends on, but its failure branches (malformed token claims, missing
user/tenant, inactive membership) were only ever hit indirectly. These tests
mint tokens with crafted claims and assert each guard returns the right status,
so a regression that weakens the gate fails loudly.

Uses the sync `client` + `db_session` fixtures (file-backed SQLite shared with
the app engine). Every test uses a unique email so it is order-independent in
the session-scoped database.
"""
from uuid import uuid4

from app.auth import create_access_token, hash_password
from app.models import (
    Membership,
    MembershipRole,
    MembershipStatus,
    Tenant,
    User,
)


# GET /transactions is a thin protected route — reaching it at all proves the
# get_active_context dependency resolved; any failure surfaces before the body.
PROTECTED_ENDPOINT = "/transactions"


def _token(subject: str, tenant_id: str) -> dict:
    """Mint an Authorization header for the given (sub, tenant_id) claims."""
    access_token = create_access_token({"sub": subject, "tenant_id": tenant_id})
    return {"Authorization": f"Bearer {access_token}"}


def _persist_user(db_session, email: str) -> User:
    """Create and commit a User, returning the refreshed record."""
    user = User(email=email, password_hash=hash_password("DepsPw1!"), name="Deps User")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_non_uuid_sub_claim_returns_401(client):
    """A token whose `sub` is not a UUID is rejected before any DB lookup."""
    # Arrange: structurally valid JWT, but sub cannot be parsed as a UUID.
    headers = _token(subject="not-a-uuid", tenant_id=str(uuid4()))

    # Act
    response = client.get(PROTECTED_ENDPOINT, headers=headers)

    # Assert
    assert response.status_code == 401, response.text
    assert response.json()["detail"] == "Invalid user id in token"


def test_missing_sub_claim_returns_401(client):
    """A token with no `sub` claim is rejected as an invalid payload."""
    # Arrange: omit sub entirely.
    access_token = create_access_token({"tenant_id": str(uuid4())})
    headers = {"Authorization": f"Bearer {access_token}"}

    # Act
    response = client.get(PROTECTED_ENDPOINT, headers=headers)

    # Assert
    assert response.status_code == 401, response.text
    assert response.json()["detail"] == "Invalid token payload"


def test_unknown_user_returns_404(client):
    """A well-formed token for a user that does not exist returns 404."""
    # Arrange: both ids are valid UUIDs but reference no rows.
    headers = _token(subject=str(uuid4()), tenant_id=str(uuid4()))

    # Act
    response = client.get(PROTECTED_ENDPOINT, headers=headers)

    # Assert
    assert response.status_code == 404, response.text
    assert response.json()["detail"] == "User not found"


def test_unknown_tenant_returns_404(client, db_session):
    """A real user pointed at a non-existent tenant returns 404 (tenant gate)."""
    # Arrange: the user exists; the tenant id is valid-shaped but absent.
    user = _persist_user(db_session, "deps_tenant404@test.com")
    headers = _token(subject=str(user.id), tenant_id=str(uuid4()))

    # Act
    response = client.get(PROTECTED_ENDPOINT, headers=headers)

    # Assert
    assert response.status_code == 404, response.text
    assert response.json()["detail"] == "Tenant not found"


def test_revoked_membership_returns_403(client, db_session):
    """A user whose membership in the tenant is REVOKED is denied (not active)."""
    # Arrange: user + tenant exist, but the linking membership is revoked.
    user = _persist_user(db_session, "deps_revoked@test.com")
    tenant = Tenant(name="Deps Revoked Family")
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)

    membership = Membership(
        user_id=user.id,
        user_email=user.email,
        tenant_id=tenant.id,
        role=MembershipRole.OWNER,
        status=MembershipStatus.REVOKED,
    )
    db_session.add(membership)
    db_session.commit()

    headers = _token(subject=str(user.id), tenant_id=str(tenant.id))

    # Act
    response = client.get(PROTECTED_ENDPOINT, headers=headers)

    # Assert: the membership exists but is not ACTIVE, so access is forbidden.
    assert response.status_code == 403, response.text
    assert response.json()["detail"] == "Not a member of the family"
