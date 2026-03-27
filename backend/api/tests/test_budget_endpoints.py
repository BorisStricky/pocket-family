"""
Tests for budget CRUD endpoints.

Validates budget create, read (list and single), update, and delete operations
including:
- Multi-category budget creation and management
- Spent calculation across categories with currency filtering
- Universal budgets (no categories) tracking all tenant expenses
- Historical month queries via ?month=N&year=YYYY
- Multi-tenant data isolation (cannot access other tenant's budgets or categories)
- Authorization checks (OWNER can mutate, MEMBER/VIEWER can only read)
- Input validation (negative amount, empty name, non-existent category)
- CASCADE delete behavior (category deletion removes budget_category rows)
- Currency filtering (only transactions matching budget.currency count toward spent)
"""

import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from fastapi import status

from app.models import (
    Budget,
    BudgetCategory,
    Category,
    Transaction,
    Account,
    CategoryKind,
    Currency,
    TransactionSource,
    User,
    Tenant,
    Membership,
)
from tests.conftest import authorization_header


# ---------------------
# Budget CRUD Tests
# ---------------------


class TestBudgetCreate:
    """
    Tests for POST /budgets endpoint.

    Covers:
    - Successful budget creation with and without categories
    - Multi-category assignment
    - Currency field handling
    - Authorization (OWNER only)
    - Validation errors
    """

    @pytest.mark.asyncio
    async def test_create_budget_success_without_categories(
        self,
        async_client: AsyncClient,
        owner_token: str,
        test_tenant: Tenant,
    ):
        """
        Test creating a universal budget (no categories).

        Verifies that:
        - Budget is created successfully with 201 status
        - Response includes all expected fields
        - Categories list is empty for a universal budget
        - Currency defaults to BRL when not specified
        - Spent starts at 0.00
        """
        budget_data = {
            "name": "Monthly Total",
            "amount": "2000.00",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_201_CREATED

        response_body = response.json()
        assert response_body["name"] == "Monthly Total"
        assert Decimal(response_body["amount"]) == Decimal("2000.00")
        assert response_body["currency"] == "BRL"
        assert response_body["categories"] == []
        assert Decimal(response_body["spent"]) == Decimal("0.00")
        assert response_body["tenant_id"] == str(test_tenant.id)
        assert "id" in response_body
        assert "created_at" in response_body
        assert "updated_at" in response_body
        assert "month" in response_body
        assert "year" in response_body

    @pytest.mark.asyncio
    async def test_create_budget_with_single_category(
        self,
        async_client: AsyncClient,
        owner_token: str,
        expense_category_food: Category,
    ):
        """
        Test creating a budget linked to a single category.

        Verifies that the budget's categories list contains the
        linked category with correct name and ID.
        """
        budget_data = {
            "name": "Food Budget",
            "amount": "500.00",
            "category_ids": [str(expense_category_food.id)],
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_201_CREATED

        response_body = response.json()
        assert response_body["name"] == "Food Budget"
        assert len(response_body["categories"]) == 1
        assert response_body["categories"][0]["name"] == "Food"
        assert response_body["categories"][0]["id"] == str(expense_category_food.id)

    @pytest.mark.asyncio
    async def test_create_budget_with_multiple_categories(
        self,
        async_client: AsyncClient,
        owner_token: str,
        expense_category_food: Category,
        expense_category_entertainment: Category,
        expense_category_transport: Category,
    ):
        """
        Test creating a budget linked to multiple categories.

        Verifies that:
        - All three categories are associated with the budget
        - Categories are returned in the response
        """
        budget_data = {
            "name": "Essential Spending",
            "amount": "1500.00",
            "category_ids": [
                str(expense_category_food.id),
                str(expense_category_entertainment.id),
                str(expense_category_transport.id),
            ],
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_201_CREATED

        response_body = response.json()
        category_names = sorted([
            category["name"] for category in response_body["categories"]
        ])
        assert category_names == ["Entertainment", "Food", "Transport"]

    @pytest.mark.asyncio
    async def test_create_budget_with_explicit_currency(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test creating a budget with an explicit currency code.

        Verifies that the currency field is correctly stored and
        returned when explicitly provided as USD.
        """
        budget_data = {
            "name": "USD Travel Budget",
            "amount": "1000.00",
            "currency": "USD",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["currency"] == "USD"

    @pytest.mark.asyncio
    async def test_create_budget_with_eur_currency(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test creating a budget with EUR currency.

        Verifies that all three supported currency codes work.
        """
        budget_data = {
            "name": "EUR Budget",
            "amount": "800.00",
            "currency": "EUR",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["currency"] == "EUR"


class TestBudgetRead:
    """
    Tests for GET /budgets and GET /budgets/{budget_id} endpoints.

    Covers:
    - Listing all budgets for a tenant
    - Retrieving a single budget by ID
    - Historical month queries
    - Empty budget list
    - Budget not found
    """

    @pytest.mark.asyncio
    async def test_list_budgets_returns_all_tenant_budgets(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
    ):
        """
        Test listing all budgets for the current tenant.

        Verifies that GET /budgets returns all budgets belonging to
        the authenticated user's tenant, ordered by name.
        """
        # Create two budgets directly in the database
        budget_one = Budget(
            tenant_id=test_tenant.id,
            name="Alpha Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        budget_two = Budget(
            tenant_id=test_tenant.id,
            name="Beta Budget",
            amount=Decimal("2000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget_one)
        async_session.add(budget_two)
        await async_session.commit()

        response = await async_client.get(
            "/budgets",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK

        response_body = response.json()
        assert len(response_body) == 2
        # Budgets are ordered by name alphabetically
        assert response_body[0]["name"] == "Alpha Budget"
        assert response_body[1]["name"] == "Beta Budget"

    @pytest.mark.asyncio
    async def test_list_budgets_returns_empty_when_no_budgets(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test that listing budgets returns an empty list when no budgets exist.

        Verifies 200 response with empty array (not 404).
        """
        response = await async_client.get(
            "/budgets",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_single_budget_by_id(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        expense_category_food: Category,
    ):
        """
        Test retrieving a single budget by its UUID.

        Verifies that:
        - Response includes all BudgetRead fields
        - Categories are populated
        - Spent is calculated for the current month
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Food Budget",
            amount=Decimal("500.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        # Link category to budget via join table
        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)
        await async_session.commit()

        response = await async_client.get(
            f"/budgets/{budget.id}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK

        response_body = response.json()
        assert response_body["id"] == str(budget.id)
        assert response_body["name"] == "Food Budget"
        assert Decimal(response_body["amount"]) == Decimal("500.00")
        assert len(response_body["categories"]) == 1
        assert response_body["categories"][0]["name"] == "Food"

    @pytest.mark.asyncio
    async def test_get_budget_not_found(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test that requesting a non-existent budget returns 404.

        Verifies proper error handling for invalid budget IDs.
        """
        fake_budget_id = uuid4()

        response = await async_client.get(
            f"/budgets/{fake_budget_id}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Budget not found"


class TestBudgetUpdate:
    """
    Tests for PATCH /budgets/{budget_id} endpoint.

    Covers:
    - Updating name, amount, and currency fields
    - Category replacement via category_ids
    - Omitting category_ids leaves categories unchanged
    - Authorization (OWNER only)
    - Budget not found
    """

    @pytest.mark.asyncio
    async def test_update_budget_name(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
    ):
        """
        Test updating only the budget name via PATCH.

        Verifies that:
        - Name is updated in the response
        - Other fields remain unchanged
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Original Name",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={"name": "Updated Name"},
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        response_body = response.json()
        assert response_body["name"] == "Updated Name"
        assert Decimal(response_body["amount"]) == Decimal("1000.00")

    @pytest.mark.asyncio
    async def test_update_budget_amount(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
    ):
        """
        Test updating the budget amount via PATCH.

        Verifies the amount is correctly updated to the new value.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Test Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={"amount": "2500.00"},
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        assert Decimal(response.json()["amount"]) == Decimal("2500.00")

    @pytest.mark.asyncio
    async def test_update_budget_currency(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
    ):
        """
        Test updating the budget currency via PATCH.

        Verifies currency code is changed from BRL to USD.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Test Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={"currency": "USD"},
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["currency"] == "USD"

    @pytest.mark.asyncio
    async def test_update_budget_not_found(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test that updating a non-existent budget returns 404.
        """
        fake_budget_id = uuid4()

        response = await async_client.patch(
            f"/budgets/{fake_budget_id}",
            json={"name": "New Name"},
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestBudgetDelete:
    """
    Tests for DELETE /budgets/{budget_id} endpoint.

    Covers:
    - Successful deletion returning 204 No Content
    - Budget not found returns 404
    - Authorization (OWNER only)
    """

    @pytest.mark.asyncio
    async def test_delete_budget_success(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
    ):
        """
        Test successful budget deletion.

        Verifies that:
        - DELETE returns 204 No Content
        - Budget is removed from the database
        - Subsequent GET returns 404
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="To Delete",
            amount=Decimal("100.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        delete_response = await async_client.delete(
            f"/budgets/{budget.id}",
            headers=authorization_header(owner_token),
        )

        assert delete_response.status_code == status.HTTP_204_NO_CONTENT

        # Verify budget is gone
        get_response = await async_client.get(
            f"/budgets/{budget.id}",
            headers=authorization_header(owner_token),
        )
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_delete_budget_not_found(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test that deleting a non-existent budget returns 404.
        """
        fake_budget_id = uuid4()

        response = await async_client.delete(
            f"/budgets/{fake_budget_id}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_delete_budget_removes_budget_category_rows(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        expense_category_food: Category,
    ):
        """
        Test that deleting a budget CASCADE removes budget_category join rows.

        Verifies that:
        - Budget is deleted
        - Associated BudgetCategory rows are automatically removed
        - The category itself remains intact
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Budget With Category",
            amount=Decimal("500.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)
        await async_session.commit()

        # Delete the budget
        delete_response = await async_client.delete(
            f"/budgets/{budget.id}",
            headers=authorization_header(owner_token),
        )
        assert delete_response.status_code == status.HTTP_204_NO_CONTENT

        # Verify budget_category rows are gone
        budget_category_result = await async_session.execute(
            select(BudgetCategory).where(BudgetCategory.budget_id == budget.id)
        )
        remaining_rows = budget_category_result.scalars().all()
        assert len(remaining_rows) == 0

        # Verify the category itself still exists
        category_record = await async_session.get(Category, expense_category_food.id)
        assert category_record is not None
        assert category_record.name == "Food"


# ---------------------
# Category Update via PATCH Tests
# ---------------------


class TestCategoryUpdateViaPatch:
    """
    Tests for category replacement behavior in PATCH /budgets/{budget_id}.

    Covers:
    - Sending category_ids replaces the entire category set
    - Omitting category_ids leaves existing categories unchanged
    - Sending empty category_ids removes all categories
    """

    @pytest.mark.asyncio
    async def test_patch_with_category_ids_replaces_entire_set(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        expense_category_food: Category,
        expense_category_entertainment: Category,
        expense_category_transport: Category,
    ):
        """
        Test that PATCH with category_ids fully replaces the category set.

        Starts with Food category, patches to Entertainment + Transport.
        Verifies Food is no longer linked and the new categories are.
        """
        # Create budget with Food category
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Test Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)
        await async_session.commit()

        # Patch to replace with Entertainment + Transport
        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={
                "category_ids": [
                    str(expense_category_entertainment.id),
                    str(expense_category_transport.id),
                ]
            },
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK

        response_body = response.json()
        category_names = sorted([
            category["name"] for category in response_body["categories"]
        ])
        assert category_names == ["Entertainment", "Transport"]
        # Food should no longer be linked
        assert "Food" not in category_names

    @pytest.mark.asyncio
    async def test_patch_without_category_ids_leaves_categories_unchanged(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        expense_category_food: Category,
    ):
        """
        Test that omitting category_ids from PATCH payload leaves categories unchanged.

        Creates a budget with Food category, patches only the name,
        and verifies Food is still linked.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Original Budget",
            amount=Decimal("500.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)
        await async_session.commit()

        # Patch only the name, not category_ids
        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={"name": "Renamed Budget"},
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK

        response_body = response.json()
        assert response_body["name"] == "Renamed Budget"
        # Categories should still contain Food
        assert len(response_body["categories"]) == 1
        assert response_body["categories"][0]["name"] == "Food"

    @pytest.mark.asyncio
    async def test_patch_with_empty_category_ids_removes_all_categories(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        expense_category_food: Category,
    ):
        """
        Test that sending empty category_ids list removes all categories.

        This converts a category-scoped budget into a universal budget.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Becoming Universal",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)
        await async_session.commit()

        # Patch with empty category list
        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={"category_ids": []},
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["categories"] == []


# ---------------------
# Multi-Category Spent Calculation Tests
# ---------------------


class TestSpentCalculation:
    """
    Tests for budget spent amount calculation.

    Covers:
    - Spent sums across all categories linked to a budget
    - Universal budget (no categories) sums ALL tenant expenses
    - Only expense transactions are counted (not income)
    - Spent is 0.00 when no matching transactions exist
    """

    @pytest.mark.asyncio
    async def test_spent_sums_across_multiple_categories(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        test_user: User,
        test_account_brl: Account,
        expense_category_food: Category,
        expense_category_entertainment: Category,
    ):
        """
        Test that spent aggregates transactions from all linked categories.

        Creates a budget with Food and Entertainment categories, then
        creates expense transactions in both categories. Verifies the
        spent amount is the sum of all matching transactions.
        """
        current_month = datetime.now(timezone.utc).month
        current_year = datetime.now(timezone.utc).year

        # Create budget with two categories
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Multi-Category Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        for category_id in [expense_category_food.id, expense_category_entertainment.id]:
            budget_category = BudgetCategory(
                tenant_id=test_tenant.id,
                budget_id=budget.id,
                category_id=category_id,
            )
            async_session.add(budget_category)

        # Create transactions in Food category: 100 + 50 = 150
        food_transaction_one = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("100.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 5),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )
        food_transaction_two = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("50.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 10),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        # Create transaction in Entertainment category: 75
        entertainment_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_entertainment.id,
            amount=Decimal("75.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 15),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        async_session.add_all([
            food_transaction_one,
            food_transaction_two,
            entertainment_transaction,
        ])
        await async_session.commit()

        # Fetch the budget and check spent
        response = await async_client.get(
            f"/budgets/{budget.id}?month={current_month}&year={current_year}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        # 100 + 50 + 75 = 225
        assert Decimal(response.json()["spent"]) == Decimal("225.00")

    @pytest.mark.asyncio
    async def test_universal_budget_sums_all_tenant_expenses(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        test_user: User,
        test_account_brl: Account,
        expense_category_food: Category,
        expense_category_transport: Category,
    ):
        """
        Test that a universal budget (no categories) sums ALL tenant expenses.

        Creates a budget with no linked categories, then creates
        transactions in different categories. Verifies all are counted.
        """
        current_month = datetime.now(timezone.utc).month
        current_year = datetime.now(timezone.utc).year

        # Create universal budget (no categories)
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Universal Budget",
            amount=Decimal("5000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        # Create transactions in different categories
        transaction_food = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("200.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 5),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )
        transaction_transport = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_transport.id,
            amount=Decimal("300.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 10),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        async_session.add_all([transaction_food, transaction_transport])
        await async_session.commit()

        response = await async_client.get(
            f"/budgets/{budget.id}?month={current_month}&year={current_year}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        # 200 + 300 = 500, counting ALL expense transactions
        assert Decimal(response.json()["spent"]) == Decimal("500.00")

    @pytest.mark.asyncio
    async def test_spent_excludes_income_transactions(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        test_user: User,
        test_account_brl: Account,
        expense_category_food: Category,
        income_category: Category,
    ):
        """
        Test that income transactions are NOT counted in spent calculation.

        Creates both expense and income transactions. Only expenses
        should be included in the spent total.
        """
        current_month = datetime.now(timezone.utc).month
        current_year = datetime.now(timezone.utc).year

        # Universal budget (no categories)
        budget = Budget(
            tenant_id=test_tenant.id,
            name="All Spending",
            amount=Decimal("3000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        # Expense transaction
        expense_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("150.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 5),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        # Income transaction (should NOT be counted)
        income_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=income_category.id,
            amount=Decimal("5000.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 1),
            transaction_type=CategoryKind.INCOME,
            created_by=test_user.id,
        )

        async_session.add_all([expense_transaction, income_transaction])
        await async_session.commit()

        response = await async_client.get(
            f"/budgets/{budget.id}?month={current_month}&year={current_year}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        # Only the 150 expense counts, not the 5000 income
        assert Decimal(response.json()["spent"]) == Decimal("150.00")

    @pytest.mark.asyncio
    async def test_spent_is_zero_when_no_transactions(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        expense_category_food: Category,
    ):
        """
        Test that spent is 0.00 when no matching transactions exist.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Empty Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)
        await async_session.commit()

        current_month = datetime.now(timezone.utc).month
        current_year = datetime.now(timezone.utc).year

        response = await async_client.get(
            f"/budgets/{budget.id}?month={current_month}&year={current_year}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        assert Decimal(response.json()["spent"]) == Decimal("0.00")


# ---------------------
# Historical Month Query Tests
# ---------------------


class TestHistoricalMonthQuery:
    """
    Tests for historical month queries via ?month=N&year=YYYY.

    Covers:
    - Querying spent for a specific past month
    - Different months return different spent amounts
    - Default to current month when not specified
    """

    @pytest.mark.asyncio
    async def test_get_budget_with_specific_month_and_year(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        test_user: User,
        test_account_brl: Account,
        expense_category_food: Category,
    ):
        """
        Test querying spent for a specific historical month.

        Creates transactions in January 2025, then queries that month
        to verify the correct spent amount is returned.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Historical Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)

        # Create transaction in January 2025
        january_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("350.00"),
            currency=Currency.BRL,
            transaction_date=date(2025, 1, 15),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )
        async_session.add(january_transaction)
        await async_session.commit()

        # Query for January 2025
        response = await async_client.get(
            f"/budgets/{budget.id}?month=1&year=2025",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK

        response_body = response.json()
        assert Decimal(response_body["spent"]) == Decimal("350.00")
        assert response_body["month"] == 1
        assert response_body["year"] == 2025

    @pytest.mark.asyncio
    async def test_different_months_return_different_spent(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        test_user: User,
        test_account_brl: Account,
        expense_category_food: Category,
    ):
        """
        Test that querying different months returns correct per-month spent.

        Creates transactions in both January and February 2025, then
        verifies each month query returns only that month's total.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Monthly Tracker",
            amount=Decimal("2000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)

        # January transaction: 100
        january_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("100.00"),
            currency=Currency.BRL,
            transaction_date=date(2025, 1, 10),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        # February transaction: 250
        february_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("250.00"),
            currency=Currency.BRL,
            transaction_date=date(2025, 2, 20),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        async_session.add_all([january_transaction, february_transaction])
        await async_session.commit()

        # Query January
        january_response = await async_client.get(
            f"/budgets/{budget.id}?month=1&year=2025",
            headers=authorization_header(owner_token),
        )
        assert Decimal(january_response.json()["spent"]) == Decimal("100.00")

        # Query February
        february_response = await async_client.get(
            f"/budgets/{budget.id}?month=2&year=2025",
            headers=authorization_header(owner_token),
        )
        assert Decimal(february_response.json()["spent"]) == Decimal("250.00")

    @pytest.mark.asyncio
    async def test_list_budgets_with_historical_month(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        test_user: User,
        test_account_brl: Account,
        expense_category_food: Category,
    ):
        """
        Test that GET /budgets list endpoint also supports month/year query.

        Verifies the list endpoint returns correct spent for a historical month.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="List Historical",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)

        historical_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("400.00"),
            currency=Currency.BRL,
            transaction_date=date(2025, 6, 15),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )
        async_session.add(historical_transaction)
        await async_session.commit()

        response = await async_client.get(
            "/budgets?month=6&year=2025",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        budgets_list = response.json()
        assert len(budgets_list) == 1
        assert Decimal(budgets_list[0]["spent"]) == Decimal("400.00")
        assert budgets_list[0]["month"] == 6
        assert budgets_list[0]["year"] == 2025


# ---------------------
# Tenant Isolation Tests
# ---------------------


class TestTenantIsolation:
    """
    Tests for multi-tenant data isolation on budget endpoints.

    Critical security tests verifying:
    - User cannot see budgets from other tenants
    - User cannot access a specific budget from another tenant
    - User cannot link categories from another tenant
    - budget_category.tenant_id is validated
    """

    @pytest.mark.asyncio
    async def test_list_budgets_filters_by_tenant(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        other_tenant_token: str,
        test_tenant: Tenant,
        other_tenant: Tenant,
    ):
        """
        Test that listing budgets only returns budgets from the current tenant.

        Creates budgets in both tenants and verifies each user
        only sees their own tenant's budgets.
        """
        # Budget in test_tenant
        budget_current = Budget(
            tenant_id=test_tenant.id,
            name="My Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        # Budget in other_tenant
        budget_other = Budget(
            tenant_id=other_tenant.id,
            name="Other Budget",
            amount=Decimal("2000.00"),
            currency=Currency.BRL,
        )
        async_session.add_all([budget_current, budget_other])
        await async_session.commit()

        # Request as test_tenant owner
        response = await async_client.get(
            "/budgets",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        budgets_list = response.json()

        # Only the current tenant's budget should be returned
        assert len(budgets_list) == 1
        assert budgets_list[0]["name"] == "My Budget"
        assert budgets_list[0]["tenant_id"] == str(test_tenant.id)

    @pytest.mark.asyncio
    async def test_get_budget_from_other_tenant_returns_404(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        other_tenant: Tenant,
    ):
        """
        Test that accessing a budget from another tenant returns 404.

        The budget exists but belongs to a different tenant, so it
        should appear as "not found" to prevent information leakage.
        """
        # Create budget in other tenant
        other_budget = Budget(
            tenant_id=other_tenant.id,
            name="Secret Budget",
            amount=Decimal("5000.00"),
            currency=Currency.BRL,
        )
        async_session.add(other_budget)
        await async_session.commit()
        await async_session.refresh(other_budget)

        # Try to access it from test_tenant context
        response = await async_client.get(
            f"/budgets/{other_budget.id}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_cannot_create_budget_with_other_tenant_categories(
        self,
        async_client: AsyncClient,
        owner_token: str,
        other_tenant_category: Category,
    ):
        """
        Test that creating a budget with categories from another tenant fails.

        Verifies 400 Bad Request when category_ids contain UUIDs
        belonging to a different tenant.
        """
        budget_data = {
            "name": "Cross-Tenant Budget",
            "amount": "500.00",
            "category_ids": [str(other_tenant_category.id)],
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "category" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_cannot_patch_budget_with_other_tenant_categories(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        other_tenant_category: Category,
    ):
        """
        Test that patching a budget with categories from another tenant fails.

        Verifies 400 Bad Request when PATCH category_ids contain
        cross-tenant category UUIDs.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="My Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={"category_ids": [str(other_tenant_category.id)]},
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.asyncio
    async def test_cannot_update_other_tenant_budget(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        other_tenant: Tenant,
    ):
        """
        Test that updating a budget from another tenant returns 404.

        Budget exists in other_tenant but should not be accessible
        from test_tenant context.
        """
        other_budget = Budget(
            tenant_id=other_tenant.id,
            name="Other Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(other_budget)
        await async_session.commit()
        await async_session.refresh(other_budget)

        response = await async_client.patch(
            f"/budgets/{other_budget.id}",
            json={"name": "Hacked Name"},
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_cannot_delete_other_tenant_budget(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        other_tenant: Tenant,
    ):
        """
        Test that deleting a budget from another tenant returns 404.
        """
        other_budget = Budget(
            tenant_id=other_tenant.id,
            name="Other Budget",
            amount=Decimal("500.00"),
            currency=Currency.BRL,
        )
        async_session.add(other_budget)
        await async_session.commit()
        await async_session.refresh(other_budget)

        response = await async_client.delete(
            f"/budgets/{other_budget.id}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------
# Authorization Tests
# ---------------------


class TestAuthorization:
    """
    Tests for role-based authorization on budget endpoints.

    Covers:
    - Only OWNER can create budgets (MEMBER and VIEWER get 403)
    - Only OWNER can update budgets
    - Only OWNER can delete budgets
    - All roles (OWNER, MEMBER, VIEWER) can read budgets
    - Unauthenticated requests get 401
    """

    @pytest.mark.asyncio
    async def test_member_cannot_create_budget(
        self,
        async_client: AsyncClient,
        member_token: str,
    ):
        """
        Test that MEMBER role cannot create budgets (403 Forbidden).
        """
        budget_data = {
            "name": "Member Budget",
            "amount": "500.00",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(member_token),
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_viewer_cannot_create_budget(
        self,
        async_client: AsyncClient,
        viewer_token: str,
    ):
        """
        Test that VIEWER role cannot create budgets (403 Forbidden).
        """
        budget_data = {
            "name": "Viewer Budget",
            "amount": "500.00",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(viewer_token),
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_member_cannot_update_budget(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        member_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that MEMBER role cannot update budgets (403 Forbidden).
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Owner Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={"name": "Renamed By Member"},
            headers=authorization_header(member_token),
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_viewer_cannot_update_budget(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        viewer_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that VIEWER role cannot update budgets (403 Forbidden).
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Owner Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={"name": "Renamed By Viewer"},
            headers=authorization_header(viewer_token),
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_member_cannot_delete_budget(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        member_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that MEMBER role cannot delete budgets (403 Forbidden).
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Protected Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        response = await async_client.delete(
            f"/budgets/{budget.id}",
            headers=authorization_header(member_token),
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_viewer_cannot_delete_budget(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        viewer_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that VIEWER role cannot delete budgets (403 Forbidden).
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Protected Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        response = await async_client.delete(
            f"/budgets/{budget.id}",
            headers=authorization_header(viewer_token),
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_member_can_list_budgets(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        member_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that MEMBER role can list budgets (200 OK).

        All authenticated tenant members should have read access.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Visible Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()

        response = await async_client.get(
            "/budgets",
            headers=authorization_header(member_token),
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 1

    @pytest.mark.asyncio
    async def test_viewer_can_list_budgets(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        viewer_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that VIEWER role can list budgets (200 OK).
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Visible Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()

        response = await async_client.get(
            "/budgets",
            headers=authorization_header(viewer_token),
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 1

    @pytest.mark.asyncio
    async def test_member_can_get_single_budget(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        member_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that MEMBER role can retrieve a single budget by ID.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Readable Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        response = await async_client.get(
            f"/budgets/{budget.id}",
            headers=authorization_header(member_token),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "Readable Budget"

    @pytest.mark.asyncio
    async def test_unauthenticated_request_returns_401(
        self,
        async_client: AsyncClient,
    ):
        """
        Test that requests without Authorization header return 401.
        """
        response = await async_client.get("/budgets")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_unauthenticated_create_returns_401(
        self,
        async_client: AsyncClient,
    ):
        """
        Test that creating a budget without authentication returns 401.
        """
        budget_data = {
            "name": "Unauthorized Budget",
            "amount": "500.00",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------
# Validation Tests
# ---------------------


class TestValidation:
    """
    Tests for input validation on budget endpoints.

    Covers:
    - Negative amount rejected
    - Zero amount rejected
    - Non-existent category ID
    - Invalid currency code
    - Missing required fields
    """

    @pytest.mark.asyncio
    async def test_create_budget_with_negative_amount_rejected(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test that creating a budget with a negative amount returns 422.

        Budget amounts must be > 0 per the BudgetCreate schema validation.
        """
        budget_data = {
            "name": "Negative Budget",
            "amount": "-100.00",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_create_budget_with_zero_amount_rejected(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test that creating a budget with zero amount returns 422.

        Budget amounts must be strictly greater than 0.
        """
        budget_data = {
            "name": "Zero Budget",
            "amount": "0.00",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_create_budget_with_non_existent_category_rejected(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test that providing a non-existent category ID returns 400.

        The category UUID does not exist in any tenant, so it fails
        the category validation check.
        """
        fake_category_id = str(uuid4())

        budget_data = {
            "name": "Bad Category Budget",
            "amount": "500.00",
            "category_ids": [fake_category_id],
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "category" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_create_budget_with_invalid_currency_rejected(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test that providing an invalid currency code returns 422.

        Only BRL, USD, and EUR are valid Currency enum values.
        """
        budget_data = {
            "name": "Invalid Currency",
            "amount": "500.00",
            "currency": "XYZ",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_create_budget_missing_name_rejected(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test that creating a budget without a name returns 422.

        Name is a required field in the BudgetCreate schema.
        """
        budget_data = {
            "amount": "500.00",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_create_budget_missing_amount_rejected(
        self,
        async_client: AsyncClient,
        owner_token: str,
    ):
        """
        Test that creating a budget without an amount returns 422.

        Amount is a required field in the BudgetCreate schema.
        """
        budget_data = {
            "name": "No Amount",
        }

        response = await async_client.post(
            "/budgets",
            json=budget_data,
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_update_budget_with_negative_amount_rejected(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that updating a budget with a negative amount returns 422.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Valid Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={"amount": "-50.00"},
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_update_budget_with_non_existent_category_rejected(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that patching with a non-existent category ID returns 400.
        """
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Valid Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        fake_category_id = str(uuid4())

        response = await async_client.patch(
            f"/budgets/{budget.id}",
            json={"category_ids": [fake_category_id]},
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------
# CASCADE Delete Tests
# ---------------------


class TestCascadeDelete:
    """
    Tests for CASCADE delete behavior on related entities.

    Covers:
    - Deleting a category removes budget_category rows
    - Budget remains valid after linked category is deleted
    """

    @pytest.mark.asyncio
    async def test_deleting_category_removes_budget_category_rows(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that deleting a category CASCADE removes budget_category rows.

        Verifies that:
        - BudgetCategory join rows referencing the deleted category are removed
        - The budget itself still exists
        - The budget's remaining categories are intact
        """
        # Create two categories
        category_food = Category(
            tenant_id=test_tenant.id,
            name="Food",
            kind=CategoryKind.EXPENSE,
        )
        category_games = Category(
            tenant_id=test_tenant.id,
            name="Games",
            kind=CategoryKind.EXPENSE,
        )
        async_session.add_all([category_food, category_games])
        await async_session.commit()
        await async_session.refresh(category_food)
        await async_session.refresh(category_games)

        # Create budget linked to both categories
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Entertainment Budget",
            amount=Decimal("500.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category_food = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=category_food.id,
        )
        budget_category_games = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=category_games.id,
        )
        async_session.add_all([budget_category_food, budget_category_games])
        await async_session.commit()

        # Delete the Food category directly from the database
        await async_session.delete(category_food)
        await async_session.commit()

        # Verify budget still exists
        budget_record = await async_session.get(Budget, budget.id)
        assert budget_record is not None
        assert budget_record.name == "Entertainment Budget"

        # Verify only the Games budget_category row remains
        budget_category_result = await async_session.execute(
            select(BudgetCategory).where(BudgetCategory.budget_id == budget.id)
        )
        remaining_budget_categories = budget_category_result.scalars().all()
        assert len(remaining_budget_categories) == 1
        assert remaining_budget_categories[0].category_id == category_games.id

    @pytest.mark.asyncio
    async def test_budget_readable_after_category_deletion(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
    ):
        """
        Test that a budget remains readable via API after a linked category is deleted.

        Verifies the budget can still be fetched and returns the
        remaining categories correctly.
        """
        category = Category(
            tenant_id=test_tenant.id,
            name="Temporary Category",
            kind=CategoryKind.EXPENSE,
        )
        async_session.add(category)
        await async_session.commit()
        await async_session.refresh(category)

        budget = Budget(
            tenant_id=test_tenant.id,
            name="Resilient Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=category.id,
        )
        async_session.add(budget_category)
        await async_session.commit()

        # Delete the category
        await async_session.delete(category)
        await async_session.commit()

        # Fetch the budget via API - should succeed with empty categories
        response = await async_client.get(
            f"/budgets/{budget.id}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        response_body = response.json()
        assert response_body["name"] == "Resilient Budget"
        # Category was deleted, so budget_category row should be gone
        assert response_body["categories"] == []


# ---------------------
# Currency Filtering Tests
# ---------------------


class TestCurrencyFiltering:
    """
    Tests for currency-filtered spent calculation.

    Covers:
    - Only transactions matching budget.currency are counted
    - Mixed-currency transactions are correctly filtered
    - BRL budget ignores USD transactions in same categories
    - USD budget only counts USD transactions
    """

    @pytest.mark.asyncio
    async def test_brl_budget_ignores_usd_transactions(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        test_user: User,
        test_account_brl: Account,
        test_account_usd: Account,
        expense_category_food: Category,
    ):
        """
        Test that a BRL budget only counts BRL expense transactions.

        Creates both BRL and USD transactions in the same category.
        Only the BRL transactions should count toward the BRL budget's spent.
        """
        current_month = datetime.now(timezone.utc).month
        current_year = datetime.now(timezone.utc).year

        # Create BRL budget
        budget = Budget(
            tenant_id=test_tenant.id,
            name="BRL Food Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)

        # BRL transaction: should be counted
        brl_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("200.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 5),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        # USD transaction in same category: should NOT be counted
        usd_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_usd.id,
            category_id=expense_category_food.id,
            amount=Decimal("500.00"),
            currency=Currency.USD,
            transaction_date=date(current_year, current_month, 10),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        async_session.add_all([brl_transaction, usd_transaction])
        await async_session.commit()

        response = await async_client.get(
            f"/budgets/{budget.id}?month={current_month}&year={current_year}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        # Only the 200 BRL transaction should count
        assert Decimal(response.json()["spent"]) == Decimal("200.00")

    @pytest.mark.asyncio
    async def test_usd_budget_only_counts_usd_transactions(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        test_user: User,
        test_account_brl: Account,
        test_account_usd: Account,
        expense_category_food: Category,
    ):
        """
        Test that a USD budget only counts USD expense transactions.

        Creates BRL and USD transactions. Only USD transactions should
        be summed in the USD budget's spent calculation.
        """
        current_month = datetime.now(timezone.utc).month
        current_year = datetime.now(timezone.utc).year

        # Create USD budget
        budget = Budget(
            tenant_id=test_tenant.id,
            name="USD Food Budget",
            amount=Decimal("500.00"),
            currency=Currency.USD,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        budget_category = BudgetCategory(
            tenant_id=test_tenant.id,
            budget_id=budget.id,
            category_id=expense_category_food.id,
        )
        async_session.add(budget_category)

        # BRL transaction: should NOT be counted for USD budget
        brl_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 5),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        # USD transaction: should be counted
        usd_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_usd.id,
            category_id=expense_category_food.id,
            amount=Decimal("75.00"),
            currency=Currency.USD,
            transaction_date=date(current_year, current_month, 10),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        async_session.add_all([brl_transaction, usd_transaction])
        await async_session.commit()

        response = await async_client.get(
            f"/budgets/{budget.id}?month={current_month}&year={current_year}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        # Only the 75 USD transaction should count
        assert Decimal(response.json()["spent"]) == Decimal("75.00")

    @pytest.mark.asyncio
    async def test_universal_budget_currency_filtering(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        test_user: User,
        test_account_brl: Account,
        test_account_usd: Account,
        expense_category_food: Category,
        expense_category_transport: Category,
    ):
        """
        Test that a universal budget (no categories) still filters by currency.

        Creates a BRL universal budget and transactions in both BRL and USD.
        Only BRL transactions should count toward spent, regardless of category.
        """
        current_month = datetime.now(timezone.utc).month
        current_year = datetime.now(timezone.utc).year

        # BRL universal budget (no categories)
        budget = Budget(
            tenant_id=test_tenant.id,
            name="Universal BRL Budget",
            amount=Decimal("5000.00"),
            currency=Currency.BRL,
        )
        async_session.add(budget)
        await async_session.commit()
        await async_session.refresh(budget)

        # BRL expenses across different categories
        brl_food_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("300.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 5),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )
        brl_transport_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_transport.id,
            amount=Decimal("150.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 10),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        # USD expense (should NOT be counted for BRL budget)
        usd_food_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_usd.id,
            category_id=expense_category_food.id,
            amount=Decimal("999.00"),
            currency=Currency.USD,
            transaction_date=date(current_year, current_month, 15),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        async_session.add_all([
            brl_food_transaction,
            brl_transport_transaction,
            usd_food_transaction,
        ])
        await async_session.commit()

        response = await async_client.get(
            f"/budgets/{budget.id}?month={current_month}&year={current_year}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        # 300 + 150 = 450 BRL only, the 999 USD is excluded
        assert Decimal(response.json()["spent"]) == Decimal("450.00")

    @pytest.mark.asyncio
    async def test_mixed_currency_transactions_in_list_endpoint(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        owner_token: str,
        test_tenant: Tenant,
        test_user: User,
        test_account_brl: Account,
        test_account_usd: Account,
        expense_category_food: Category,
    ):
        """
        Test that the list endpoint correctly filters currency per budget.

        Creates a BRL budget and a USD budget in the same tenant, each
        linked to the same category. Verifies each budget's spent only
        includes transactions matching its own currency.
        """
        current_month = datetime.now(timezone.utc).month
        current_year = datetime.now(timezone.utc).year

        # BRL budget
        brl_budget = Budget(
            tenant_id=test_tenant.id,
            name="BRL Budget",
            amount=Decimal("1000.00"),
            currency=Currency.BRL,
        )
        # USD budget
        usd_budget = Budget(
            tenant_id=test_tenant.id,
            name="USD Budget",
            amount=Decimal("500.00"),
            currency=Currency.USD,
        )
        async_session.add_all([brl_budget, usd_budget])
        await async_session.commit()
        await async_session.refresh(brl_budget)
        await async_session.refresh(usd_budget)

        # Link both to Food category
        for budget in [brl_budget, usd_budget]:
            budget_category = BudgetCategory(
                tenant_id=test_tenant.id,
                budget_id=budget.id,
                category_id=expense_category_food.id,
            )
            async_session.add(budget_category)

        # BRL transaction
        brl_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_brl.id,
            category_id=expense_category_food.id,
            amount=Decimal("250.00"),
            currency=Currency.BRL,
            transaction_date=date(current_year, current_month, 5),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        # USD transaction
        usd_transaction = Transaction(
            tenant_id=test_tenant.id,
            account_id=test_account_usd.id,
            category_id=expense_category_food.id,
            amount=Decimal("100.00"),
            currency=Currency.USD,
            transaction_date=date(current_year, current_month, 10),
            transaction_type=CategoryKind.EXPENSE,
            created_by=test_user.id,
        )

        async_session.add_all([brl_transaction, usd_transaction])
        await async_session.commit()

        response = await async_client.get(
            f"/budgets?month={current_month}&year={current_year}",
            headers=authorization_header(owner_token),
        )

        assert response.status_code == status.HTTP_200_OK
        budgets_list = response.json()
        assert len(budgets_list) == 2

        # Find each budget by name and verify spent
        brl_budget_response = next(
            budget for budget in budgets_list if budget["name"] == "BRL Budget"
        )
        usd_budget_response = next(
            budget for budget in budgets_list if budget["name"] == "USD Budget"
        )

        assert Decimal(brl_budget_response["spent"]) == Decimal("250.00")
        assert Decimal(usd_budget_response["spent"]) == Decimal("100.00")
