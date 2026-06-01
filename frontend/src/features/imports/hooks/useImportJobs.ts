// src/features/imports/hooks/useImportJobs.ts
// Fetches the import history list for the current tenant.
//
// Refetches every 5 seconds while any job is still in flight so the history
// page reflects worker progress without the user having to refresh. Once all
// jobs are in a terminal state (done/failed), polling pauses.

import { useQuery } from '@tanstack/react-query';
import { listImportJobs } from '../api/importsApi';

export function useImportJobs(familyId: string) {
  return useQuery({
    queryKey: ['import-jobs', familyId],
    queryFn: listImportJobs,
    refetchInterval: (query) => {
      const jobs = query.state.data;
      if (!jobs) return false;
      const anyInFlight = jobs.some(
        (job) => job.status === 'pending' || job.status === 'started'
      );
      return anyInFlight ? 5000 : false;
    },
  });
}
