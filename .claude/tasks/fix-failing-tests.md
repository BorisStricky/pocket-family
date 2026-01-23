# Fix Failing Frontend Tests

**Total: 31 failing tests across 10 files**

---

## apiClient.test.ts (2 failed)

- [X] Token Refresh > should not retry if request is already a retry (prevent infinite loop)
- [X] Token Refresh > should handle network errors during refresh gracefully

---

## useUpdateTransaction.test.tsx (6 failed)

- [ ] Mutation loading state > should show loading state during mutation
- [ ] Error handling > should handle 401 unauthorized error
- [ ] Error handling > should handle network errors gracefully
- [ ] Cache invalidation > should invalidate transactions list after successful update
- [ ] Cache invalidation > should invalidate single transaction query after update
- [ ] Mutation callbacks > should call onError callback when mutation fails

---

## transactionsApi.test.ts (4 failed)

- [X] fetchTransactions > should include filter params when provided
- [X] updateTransaction > should call PUT /transactions/:id with update data
- [X] updateTransaction > should include Authorization header
- [X] updateTransaction > should handle 404 not found error

---

## TransactionForm.test.tsx (5 failed)

- [ ] Form validation > should show error when date is missing
- [ ] Form validation > should show error when amount is zero
- [ ] Form validation > should show error when amount is negative
- [ ] Form submission > should disable submit button while submitting
- [ ] Edit mode > should pre-populate form with existing transaction data

---

## useTransactions.test.tsx (1 failed)

- [ ] Filtering > should apply date filters to query

---

## useDeleteTransaction.test.tsx (4 failed)

- [ ] Mutation loading state > should show loading state during deletion
- [ ] Error handling > should handle 401 unauthorized error
- [ ] Error handling > should handle network errors gracefully
- [ ] Mutation callbacks > should call onError callback when deletion fails

---

## useCreateTransaction.test.tsx (2 failed)

- [ ] Error handling > should handle 401 unauthorized error
- [ ] Mutation callbacks > should call onError callback when creation fails

---

## AgTransactionsGrid.test.tsx (5 failed)

- [ ] Column rendering > should render date column with correct format
- [ ] Column rendering > should render amount with currency formatting
- [ ] Sorting > should sort by date descending by default
- [ ] Row selection > should enable row selection
- [ ] Loading state > should show loading overlay when data is loading

---

## useTransaction.test.tsx (1 failed)

- [ ] Error handling > should handle 404 not found error

---

## useLogin.test.tsx (1 failed)

- [ ] Error handling > should handle network errors gracefully
