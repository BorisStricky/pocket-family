"""
Tests for tenant default seeding on signup and tenant creation.

Validates that when a new tenant is created (via signup or POST /tenants),
the system automatically seeds:
- 12 default EXPENSE categories with correct parent-child hierarchy
- 1 default "Monthly Budget" at 1000.00 BRL linked to all 12 categories

Additionally, on signup only:
- 3 default accounts (CASH, DEBIT, CREDIT) shared with the new tenant

These tests are integration tests that hit API endpoints and verify the
seeded data through the standard GET endpoints.
"""

import pytest
from httpx import AsyncClient
from fastapi import status


# ---------------------------------------------------------------------------
# Helper: signup a new user and return (access_token, tenant_id)
# ---------------------------------------------------------------------------

async def _signup_user(
    async_client: AsyncClient,
    email: str = "seedtest@example.com",
    password: str = "testpassword123",
    name: str | None = "Boris",
) -> tuple[str, str]:
    """Sign up a fresh user and extract access_token + tenant_id from JWT.

    Returns a tuple of (access_token, tenant_id) so tests can immediately
    call authenticated endpoints scoped to the newly created tenant.
    """
    signup_payload = {
        "email": email,
        "password": password,
    }
    if name is not None:
        signup_payload["name"] = name

    signup_response = await async_client.post("/auth/signup", json=signup_payload)
    assert signup_response.status_code == status.HTTP_200_OK, (
        f"Signup failed: {signup_response.text}"
    )

    token_data = signup_response.json()
    access_token = token_data["access_token"]

    # Decode the JWT to extract tenant_id (middle segment is base64-encoded payload)
    import json
    import base64

    jwt_payload_segment = access_token.split(".")[1]
    # Add padding for base64 decoding (JWT omits trailing '=' chars)
    padded_payload = jwt_payload_segment + "=" * (4 - len(jwt_payload_segment) % 4)
    decoded_payload = json.loads(base64.urlsafe_b64decode(padded_payload))
    tenant_id = decoded_payload["tenant_id"]

    return access_token, tenant_id


def _authorization_header(token: str) -> dict:
    """Build an Authorization header dict for use with the test client."""
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Test class: Seed Defaults
# ---------------------------------------------------------------------------

class TestSeedDefaults:
    """
    Tests for automatic seeding of default data on tenant creation.

    Covers:
    - POST /auth/signup seeds categories, budget, and accounts
    - POST /tenants seeds categories and budget (but NOT accounts)
    - Category hierarchy matches the expected spec
    - Account naming uses user.name with fallback to email prefix
    """

    # -- Categories ----------------------------------------------------------

    @pytest.mark.asyncio
    async def test_signup_seeds_default_categories(self, async_client: AsyncClient):
        """
        Verify that signing up seeds exactly 12 EXPENSE categories.

        After signup the GET /categories endpoint (scoped to the new tenant)
        should return 12 categories (5 parents + 7 children), all with kind == "expense".
        """
        access_token, tenant_id = await _signup_user(async_client)

        categories_response = await async_client.get(
            "/categories",
            headers=_authorization_header(access_token),
        )

        assert categories_response.status_code == status.HTTP_200_OK

        categories = categories_response.json()
        assert len(categories) == 12, (
            f"Expected 12 seeded categories, got {len(categories)}: "
            f"{[category['name'] for category in categories]}"
        )

        # Every seeded category must be an EXPENSE kind
        for category in categories:
            assert category["kind"] == "expense", (
                f"Category '{category['name']}' has kind '{category['kind']}', expected 'expense'"
            )

    # -- Budget --------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_signup_seeds_default_budget(self, async_client: AsyncClient):
        """
        Verify that signing up seeds a single "Monthly Budget" at 1000.00 BRL.

        The budget should be linked to all 12 seeded categories via
        the BudgetCategory join table.
        """
        access_token, tenant_id = await _signup_user(async_client)

        budgets_response = await async_client.get(
            "/budgets",
            headers=_authorization_header(access_token),
        )

        assert budgets_response.status_code == status.HTTP_200_OK

        budgets = budgets_response.json()
        assert len(budgets) == 1, (
            f"Expected exactly 1 seeded budget, got {len(budgets)}"
        )

        monthly_budget = budgets[0]
        assert monthly_budget["name"] == "Monthly Budget"
        assert float(monthly_budget["amount"]) == 1000.00
        assert monthly_budget["currency"] == "BRL"

        # The budget should be linked to all 10 seeded categories
        budget_categories = monthly_budget.get("categories", [])
        assert len(budget_categories) == 12, (
            f"Expected budget linked to 12 categories, got {len(budget_categories)}"
        )

    # -- Accounts (signup only) ----------------------------------------------

    @pytest.mark.asyncio
    async def test_signup_seeds_default_accounts(self, async_client: AsyncClient):
        """
        Verify that signing up with name="Boris" creates 3 accounts:
        "Boris Cash", "Boris Debit", "Boris Credit".

        Each account should be shared with the new tenant via AccountShare
        with VISIBLE visibility, so they appear on GET /accounts?tenant_id=X.
        """
        access_token, tenant_id = await _signup_user(
            async_client,
            email="boris@example.com",
            name="Boris",
        )

        accounts_response = await async_client.get(
            f"/accounts?tenant_id={tenant_id}",
            headers=_authorization_header(access_token),
        )

        assert accounts_response.status_code == status.HTTP_200_OK

        accounts = accounts_response.json()
        assert len(accounts) == 3, (
            f"Expected 3 seeded accounts, got {len(accounts)}: "
            f"{[account['name'] for account in accounts]}"
        )

        # Collect account names and expected types
        account_names = sorted([account["name"] for account in accounts])
        expected_names = sorted(["Boris Cash", "Boris Debit", "Boris Credit"])
        assert account_names == expected_names, (
            f"Account names mismatch: got {account_names}, expected {expected_names}"
        )

        # Verify each account has the correct type
        account_type_map = {account["name"]: account["type"] for account in accounts}
        assert account_type_map["Boris Cash"] == "cash"
        assert account_type_map["Boris Debit"] == "debit"
        assert account_type_map["Boris Credit"] == "credit"

    @pytest.mark.asyncio
    async def test_signup_seeds_accounts_with_email_fallback(
        self, async_client: AsyncClient
    ):
        """
        Verify that when no name is provided at signup, accounts use
        the email prefix (part before @) as the display name.

        For email "nicky@example.com" without a name, accounts should be
        named "nicky Cash", "nicky Debit", "nicky Credit".
        """
        access_token, tenant_id = await _signup_user(
            async_client,
            email="nicky@example.com",
            password="testpassword123",
            name=None,
        )

        accounts_response = await async_client.get(
            f"/accounts?tenant_id={tenant_id}",
            headers=_authorization_header(access_token),
        )

        assert accounts_response.status_code == status.HTTP_200_OK

        accounts = accounts_response.json()
        assert len(accounts) == 3, (
            f"Expected 3 seeded accounts, got {len(accounts)}"
        )

        # With no name, the prefix of the email should be used
        account_names = sorted([account["name"] for account in accounts])
        expected_names = sorted(["nicky Cash", "nicky Debit", "nicky Credit"])
        assert account_names == expected_names, (
            f"Account names mismatch: got {account_names}, expected {expected_names}"
        )

    # -- Second tenant (POST /tenants) ---------------------------------------

    @pytest.mark.asyncio
    async def test_create_tenant_seeds_categories_and_budget(
        self, async_client: AsyncClient
    ):
        """
        Verify that creating a second tenant via POST /tenants also seeds
        default categories and a budget, but the user must switch to
        the new tenant to see them.

        Steps:
        1. Signup (creates first tenant with seeded data)
        2. POST /tenants to create a second tenant
        3. Switch to the second tenant via POST /tenants/{id}/switch
        4. GET /categories and GET /budgets on the second tenant
        """
        # Step 1: Signup creates first tenant
        access_token, first_tenant_id = await _signup_user(
            async_client,
            email="multitenant@example.com",
            name="Multi",
        )

        # Step 2: Create a second tenant
        create_tenant_response = await async_client.post(
            "/tenants",
            json={"name": "Second Family"},
            headers=_authorization_header(access_token),
        )
        assert create_tenant_response.status_code == status.HTTP_200_OK, (
            f"Tenant creation failed: {create_tenant_response.text}"
        )
        second_tenant_id = str(create_tenant_response.json()["id"])

        # Step 3: Switch to the second tenant to get a token scoped to it
        switch_response = await async_client.post(
            f"/tenants/{second_tenant_id}/switch",
            headers=_authorization_header(access_token),
        )
        assert switch_response.status_code == status.HTTP_200_OK, (
            f"Tenant switch failed: {switch_response.text}"
        )
        second_tenant_token = switch_response.json()["access_token"]

        # Step 4a: Verify categories on the second tenant
        categories_response = await async_client.get(
            "/categories",
            headers=_authorization_header(second_tenant_token),
        )
        assert categories_response.status_code == status.HTTP_200_OK
        second_tenant_categories = categories_response.json()
        assert len(second_tenant_categories) == 12, (
            f"Expected 12 categories on second tenant, got {len(second_tenant_categories)}"
        )

        # Step 4b: Verify budget on the second tenant
        budgets_response = await async_client.get(
            "/budgets",
            headers=_authorization_header(second_tenant_token),
        )
        assert budgets_response.status_code == status.HTTP_200_OK
        second_tenant_budgets = budgets_response.json()
        assert len(second_tenant_budgets) == 1, (
            f"Expected 1 budget on second tenant, got {len(second_tenant_budgets)}"
        )
        assert second_tenant_budgets[0]["name"] == "Monthly Budget"

    @pytest.mark.asyncio
    async def test_create_tenant_does_not_seed_accounts(
        self, async_client: AsyncClient
    ):
        """
        Verify that creating a second tenant via POST /tenants does NOT
        seed additional accounts. Only signup seeds accounts.

        After creating a second tenant, the total number of accounts
        visible in the second tenant should be 0 (no AccountShare rows
        linking existing accounts to the new tenant).
        """
        # Signup creates first tenant + 3 accounts
        access_token, first_tenant_id = await _signup_user(
            async_client,
            email="noaccount@example.com",
            name="NoAcc",
        )

        # Create second tenant
        create_tenant_response = await async_client.post(
            "/tenants",
            json={"name": "No Account Family"},
            headers=_authorization_header(access_token),
        )
        assert create_tenant_response.status_code == status.HTTP_200_OK
        second_tenant_id = str(create_tenant_response.json()["id"])

        # Switch to second tenant
        switch_response = await async_client.post(
            f"/tenants/{second_tenant_id}/switch",
            headers=_authorization_header(access_token),
        )
        assert switch_response.status_code == status.HTTP_200_OK
        second_tenant_token = switch_response.json()["access_token"]

        # Accounts on the second tenant should be empty (no shares created)
        accounts_response = await async_client.get(
            f"/accounts?tenant_id={second_tenant_id}",
            headers=_authorization_header(second_tenant_token),
        )
        assert accounts_response.status_code == status.HTTP_200_OK
        second_tenant_accounts = accounts_response.json()
        assert len(second_tenant_accounts) == 0, (
            f"Expected 0 accounts on second tenant, got {len(second_tenant_accounts)}: "
            f"{[account['name'] for account in second_tenant_accounts]}"
        )

        # Original tenant should still have exactly 3 accounts
        first_tenant_accounts_response = await async_client.get(
            f"/accounts?tenant_id={first_tenant_id}",
            headers=_authorization_header(access_token),
        )
        assert first_tenant_accounts_response.status_code == status.HTTP_200_OK
        first_tenant_accounts = first_tenant_accounts_response.json()
        assert len(first_tenant_accounts) == 3, (
            f"Expected 3 accounts on first tenant, got {len(first_tenant_accounts)}"
        )

    # -- Category hierarchy --------------------------------------------------

    @pytest.mark.asyncio
    async def test_seeded_categories_have_correct_hierarchy(
        self, async_client: AsyncClient
    ):
        """
        Verify that seeded categories have the correct parent-child structure.

        Expected hierarchy:
        - Bills (no parent)
        - Food (no parent)
          - Eat Out (parent: Food)
          - Groceries (parent: Food)
        - Leisure (no parent)
          - Sports (parent: Leisure)
          - Movies (parent: Leisure)
          - Music (parent: Leisure)
        - Transport (no parent)
          - Fuel (parent: Transport)
          - Taxi/Uber (parent: Transport)
        - Other (no parent)

        Total: 5 top-level + 2 Food children + 3 Leisure children + 2 Transport children = 12
        """
        access_token, tenant_id = await _signup_user(
            async_client,
            email="hierarchy@example.com",
            name="Hierarchy",
        )

        categories_response = await async_client.get(
            "/categories",
            headers=_authorization_header(access_token),
        )
        assert categories_response.status_code == status.HTTP_200_OK

        categories = categories_response.json()

        # Build lookup by name for easy assertion
        category_by_name = {category["name"]: category for category in categories}

        # Verify all expected category names are present
        expected_category_names = {
            "Bills", "Food", "Eat Out", "Groceries",
            "Leisure", "Sports", "Movies", "Music",
            "Transport", "Fuel", "Taxi/Uber", "Other",
        }
        actual_category_names = set(category_by_name.keys())
        assert actual_category_names == expected_category_names, (
            f"Category name mismatch.\n"
            f"Missing: {expected_category_names - actual_category_names}\n"
            f"Extra: {actual_category_names - expected_category_names}"
        )

        # Verify top-level categories have no parent
        top_level_category_names = {"Bills", "Food", "Leisure", "Transport", "Other"}
        for category_name in top_level_category_names:
            assert category_by_name[category_name]["parent_id"] is None, (
                f"'{category_name}' should be a top-level category (no parent)"
            )

        # Verify Food children point to Food as parent
        food_category_id = category_by_name["Food"]["id"]
        for child_name in ("Eat Out", "Groceries"):
            assert category_by_name[child_name]["parent_id"] == food_category_id, (
                f"'{child_name}' should have parent_id == Food's id"
            )
            assert category_by_name[child_name]["parent_name"] == "Food", (
                f"'{child_name}' should have parent_name == 'Food'"
            )

        # Verify Leisure children point to Leisure as parent
        leisure_category_id = category_by_name["Leisure"]["id"]
        for child_name in ("Sports", "Movies", "Music"):
            assert category_by_name[child_name]["parent_id"] == leisure_category_id, (
                f"'{child_name}' should have parent_id == Leisure's id"
            )
            assert category_by_name[child_name]["parent_name"] == "Leisure", (
                f"'{child_name}' should have parent_name == 'Leisure'"
            )

        # Verify Transport children point to Transport as parent
        transport_category_id = category_by_name["Transport"]["id"]
        for child_name in ("Fuel", "Taxi/Uber"):
            assert category_by_name[child_name]["parent_id"] == transport_category_id, (
                f"'{child_name}' should have parent_id == Transport's id"
            )
            assert category_by_name[child_name]["parent_name"] == "Transport", (
                f"'{child_name}' should have parent_name == 'Transport'"
            )
