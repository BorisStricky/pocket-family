# tests/test_category_crud.py
"""
Refactored category CRUD tests.

This file introduces a fixture that creates a user, tenant (via signup),
and a base category which is used by the individual CRUD-focused tests.

Each test is small and focused on a single CRUD operation to make failures
clearer and improve test isolation.

The fixture returns only the auth headers and the created base category to
stay consistent with the project's test patterns (the `client` fixture is
passed separately by pytest where needed).

Comments are intentionally verbose to conform with the project's Python
coding rules for clarity.
"""

from tests.helpers import signup_and_auth, auth_header


import pytest


@pytest.fixture
def category_base_fixture(client):
    """Create a user + tenant (via signup_and_auth) and a base category.

    Returns a small dict with keys:
    - headers: auth header dict to use with requests
    - base_category: JSON dict returned from POST /categories for the created
      base category

    Notes:
    - We intentionally do not return `client` here to remain consistent with
      other tests in the suite; the `client` fixture is accepted directly by
      tests that need it.
    - The fixture asserts the POST succeeded so tests can assume the base
      category exists.
    """
    # Create or login the test user and obtain tokens
    creds = signup_and_auth(client, "cat_owner@test.com", "CatPw1!", "CatOwner")
    headers = auth_header(creds["access_token"])  # small helper returns header dict

    # Create the base category that other tests will operate on
    base_payload = {"name": "Groceries", "kind": "expense"}
    base_category_response = client.post("/categories", json=base_payload, headers=headers)
    assert base_category_response.status_code == 200, base_category_response.text
    base_category = base_category_response.json()

    return {"headers": headers, "base_category": base_category}


def test_create_second_category(client, category_base_fixture):
    """CREATE: create a second category under the same tenant."""
    headers = category_base_fixture["headers"]

    payload = {"name": "Restaurants", "kind": "expense"}
    second_category_response = client.post("/categories", json=payload, headers=headers)
    assert second_category_response.status_code == 200, second_category_response.text

    second_category = second_category_response.json()
    # Basic field assertions to ensure creation behaved as expected
    assert second_category["name"] == "Restaurants"
    assert second_category["kind"] == "expense"
    assert "id" in second_category


def test_read_base_category(client, category_base_fixture):
    """READ: fetch the base category created in the fixture and assert fields."""
    headers = category_base_fixture["headers"]
    base_category = category_base_fixture["base_category"]

    category_get_response = client.get(f"/categories/{base_category['id']}", headers=headers)
    assert category_get_response.status_code == 200, category_get_response.text

    fetched_category = category_get_response.json()
    assert fetched_category["id"] == base_category["id"]
    assert fetched_category["name"] == base_category["name"]
    assert fetched_category["kind"] == base_category["kind"]
    # icon and color must always be present in the response, defaulting to None
    assert fetched_category["icon"] is None
    assert fetched_category["color"] is None


def test_list_categories_includes_base(client, category_base_fixture):
    """LIST: ensure the base category appears in the tenant's category list."""
    headers = category_base_fixture["headers"]
    base_category = category_base_fixture["base_category"]

    categories_list_response = client.get("/categories", headers=headers)
    assert categories_list_response.status_code == 200, categories_list_response.text

    categories = categories_list_response.json()
    category_ids = [category["id"] for category in categories]
    assert base_category["id"] in category_ids

    # Every category in the list must expose icon and color keys (null when unset)
    for category in categories:
        assert "icon" in category
        assert "color" in category


def test_update_base_category(client, category_base_fixture):
    """UPDATE: change the base category name and verify the change persisted."""
    headers = category_base_fixture["headers"]
    base_category = category_base_fixture["base_category"]

    category_update_response = client.patch(
        f"/categories/{base_category['id']}", json={"name": "Food"}, headers=headers
    )
    assert category_update_response.status_code == 200, category_update_response.text

    updated_category = category_update_response.json()
    assert updated_category["name"] == "Food"

    # Re-fetch to ensure persistence
    category_get_response = client.get(f"/categories/{base_category['id']}", headers=headers)
    assert category_get_response.status_code == 200, category_get_response.text
    fetched_category = category_get_response.json()
    assert fetched_category["name"] == "Food"


def test_delete_base_category(client, category_base_fixture):
    """DELETE: remove the base category and assert it no longer appears in the list."""
    headers = category_base_fixture["headers"]
    base_category = category_base_fixture["base_category"]

    category_delete_response = client.delete(f"/categories/{base_category['id']}", headers=headers)
    assert category_delete_response.status_code in (200, 204), category_delete_response.text

    # After delete, list categories to ensure the base category id is gone
    categories_list_response = client.get("/categories", headers=headers)
    assert categories_list_response.status_code == 200, categories_list_response.text

    categories = categories_list_response.json()
    category_ids = [category["id"] for category in categories]
    assert base_category["id"] not in category_ids


def test_create_category_with_icon_and_color(client, category_base_fixture):
    """CREATE with icon/color: assert both fields round-trip through POST /categories."""
    headers = category_base_fixture["headers"]

    payload = {"name": "Transport", "kind": "expense", "icon": "ShoppingCart", "color": "#F44336"}
    response = client.post("/categories", json=payload, headers=headers)
    assert response.status_code == 200, response.text

    created_category = response.json()
    assert created_category["icon"] == "ShoppingCart"
    assert created_category["color"] == "#F44336"


def test_update_category_icon_and_color(client, category_base_fixture):
    """UPDATE icon/color: PATCH with new values and assert the changes persisted."""
    headers = category_base_fixture["headers"]
    base_category = category_base_fixture["base_category"]

    update_response = client.patch(
        f"/categories/{base_category['id']}",
        json={"icon": "Coffee", "color": "#2196F3"},
        headers=headers,
    )
    assert update_response.status_code == 200, update_response.text

    updated_category = update_response.json()
    assert updated_category["icon"] == "Coffee"
    assert updated_category["color"] == "#2196F3"


def test_clear_category_icon_and_color(client, category_base_fixture):
    """CLEAR icon/color: PATCH with explicit null values and assert fields become None."""
    headers = category_base_fixture["headers"]

    # Create a category that has icon and color set
    payload = {"name": "Leisure", "kind": "expense", "icon": "Music", "color": "#9C27B0"}
    create_response = client.post("/categories", json=payload, headers=headers)
    assert create_response.status_code == 200, create_response.text
    created_category = create_response.json()

    # Clear both fields with explicit null
    clear_response = client.patch(
        f"/categories/{created_category['id']}",
        json={"icon": None, "color": None},
        headers=headers,
    )
    assert clear_response.status_code == 200, clear_response.text

    cleared_category = clear_response.json()
    assert cleared_category["icon"] is None
    assert cleared_category["color"] is None
