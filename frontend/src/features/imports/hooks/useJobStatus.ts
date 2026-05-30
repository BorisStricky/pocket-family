// src/features/imports/hooks/useJobStatus.ts
// Polling query hook for import job status.
// Polls every 2 seconds while status is pending or started.
// Automatically stops polling when the job reaches a terminal state.

import { useQuery } from '@tanstack/react-query';
import { getJobStatus } from '../api/importsApi';

export function useJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ['import-job', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: jobId !== null,
    // refetchInterval receives the current query state and returns the next interval
    // Returning false stops polling when the job is done or failed
    refetchInterval: (query) => {
      const importStatus = query.state.data?.status;
      if (importStatus === 'done' || importStatus === 'failed') return false;
      return 2000;
    },
  });
}
