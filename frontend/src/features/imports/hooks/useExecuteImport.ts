// src/features/imports/hooks/useExecuteImport.ts
// Mutation hook for dispatching the final import job.

import { useMutation } from '@tanstack/react-query';
import { executeImport } from '../api/importsApi';
import type { ExecuteRequest } from '../types';

export function useExecuteImport() {
  return useMutation({
    mutationFn: (request: ExecuteRequest) => executeImport(request),
  });
}
