"""
Tests for account-related API endpoints.

This module tests:
- GET /accounts with optional tenant_id parameter
- POST /accounts with optional share_with field
- Account sharing functionality
- Multi-tenant isolation
"""
import pytest
from decimal import Decimal
from uuid import uuid4

from app.models import Account, AccountShare, Membership, MembershipStatus, ShareVisibility
from app.schemas import AccountShareWith


class TestListAccountsWithTenantId:
    """Test GET /accounts endpoint with optional tenant_id query parameter."""

    async def test_list_accounts_without_tenant_id_returns_all_user_accounts(
        self, async_client, async_session, test_user, test_tenant, test_membership, auth_headers, test_account
    ):
        """Test that GET /accounts without tenant_id returns user's own accounts and shared accounts."""
        response = await async_client.get("/accounts", headers=auth_headers)

        assert response.status_code == 200
        accounts = response.json()
        assert len(accounts) >= 1
        assert any(account["id"] == str(test_account.id) for account in accounts)
        # icon and color must always be present in every account response, defaulting to None
        for account in accounts:
            assert "icon" in account
            assert "color" in account

    async def test_list_accounts_with_valid_tenant_id_returns_shared_accounts(
        self, async_client, async_session, test_user, test_user2, test_tenant, test_tenant2,
        test_membership, test_membership2, auth_headers, test_account2
    ):
        """Test that GET /accounts?tenant_id=X returns only accounts shared with that tenant."""
        # Create a share from test_account2 (owned by test_user2) to test_tenant2
        account_share = AccountShare(
            id=uuid4(),
            account_id=test_account2.id,
            tenant_id=test_tenant2.id,
            visibility=ShareVisibility.VISIBLE,
            granted_by=test_user2.id
        )
        async_session.add(account_share)
        await async_session.commit()

        # Query accounts shared with test_tenant2
        response = await async_client.get(
            f"/accounts?tenant_id={test_tenant2.id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        accounts = response.json()
        # Should only return accounts shared with test_tenant2
        assert len(accounts) == 1
        assert accounts[0]["id"] == str(test_account2.id)

    async def test_list_accounts_with_tenant_id_masks_balance_per_row(
        self, async_client, async_session, test_user, test_user2, test_tenant, test_tenant2,
        test_membership, test_membership2, auth_headers, test_account2
    ):
        """Family-scoped list masks each row's balance correctly in the batched query.

        Three accounts shared into one tenant exercise all branches of the single
        joined query: a VISIBLE share shows the balance, a HIDDEN share masks it to
        null, and the requestor's OWN account shows its balance regardless of the
        share visibility (owner override).
        """
        from app.models import AccountType, Currency

        # Another user's account, shared HIDDEN -> balance must be masked.
        hidden_other_account = Account(
            id=uuid4(), user_id=test_user2.id, name="Hidden Other",
            type=AccountType.CASH, currency=Currency.BRL, balance=Decimal("250.00"),
        )
        # The requestor's own account, shared HIDDEN -> owner still sees the balance.
        own_shared_account = Account(
            id=uuid4(), user_id=test_user.id, name="My Shared",
            type=AccountType.CASH, currency=Currency.BRL, balance=Decimal("777.00"),
        )
        async_session.add_all([hidden_other_account, own_shared_account])
        await async_session.commit()

        # test_account2 (owned by test_user2, balance 500.00) shared VISIBLE.
        async_session.add_all([
            AccountShare(
                id=uuid4(), account_id=test_account2.id, tenant_id=test_tenant2.id,
                visibility=ShareVisibility.VISIBLE, granted_by=test_user2.id,
            ),
            AccountShare(
                id=uuid4(), account_id=hidden_other_account.id, tenant_id=test_tenant2.id,
                visibility=ShareVisibility.HIDDEN, granted_by=test_user2.id,
            ),
            AccountShare(
                id=uuid4(), account_id=own_shared_account.id, tenant_id=test_tenant2.id,
                visibility=ShareVisibility.HIDDEN, granted_by=test_user.id,
            ),
        ])
        await async_session.commit()

        response = await async_client.get(
            f"/accounts?tenant_id={test_tenant2.id}", headers=auth_headers
        )

        assert response.status_code == 200, response.text
        accounts_by_id = {account["id"]: account for account in response.json()}
        # VISIBLE share from another owner -> balance present.
        assert accounts_by_id[str(test_account2.id)]["balance"] == "500.00"
        # HIDDEN share from another owner -> balance masked to null.
        assert accounts_by_id[str(hidden_other_account.id)]["balance"] is None
        # Requestor's own account -> balance shown despite the HIDDEN share.
        assert accounts_by_id[str(own_shared_account.id)]["balance"] == "777.00"

    async def test_list_accounts_with_tenant_id_user_not_member_returns_403(
        self, async_client, async_session, test_user, test_tenant, test_membership, auth_headers
    ):
        """Test that GET /accounts?tenant_id=X returns 403 when user is not a member of that tenant."""
        # Create a tenant that test_user is not a member of
        other_tenant_id = uuid4()

        response = await async_client.get(
            f"/accounts?tenant_id={other_tenant_id}",
            headers=auth_headers
        )

        assert response.status_code == 403
        assert "not an active member" in response.json()["detail"].lower()

    async def test_list_accounts_with_tenant_id_empty_when_no_shares(
        self, async_client, async_session, test_user, test_tenant2, test_membership2, auth_headers_tenant2
    ):
        """Test that GET /accounts?tenant_id=X returns empty list when no accounts are shared."""
        response = await async_client.get(
            f"/accounts?tenant_id={test_tenant2.id}",
            headers=auth_headers_tenant2
        )

        assert response.status_code == 200
        accounts = response.json()
        assert len(accounts) == 0


class TestCreateAccountWithShareWith:
    """Test POST /accounts endpoint with optional share_with field."""

    async def test_create_account_without_share_with_succeeds(
        self, async_client, async_session, test_user, test_tenant, test_membership, auth_headers
    ):
        """Test that POST /accounts without share_with creates account normally."""
        account_data = {
            "name": "New Savings Account",
            "type": "debit",
            "currency": "BRL",
            "balance": "2000.00"
        }

        response = await async_client.post("/accounts", json=account_data, headers=auth_headers)

        assert response.status_code == 200
        account = response.json()
        assert account["name"] == "New Savings Account"
        assert account["user_id"] == str(test_user.id)
        assert account["balance"] == "2000.00"

    async def test_create_account_with_share_with_creates_account_and_share_atomically(
        self, async_client, async_session, test_user, test_tenant, test_tenant2,
        test_membership, test_membership2, auth_headers
    ):
        """Test that POST /accounts with share_with creates both account and share atomically."""
        account_data = {
            "name": "Shared Account",
            "type": "cash",
            "currency": "BRL",
            "balance": "500.00",
            "share_with": {
                "tenant_id": str(test_tenant2.id),
                "visibility": "visible"
            }
        }

        response = await async_client.post("/accounts", json=account_data, headers=auth_headers)

        assert response.status_code == 200
        account = response.json()
        assert account["name"] == "Shared Account"
        assert account["user_id"] == str(test_user.id)

        # Verify account was created in database
        from sqlmodel import select
        from uuid import UUID
        account_id = UUID(account["id"])
        account_query = select(Account).where(Account.id == account_id)
        account_result = await async_session.execute(account_query)
        created_account = account_result.scalars().first()
        assert created_account is not None

        # Verify AccountShare was created
        share_query = select(AccountShare).where(
            AccountShare.account_id == account_id,
            AccountShare.tenant_id == test_tenant2.id
        )
        share_result = await async_session.execute(share_query)
        account_share = share_result.scalars().first()
        assert account_share is not None
        assert account_share.visibility == ShareVisibility.VISIBLE
        assert account_share.granted_by == test_user.id

    async def test_create_account_with_share_with_invalid_tenant_returns_404(
        self, async_client, async_session, test_user, test_tenant, test_membership, auth_headers
    ):
        """Test that POST /accounts with non-existent tenant_id in share_with returns 404."""
        non_existent_tenant_id = uuid4()
        account_data = {
            "name": "Shared Account",
            "type": "cash",
            "currency": "BRL",
            "balance": "500.00",
            "share_with": {
                "tenant_id": str(non_existent_tenant_id),
                "visibility": "visible"
            }
        }

        response = await async_client.post("/accounts", json=account_data, headers=auth_headers)

        assert response.status_code == 404
        assert "tenant not found" in response.json()["detail"].lower()

    async def test_create_account_with_share_with_user_not_member_returns_403(
        self, async_client, async_session, test_user, test_tenant, test_membership, test_tenant2, auth_headers
    ):
        """Test that POST /accounts with tenant user is not a member of returns 403."""
        # test_user is not a member of test_tenant2 (no test_membership2 fixture used)
        account_data = {
            "name": "Shared Account",
            "type": "cash",
            "currency": "BRL",
            "balance": "500.00",
            "share_with": {
                "tenant_id": str(test_tenant2.id),
                "visibility": "visible"
            }
        }

        response = await async_client.post("/accounts", json=account_data, headers=auth_headers)

        assert response.status_code == 403
        assert "not an active member" in response.json()["detail"].lower()

    async def test_create_account_with_share_with_default_visibility_hidden(
        self, async_client, async_session, test_user, test_tenant, test_tenant2,
        test_membership, test_membership2, auth_headers
    ):
        """Test that share_with without visibility defaults to HIDDEN."""
        account_data = {
            "name": "Shared Account Hidden",
            "type": "debit",
            "currency": "BRL",
            "balance": "1000.00",
            "share_with": {
                "tenant_id": str(test_tenant2.id)
                # No visibility specified - should default to HIDDEN
            }
        }

        response = await async_client.post("/accounts", json=account_data, headers=auth_headers)

        assert response.status_code == 200
        account = response.json()

        # Verify share was created with HIDDEN visibility
        from sqlmodel import select
        from uuid import UUID
        account_id = UUID(account["id"])
        share_query = select(AccountShare).where(
            AccountShare.account_id == account_id,
            AccountShare.tenant_id == test_tenant2.id
        )
        share_result = await async_session.execute(share_query)
        account_share = share_result.scalars().first()
        assert account_share is not None
        assert account_share.visibility == ShareVisibility.HIDDEN


class TestTransactionBalanceUpdates:
    """Test that creating transactions updates account balances correctly."""

    async def test_create_income_transaction_increases_balance(
        self, async_client, async_session, test_user, test_tenant, test_membership,
        auth_headers, test_account, test_category
    ):
        """Test that creating an INCOME transaction increases account balance."""
        from datetime import date

        initial_balance = test_account.balance

        transaction_data = {
            "account_id": str(test_account.id),
            "category_id": str(test_category.id),
            "amount": "200.50",
            "currency": "BRL",
            "transaction_date": str(date.today()),
            "transaction_type": "income",
            "description": "Salary payment"
        }

        response = await async_client.post("/transactions", json=transaction_data, headers=auth_headers)

        assert response.status_code == 200
        transaction = response.json()
        assert transaction["amount"] == "200.50"
        assert transaction["transaction_type"] == "income"

        # Refresh account and verify balance increased
        await async_session.refresh(test_account)
        expected_balance = initial_balance + Decimal("200.50")
        assert test_account.balance == expected_balance

    async def test_create_expense_transaction_decreases_balance(
        self, async_client, async_session, test_user, test_tenant, test_membership,
        auth_headers, test_account, test_category
    ):
        """Test that creating an EXPENSE transaction decreases account balance."""
        from datetime import date

        initial_balance = test_account.balance

        transaction_data = {
            "account_id": str(test_account.id),
            "category_id": str(test_category.id),
            "amount": "75.25",
            "currency": "BRL",
            "transaction_date": str(date.today()),
            "transaction_type": "expense",
            "description": "Grocery shopping"
        }

        response = await async_client.post("/transactions", json=transaction_data, headers=auth_headers)

        assert response.status_code == 200
        transaction = response.json()
        assert transaction["amount"] == "75.25"
        assert transaction["transaction_type"] == "expense"

        # Refresh account and verify balance decreased
        await async_session.refresh(test_account)
        expected_balance = initial_balance - Decimal("75.25")
        assert test_account.balance == expected_balance

    async def test_multiple_transactions_update_balance_correctly(
        self, async_client, async_session, test_user, test_tenant, test_membership,
        auth_headers, test_account, test_category
    ):
        """Test that multiple transactions update balance correctly in sequence."""
        from datetime import date

        initial_balance = test_account.balance

        # Create income transaction
        income_data = {
            "account_id": str(test_account.id),
            "category_id": str(test_category.id),
            "amount": "500.00",
            "currency": "BRL",
            "transaction_date": str(date.today()),
            "transaction_type": "income",
            "description": "Income 1"
        }
        response1 = await async_client.post("/transactions", json=income_data, headers=auth_headers)
        assert response1.status_code == 200

        # Create expense transaction
        expense_data = {
            "account_id": str(test_account.id),
            "category_id": str(test_category.id),
            "amount": "150.00",
            "currency": "BRL",
            "transaction_date": str(date.today()),
            "transaction_type": "expense",
            "description": "Expense 1"
        }
        response2 = await async_client.post("/transactions", json=expense_data, headers=auth_headers)
        assert response2.status_code == 200

        # Create another income transaction
        income_data2 = {
            "account_id": str(test_account.id),
            "category_id": str(test_category.id),
            "amount": "100.00",
            "currency": "BRL",
            "transaction_date": str(date.today()),
            "transaction_type": "income",
            "description": "Income 2"
        }
        response3 = await async_client.post("/transactions", json=income_data2, headers=auth_headers)
        assert response3.status_code == 200

        # Verify final balance: initial + 500 - 150 + 100
        await async_session.refresh(test_account)
        expected_balance = initial_balance + Decimal("500.00") - Decimal("150.00") + Decimal("100.00")
        assert test_account.balance == expected_balance

    async def test_transaction_allows_negative_balance_for_credit_accounts(
        self, async_client, async_session, test_user, test_tenant, test_membership, auth_headers
    ):
        """Test that transactions can result in negative balance for credit accounts (debt)."""
        from datetime import date, datetime
        from app.models import AccountType

        # Create a credit account with zero balance
        credit_account = Account(
            id=uuid4(),
            user_id=test_user.id,
            name="Credit Card",
            type=AccountType.CREDIT,
            currency="BRL",
            balance=Decimal("0.00"),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        async_session.add(credit_account)
        await async_session.commit()
        await async_session.refresh(credit_account)

        # Create expense transaction that makes balance negative
        from app.models import Category, CategoryKind
        expense_category = Category(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Shopping",
            kind=CategoryKind.EXPENSE,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        async_session.add(expense_category)
        await async_session.commit()

        transaction_data = {
            "account_id": str(credit_account.id),
            "category_id": str(expense_category.id),
            "amount": "300.00",
            "currency": "BRL",
            "transaction_date": str(date.today()),
            "transaction_type": "expense",
            "description": "Credit card purchase"
        }

        response = await async_client.post("/transactions", json=transaction_data, headers=auth_headers)

        assert response.status_code == 200

        # Verify balance is negative (representing debt)
        await async_session.refresh(credit_account)
        assert credit_account.balance == Decimal("-300.00")


class TestAccountIconAndColor:
    """Tests for icon and color fields on accounts (POST, PATCH, and clearing to null)."""

    @pytest.mark.asyncio
    async def test_create_account_with_icon_and_color(
        self, async_client, test_tenant, test_membership, auth_headers
    ):
        """Creating an account with icon/color stores and returns both fields."""
        account_data = {
            "name": "Savings",
            "type": "cash",
            "currency": "BRL",
            "balance": "500.00",
            "icon": "ShoppingCart",
            "color": "#F44336",
        }
        response = await async_client.post("/accounts", json=account_data, headers=auth_headers)

        assert response.status_code == 200, response.text
        created_account = response.json()
        assert created_account["icon"] == "ShoppingCart"
        assert created_account["color"] == "#F44336"

    @pytest.mark.asyncio
    async def test_update_account_icon_and_color(
        self, async_client, test_tenant, test_membership, auth_headers, test_account
    ):
        """PATCHing icon/color updates the stored values and returns them."""
        update_response = await async_client.patch(
            f"/accounts/{test_account.id}",
            json={"icon": "Coffee", "color": "#2196F3"},
            headers=auth_headers,
        )

        assert update_response.status_code == 200, update_response.text
        updated_account = update_response.json()
        assert updated_account["icon"] == "Coffee"
        assert updated_account["color"] == "#2196F3"

    @pytest.mark.asyncio
    async def test_clear_account_icon_and_color(
        self, async_client, test_tenant, test_membership, auth_headers
    ):
        """PATCHing with explicit null clears icon and color to None."""
        # Create an account with icon and color set
        account_data = {
            "name": "Wallet",
            "type": "cash",
            "currency": "BRL",
            "balance": "0.00",
            "icon": "Music",
            "color": "#9C27B0",
        }
        create_response = await async_client.post(
            "/accounts", json=account_data, headers=auth_headers
        )
        assert create_response.status_code == 200, create_response.text
        created_account = create_response.json()

        # Clear both fields with explicit null
        clear_response = await async_client.patch(
            f"/accounts/{created_account['id']}",
            json={"icon": None, "color": None},
            headers=auth_headers,
        )

        assert clear_response.status_code == 200, clear_response.text
        cleared_account = clear_response.json()
        assert cleared_account["icon"] is None
        assert cleared_account["color"] is None
