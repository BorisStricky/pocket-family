// src/test/mocks/handlers/index.ts
// Central export for all MSW handlers

import { authHandlers } from './auth';
import { familyHandlers } from './family';
import { transactionHandlers } from './transactions';

// Combined handlers array for MSW server setup
// All handlers are exported together for convenience
export const handlers = [
  ...authHandlers,
  ...familyHandlers,
  ...transactionHandlers,
];

// Also export individual handler groups for selective use
export { authHandlers } from './auth';
export { familyHandlers } from './family';
export { transactionHandlers, resetTransactionStore } from './transactions';
