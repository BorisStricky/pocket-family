# Sprint 4 feedback

Open items found on thorough manual testing

# Transactions

## Cannot update account on an existing Transaction

### Steps to reproduce

    1. Create a transaction, select account 1
    2. Open the transaction to edit, select account 2

### Network

The frontend sends the full payload to backend, and API returns 200 but the account is not updated

## Updating a transactions sends 3 API calls

Every transaction updates sends 4 API calls

- PATCH (expected)
- GET
- GET

The two GETs are unecessary, since it navigates back to Transactions page where all transactions are loaded. The indiviraul transaction is also loaded on click to edit

## Search by description sends an API call on every letter types

While typing in the search by description, an API call is made while typing, for every letter. When having many transactions this can be very slow. It should do only one API call when the field is out of focus. Same issue with date filter fields

## Add transaction form

- Category should be required. It is required by the backend
- Missing field for currencies, it is already in the TransactionCreate type
