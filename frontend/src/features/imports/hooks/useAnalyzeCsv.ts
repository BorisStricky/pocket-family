// src/features/imports/hooks/useAnalyzeCsv.ts
// Mutation hook for the column mapping / analyze step.

import { useMutation } from '@tanstack/react-query';
import { analyzeCsv } from '../api/importsApi';
import type { AnalyzeRequest } from '../types';

export function useAnalyzeCsv() {
  return useMutation({
    mutationFn: (request: AnalyzeRequest) => analyzeCsv(request),
  });
}
