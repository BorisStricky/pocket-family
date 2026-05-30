// src/features/imports/hooks/useUploadCsv.ts
// Mutation hook for the CSV upload step.

import { useMutation } from '@tanstack/react-query';
import { uploadCsv } from '../api/importsApi';

export function useUploadCsv() {
  return useMutation({
    mutationFn: (file: File) => uploadCsv(file),
  });
}
