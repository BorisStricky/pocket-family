// src/test/mocks/factories/account.ts
// Factory functions for creating mock Account objects in tests

import type { AccountRead, AccountType, Currency } from '@/types/account';

/**
 * Options for creating mock account objects
 */
interface CreateMockAccountOptions {
  id?: string;
  user_id?: string;
  user_name?: string;
  name?: string;
  type?: AccountType;
  currency?: Currency;
  balance?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Create a mock AccountRead object with customizable properties
 * Matches the AccountRead interface from src/types/account.ts
 *
 * @example
 * const account = createMockAccount({ name: 'Checking', balance: '1000.00' });
 * const creditCard = createMockAccount({ type: 'credit', balance: '-500.00' });
 */
export function createMockAccount(options: CreateMockAccountOptions = {}): AccountRead {
  const {
    id = 'account-uuid-123',
    user_id = 'user-uuid-789',
    user_name = 'Test User',
    name = 'Test Account',
    type = 'debit',
    currency = 'USD',
    balance = '1000.00',
    created_at = new Date().toISOString(),
    updated_at = new Date().toISOString(),
  } = options;

  return {
    id,
    user_id,
    user_name,
    name,
    type,
    currency,
    balance,
    created_at,
    updated_at,
  };
}

/**
 * Create a mock checking account (debit type)
 */
export function createMockCheckingAccount(options: CreateMockAccountOptions = {}): AccountRead {
  return createMockAccount({
    name: 'Checking Account',
    type: 'debit',
    balance: '2500.00',
    ...options,
  });
}

/**
 * Create a mock credit card account (credit type)
 */
export function createMockCreditCardAccount(options: CreateMockAccountOptions = {}): AccountRead {
  return createMockAccount({
    name: 'Credit Card',
    type: 'credit',
    balance: '-1200.00',
    ...options,
  });
}

/**
 * Create a mock cash account
 */
export function createMockCashAccount(options: CreateMockAccountOptions = {}): AccountRead {
  return createMockAccount({
    name: 'Cash Wallet',
    type: 'cash',
    balance: '150.00',
    ...options,
  });
}

/**
 * Create a list of mock accounts for testing list views
 *
 * @example
 * const accounts = createMockAccountList(3);
 * const manyAccounts = createMockAccountList(10, 'tenant-uuid-456');
 */
export function createMockAccountList(
  count: number = 3,
  tenantId?: string
): AccountRead[] {
  const accountTypes: AccountType[] = ['cash', 'debit', 'credit'];
  const currencies: Currency[] = ['USD', 'EUR', 'BRL'];

  return Array.from({ length: count }, (_, index) => {
    const accountType = accountTypes[index % accountTypes.length];
    const currency = currencies[index % currencies.length];

    // Credit cards have negative balances, others positive
    const balance = accountType === 'credit'
      ? `${-((index + 1) * 100)}.00`
      : `${(index + 1) * 500}.00`;

    return createMockAccount({
      id: `account-uuid-${index + 1}`,
      name: `Account ${index + 1}`,
      type: accountType,
      currency,
      balance,
    });
  });
}
