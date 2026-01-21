import pytest
from tests.helpers import signup_and_auth, auth_header

# Fixture: transaction_factory
# Purpose:
# - Sign up (or obtain) a user and capture an access token.
# - Discover the user's personal tenant id.
# - Create supporting resources required for transactions:
#   - a category (Dining)
#   - an account (Wallet)
# - Create a base transaction that will be used by read/list/update/delete tests.
# - Return a context dict with all created objects and useful metadata so tests
#   remain focused, deterministic, and concise.
@pytest.fixture
def transaction_factory(client):
    # Credentials dedicated to transaction tests (keeps test data isolated)
    email = "tx_owner@test.com"
    password = "TxPw1!"
    creds = signup_and_auth(client, email, password, "TxOwner")
    personal_access_token = creds["access_token"]
    headers = auth_header(personal_access_token)

    # Discover the personal tenant id for the signed up user.
    tenants_list_response = client.get("/tenants", headers=headers)
    assert tenants_list_response.status_code == 200, tenants_list_response.text
    tenants_for_user = tenants_list_response.json()
    assert len(tenants_for_user) >= 1
    personal_tenant_id = tenants_for_user[0]["id"]

    # Create a category required by transactions.
    category_create_response = client.post(
        "/categories", json={"name": "Dining", "kind": "expense"}, headers=headers
    )
    assert category_create_response.status_code == 200, category_create_response.text
    category = category_create_response.json()

    # Create an account required by transactions.
    account_create_response = client.post(
        "/accounts",
        json={"name": "Wallet", "type": "cash", "currency": "USD", "balance": "50.00"},
        headers=headers,
    )
    assert account_create_response.status_code == 200, account_create_response.text
    account = account_create_response.json()

    # Create a base transaction that other tests will reference.
    base_transaction_payload = {
        # "tenant_id": personal_tenant_id,
        "account_id": account["id"],
        "category_id": category["id"],
        "amount": "12.34",
        "currency": "USD",
        "transaction_date": "2025-01-02",
        "transaction_type": "expense",
        "description": "Lunch",
    }
    create_transaction_response = client.post("/transactions", json=base_transaction_payload, headers=headers)
    assert create_transaction_response.status_code == 200, create_transaction_response.text
    created_transaction = create_transaction_response.json()

    return {
        "email": email,
        "password": password,
        "personal_access_token": personal_access_token,
        "headers": headers,
        "personal_tenant_id": personal_tenant_id,
        "category": category,
        "account": account,
        "created_transaction": created_transaction,
        "created_transaction_id": created_transaction["id"],
        "create_payload": base_transaction_payload,
    }


# 1) CREATE: create a second transaction to isolate create behavior.
def test_transaction_create_second_transaction(transaction_factory, client):
    headers = transaction_factory["headers"]
    account_id = transaction_factory["account"]["id"]
    category_id = transaction_factory["category"]["id"]
    tenant_id = transaction_factory["personal_tenant_id"]

    payload = {
        "tenant_id": tenant_id,
        "account_id": account_id,
        "category_id": category_id,
        "amount": "99.99",
        "currency": "USD",
        "transaction_date": "2025-02-03",
        "transaction_type": "expense",
        "description": "Dinner",
    }

    create_response = client.post("/transactions", json=payload, headers=headers)
    assert create_response.status_code == 200, create_response.text
    created = create_response.json()

    # Validate returned payload fields to ensure creation succeeded and data is consistent.
    assert created["amount"] == payload["amount"]
    assert created["account_id"] == account_id
    assert created["category_id"] == category_id
    assert created["description"] == payload["description"]


# 2) READ: fetch the transaction created by the fixture and validate it.
def test_transaction_read_existing_transaction(transaction_factory, client):
    headers = transaction_factory["headers"]
    tx_id = transaction_factory["created_transaction_id"]
    expected_amount = transaction_factory["create_payload"]["amount"]

    get_response = client.get(f"/transactions/{tx_id}", headers=headers)
    assert get_response.status_code == 200, get_response.text
    tx = get_response.json()
    assert tx["id"] == tx_id
    # Also check a couple of key fields to ensure it matches the base payload
    assert tx["amount"] == expected_amount
    assert tx["description"] == transaction_factory["create_payload"]["description"]


# 3) LIST: ensure the user's transactions list includes the created transaction.
def test_list_transactions_includes_created_transaction(transaction_factory, client):
    headers = transaction_factory["headers"]
    tx_id = transaction_factory["created_transaction_id"]

    transactions_list_response = client.get("/transactions", headers=headers)
    assert transactions_list_response.status_code == 200, transactions_list_response.text
    transactions = transactions_list_response.json()
    assert any(t["id"] == tx_id for t in transactions)
    

# 3.b) LIST: list by category.
def test_list_transactions_by_category(transaction_factory, client):
    headers = transaction_factory["headers"]
    tx_id = transaction_factory["created_transaction_id"]
    original_category = transaction_factory["category"]

    transactions_list_response = client.get("/transactions", headers=headers)
    assert transactions_list_response.status_code == 200, transactions_list_response.text
    transactions = transactions_list_response.json()
    total_transactions = len(transactions) #other tests may create more categories

    # Create a new category
    category_create_response = client.post(
        "/categories", json={"name": "Breakfast", "kind": "expense"}, headers=headers
    )
    assert category_create_response.status_code == 200, category_create_response.text
    new_category = category_create_response.json()

    payload = transaction_factory["create_payload"]
    payload['category_id'] = new_category['id']
    create_transaction_response = client.post("/transactions", json=payload, headers=headers)
    assert create_transaction_response.status_code == 200, create_transaction_response.text
    created_transaction = create_transaction_response.json()

    transactions_list_response = client.get("/transactions", headers=headers)
    assert transactions_list_response.status_code == 200, transactions_list_response.text
    transactions = transactions_list_response.json()
    assert len(transactions) == total_transactions + 1
    
    transactions_list_response = client.get(f"/transactions?category_id={original_category['id']}", headers=headers)
    assert transactions_list_response.status_code == 200, transactions_list_response.text
    transactions = transactions_list_response.json()
    assert len(transactions) == 1

    transactions_list_response = client.get(f"/transactions?category_id={new_category['id']}", headers=headers)
    assert transactions_list_response.status_code == 200, transactions_list_response.text
    transactions = transactions_list_response.json()
    assert len(transactions) == 1


# 4) UPDATE: modify the fixture transaction and validate the change is persisted.
def test_update_transaction_description(transaction_factory, client):
    headers = transaction_factory["headers"]
    tx_id = transaction_factory["created_transaction_id"]

    update_payload = {"description": "Business lunch"}
    update_response = client.patch(f"/transactions/{tx_id}", json=update_payload, headers=headers)
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()
    assert updated["description"] == update_payload["description"]

    # Read back to confirm persistence of the update.
    get_response = client.get(f"/transactions/{tx_id}", headers=headers)
    assert get_response.status_code == 200, get_response.text
    tx = get_response.json()
    assert tx["description"] == update_payload["description"]


# 5) DELETE: remove the created transaction and assert it no longer appears in lists.
def test_delete_transaction(transaction_factory, client):
    headers = transaction_factory["headers"]
    tx_id = transaction_factory["created_transaction_id"]

    delete_response = client.delete(f"/transactions/{tx_id}", headers=headers)
    assert delete_response.status_code in (200, 204), delete_response.text

    # After deletion, list transactions and assert the deleted id is not present.
    transactions_list_response = client.get("/transactions", headers=headers)
    assert transactions_list_response.status_code == 200, transactions_list_response.text
    transactions = transactions_list_response.json()
    assert not any(t["id"] == tx_id for t in transactions)


# 6) SEARCH: test transaction search functionality with various query patterns.
def test_search_transactions(transaction_factory, client):
    """Test transaction search with exact matches, partial matches, case-insensitivity, and empty results.

    This test validates the search query parameter works correctly:
    - Exact matches return the correct transaction
    - Partial matches work (e.g., "Groc" finds "Groceries")
    - Search is case-insensitive (e.g., "groceries" finds "Groceries")
    - Empty results when no matches are found
    - Search can be combined with other filters (e.g., date_from)
    """
    headers = transaction_factory["headers"]
    account_id = transaction_factory["account"]["id"]
    category_id = transaction_factory["category"]["id"]

    # Create multiple transactions with different descriptions for search testing
    # These descriptions are intentionally varied to test different search scenarios
    test_transactions = [
        {
            "account_id": account_id,
            "category_id": category_id,
            "amount": "45.50",
            "currency": "USD",
            "transaction_date": "2025-01-15",
            "transaction_type": "expense",
            "description": "Groceries at Whole Foods",
        },
        {
            "account_id": account_id,
            "category_id": category_id,
            "amount": "20.00",
            "currency": "USD",
            "transaction_date": "2025-01-16",
            "transaction_type": "expense",
            "description": "Coffee at Starbucks",
        },
        {
            "account_id": account_id,
            "category_id": category_id,
            "amount": "120.00",
            "currency": "USD",
            "transaction_date": "2025-01-17",
            "transaction_type": "expense",
            "description": "Dinner at Italian Restaurant",
        },
        {
            "account_id": account_id,
            "category_id": category_id,
            "amount": "15.75",
            "currency": "USD",
            "transaction_date": "2025-01-18",
            "transaction_type": "expense",
            "description": "Grocery shopping at Trader Joe's",
        },
    ]

    # Create all test transactions and store their IDs for validation
    created_transaction_ids = []
    for transaction_payload in test_transactions:
        create_response = client.post("/transactions", json=transaction_payload, headers=headers)
        assert create_response.status_code == 200, create_response.text
        created = create_response.json()
        created_transaction_ids.append(created["id"])

    # Test Case 1: Exact match search
    # Should find exactly one transaction with "Coffee at Starbucks"
    exact_match_response = client.get("/transactions?search=Coffee at Starbucks", headers=headers)
    assert exact_match_response.status_code == 200, exact_match_response.text
    exact_match_results = exact_match_response.json()
    assert len(exact_match_results) == 1, f"Expected 1 result for exact match, got {len(exact_match_results)}"
    assert exact_match_results[0]["description"] == "Coffee at Starbucks"
    assert exact_match_results[0]["tenant_id"] == transaction_factory["personal_tenant_id"]

    # Test Case 2: Partial match search
    # "Groc" should match both "Groceries at Whole Foods" and "Grocery shopping at Trader Joe's"
    partial_match_response = client.get("/transactions?search=Groc", headers=headers)
    assert partial_match_response.status_code == 200, partial_match_response.text
    partial_match_results = partial_match_response.json()
    assert len(partial_match_results) == 2, f"Expected 2 results for partial match 'Groc', got {len(partial_match_results)}"
    partial_descriptions = [tx["description"] for tx in partial_match_results]
    assert "Groceries at Whole Foods" in partial_descriptions
    assert "Grocery shopping at Trader Joe's" in partial_descriptions
    # Verify all results belong to the correct tenant
    for transaction in partial_match_results:
        assert transaction["tenant_id"] == transaction_factory["personal_tenant_id"]

    # Test Case 3: Case-insensitive search
    # "groceries" (lowercase) should match "Groceries at Whole Foods" (capitalized)
    case_insensitive_response = client.get("/transactions?search=groceries", headers=headers)
    assert case_insensitive_response.status_code == 200, case_insensitive_response.text
    case_insensitive_results = case_insensitive_response.json()
    assert len(case_insensitive_results) >= 1, "Case-insensitive search should find at least one match"
    # Verify at least one result contains "Groceries" (case-insensitive match)
    assert any("groceries" in tx["description"].lower() for tx in case_insensitive_results)

    # Test Case 4: No matches - search term that doesn't exist
    # "Pharmacy" should return empty list as no transactions have this term
    no_match_response = client.get("/transactions?search=Pharmacy", headers=headers)
    assert no_match_response.status_code == 200, no_match_response.text
    no_match_results = no_match_response.json()
    assert len(no_match_results) == 0, f"Expected 0 results for non-existent search term, got {len(no_match_results)}"

    # Test Case 5: Combine search with date filter
    # Search for "Grocery" with date_from filter should only return transactions on or after 2025-01-17
    # This should match "Grocery shopping at Trader Joe's" (2025-01-18) but not "Groceries at Whole Foods" (2025-01-15)
    combined_filter_response = client.get("/transactions?search=Grocery&start=2025-01-17", headers=headers)
    assert combined_filter_response.status_code == 200, combined_filter_response.text
    combined_filter_results = combined_filter_response.json()
    assert len(combined_filter_results) == 1, f"Expected 1 result for combined search+date filter, got {len(combined_filter_results)}"
    assert combined_filter_results[0]["description"] == "Grocery shopping at Trader Joe's"
    assert combined_filter_results[0]["transaction_date"] == "2025-01-18"
    assert combined_filter_results[0]["tenant_id"] == transaction_factory["personal_tenant_id"]

