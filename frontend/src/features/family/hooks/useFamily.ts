// src/features/family/hooks/useFamily.ts
// Hook to access FamilyContext

import { useContext } from 'react';
import { FamilyContext } from '../context/FamilyContext';

/**
 * Hook to access family context
 * Must be used within a FamilyProvider
 * Returns current family, families list, and switchFamily action
 *
 * Usage:
 * ```typescript
 * const { currentFamily, families, switchFamily } = useFamily();
 * ```
 */
export function useFamily() {
  const context = useContext(FamilyContext);

  if (!context) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }

  return context;
}
