// src/test/mocks/handlers/index.ts
// Central export for all MSW handlers

import { authHandlers } from './auth';
import { familyHandlers } from './family';
import { transactionHandlers } from './transactions';
import { accountHandlers } from './accounts';
import { categoryHandlers } from './categories';
import { budgetHandlers } from './budgets';

// Combined handlers array for MSW server setup
// All handlers are exported together for convenience
export const handlers = [
  ...authHandlers,
  ...familyHandlers,
  ...transactionHandlers,
  ...accountHandlers,
  ...categoryHandlers,
  ...budgetHandlers,
];

// Also export individual handler groups for selective use
export { authHandlers } from './auth';
export { familyHandlers, resetFamilyStore } from './family';
export { transactionHandlers, resetTransactionStore } from './transactions';
export { accountHandlers, resetAccountStore } from './accounts';
export { categoryHandlers, resetCategoryStore } from './categories';
export { budgetHandlers, resetBudgetStore } from './budgets';
