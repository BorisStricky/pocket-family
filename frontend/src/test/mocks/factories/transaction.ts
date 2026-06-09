// src/test/mocks/factories/transaction.ts
// Factory functions for creating mock Transaction objects in tests

import type { Transaction } from '@/types';

/**
 * Options for creating mock transaction objects
 */
interface CreateMockTransactionOptions {
  id?: string;
  tenant_id?: string;
  account_id?: string;
  account_name?: string;
  account_icon?: string | null;
  account_color?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
  amount?: string;
  currency?: string;
  transaction_date?: string;
  transaction_type?: 'expense' | 'income';
  description?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  reconciled?: boolean;
  source?: 'manual' | 'recurring';
}

/**
 * Create a mock Transaction object with customizable properties
 * Matches the Transaction interface from src/types/transaction.ts
 *
 * @example
 * const transaction = createMockTransaction({ amount: '150.00', transaction_type: 'expense' });
 * const incomeTransaction = createMockTransaction({ transaction_type: 'income', amount: '5000.00' });
 */
export function createMockTransaction(options: CreateMockTransactionOptions = {}): Transaction {
  const {
    id = 'transaction-uuid-123',
    tenant_id = 'tenant-uuid-456',
    account_id = '20c3fafc-b75f-4197-bfa9-b5dac43c6000',
    account_name = 'Cash (BRL)',
    account_icon = null,
    account_color = null,
    category_id = '638d246d-ed81-4831-a511-8e76faa25e4a',
    category_name = 'Test (Expense)',
    category_icon = null,
    category_color = null,
    amount = '125.50',
    currency = 'USD',
    transaction_date = '2026-01-10',
    transaction_type = 'expense',
    description = 'Supermarket purchase',
    created_by = 'user-uuid-123',
    created_at = '2026-01-10T14:30:00Z',
    updated_at = '2026-01-10T14:30:00Z',
    reconciled = false,
    source = 'manual',
  } = options;

  return {
    id,
    tenant_id,
    account_id,
    account_name,
    account_icon,
    account_color,
    category_id,
    category_name,
    category_icon,
    category_color,
    amount,
    currency,
    transaction_date,
    transaction_type,
    description,
    created_by,
    created_at,
    updated_at,
    reconciled,
    source,
  };
}

/**
 * Create a mock expense transaction
 * Convenience wrapper for common test case
 */
export function createMockExpenseTransaction(
  amount: string = '100.00',
  options: Partial<CreateMockTransactionOptions> = {}
): Transaction {
  return createMockTransaction({
    transaction_type: 'expense',
    amount,
    category_name: 'Groceries',
    ...options,
  });
}

/**
 * Create a mock income transaction
 * Convenience wrapper for common test case
 */
export function createMockIncomeTransaction(
  amount: string = '5000.00',
  options: Partial<CreateMockTransactionOptions> = {}
): Transaction {
  return createMockTransaction({
    transaction_type: 'income',
    amount,
    category_name: 'Salary',
    ...options,
  });
}

/**
 * Create a list of mock transactions for testing list views
 * Generates a mix of expenses and income transactions
 *
 * @example
 * const transactions = createMockTransactionList(10);
 * const customTransactions = createMockTransactionList(5, { tenant_id: 'family-123' });
 */
export function createMockTransactionList(
  count: number = 5,
  baseOptions: Partial<CreateMockTransactionOptions> = {}
): Transaction[] {
  return Array.from({ length: count }, (_, index) => {
    // Alternate between expense and income for variety
    const isExpense = index % 3 !== 0; // Roughly 2/3 expenses, 1/3 income
    const type = isExpense ? 'expense' : 'income';
    const amount = isExpense
      ? (Math.random() * 200 + 10).toFixed(2) // $10-$210
      : (Math.random() * 3000 + 1000).toFixed(2); // $1000-$4000

    // Generate date in the past month
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const transaction_date = date.toISOString().split('T')[0]; // YYYY-MM-DD

    return createMockTransaction({
      id: `transaction-uuid-${index + 1}`,
      transaction_type: type,
      amount,
      transaction_date,
      category_name: isExpense ? 'Groceries' : 'Salary',
      description: isExpense ? `Expense ${index + 1}` : `Income ${index + 1}`,
      ...baseOptions,
    });
  });
}

/**
 * Create a mock transaction without a category
 * Useful for testing uncategorized transactions
 */
export function createMockUncategorizedTransaction(
  options: Partial<CreateMockTransactionOptions> = {}
): Transaction {
  return createMockTransaction({
    category_id: null,
    category_name: null,
    ...options,
  });
}

/**
 * Create a mock reconciled transaction
 * Useful for testing reconciliation features
 */
export function createMockReconciledTransaction(
  options: Partial<CreateMockTransactionOptions> = {}
): Transaction {
  return createMockTransaction({
    reconciled: true,
    ...options,
  });
}
