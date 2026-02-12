// src/test/mocks/server.ts
// MSW server instance for Node.js test environment

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Factory function to create MSW server
// Using a factory allows for lazy initialization which helps in containerized environments
export function setupMswServer() {
  return setupServer(...handlers);
}

// Also export a pre-created server for direct imports
export const server = setupServer(...handlers);

// Re-export utility functions for test store management
export { resetTransactionStore } from './handlers/transactions';
export { resetAccountStore } from './handlers/accounts';
export { resetCategoryStore } from './handlers/categories';
export { resetFamilyStore } from './handlers/family';
export { resetBudgetStore } from './handlers/budgets';
