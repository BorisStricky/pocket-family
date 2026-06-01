// src/features/imports/components/steps/ImportStep.tsx
// Step 3 of the CSV import wizard: dispatch the import job and track progress.
//
// On mount the component dispatches the execute request and immediately starts
// polling. The user sees a spinner while the worker processes the rows, then
// a success or error message when done.

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { executeImport } from '../../api/importsApi';
import { useJobStatus } from '../../hooks/useJobStatus';
import type { ExecuteRequest } from '../../types';

interface ImportStepProps {
  executeRequest: ExecuteRequest;
  onStartOver: () => void;
}

/**
 * ImportStep — fires the import job and polls for progress.
 *
 * Dispatches the job once on mount and then polls GET /imports/jobs/{id}
 * every 2 seconds until the job finishes. Provides a link back to the
 * transactions page on success.
 */
export function ImportStep({ executeRequest, onStartOver }: ImportStepProps) {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();

  // React StrictMode (dev) intentionally double-invokes effects. Without this
  // ref guard, the import job would be dispatched twice on mount and every
  // CSV row would be inserted twice.
  const hasDispatchedRef = useRef(false);

  // We deliberately bypass useMutation here and call the API directly. The
  // previous useMutation approach was leaving the dispatched job_id stuck on
  // a stale mutation observer in StrictMode dev, so polling never started.
  // A plain useState + fetch is simpler and behaves predictably across the
  // strict-mode double-mount cycle.
  const [jobId, setJobId] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(true);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const { data: jobStatus } = useJobStatus(jobId);

  // Dispatch the import job once when the component mounts. We do NOT return
  // a cleanup that cancels the in-flight fetch — in StrictMode dev the cleanup
  // fires between the two effect invocations, and cancelling would orphan the
  // dispatch (the second mount has hasDispatchedRef === true and skips, so no
  // new dispatch happens to set state). React 18 silently no-ops setState on
  // an unmounted component, so we don't need an explicit cancel for real
  // unmount either.
  useEffect(() => {
    if (hasDispatchedRef.current) return;
    hasDispatchedRef.current = true;

    executeImport(executeRequest)
      .then((response) => {
        setJobId(response.job_id);
        setIsDispatching(false);
      })
      .catch((error: unknown) => {
        setDispatchError(error instanceof Error ? error.message : 'Failed to start import');
        setIsDispatching(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importStatus = jobStatus?.status ?? (isDispatching ? 'pending' : null);
  const isRunning = importStatus === 'pending' || importStatus === 'started';
  const isDone = importStatus === 'done';
  const isFailed = importStatus === 'failed' || Boolean(dispatchError);

  const progressPercent =
    jobStatus?.total && jobStatus?.imported !== undefined
      ? Math.round((jobStatus.imported / jobStatus.total) * 100)
      : undefined;

  // Auto-redirect to the transactions page after a brief pause so the user
  // sees the "Import complete!" confirmation. The manual "View Transactions"
  // button below stays as an escape hatch in case redirect is interrupted.
  useEffect(() => {
    if (!isDone) return;
    const timer = setTimeout(() => {
      navigate(`/app/${familyId}/transactions`);
    }, 1500);
    return () => clearTimeout(timer);
  }, [isDone, familyId, navigate]);

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', textAlign: 'center' }}>
      {/* Running state */}
      {isRunning && (
        <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={48} />
          <Typography variant="h6">
            {importStatus === 'pending' ? 'Queuing import…' : 'Importing transactions…'}
          </Typography>
          {progressPercent !== undefined && (
            <>
              <LinearProgress variant="determinate" value={progressPercent} sx={{ width: '100%' }} />
              <Typography variant="body2" color="text.secondary">
                {jobStatus?.imported} of {jobStatus?.total} transactions processed
              </Typography>
            </>
          )}
          <Typography variant="caption" color="text.secondary">
            This may take a few seconds. Do not close this tab.
          </Typography>
        </Stack>
      )}

      {/* Success state */}
      {isDone && (
        <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main' }} />
          <Typography variant="h6">Import complete!</Typography>
          <Typography variant="body2" color="text.secondary">
            {jobStatus?.imported} transaction{jobStatus?.imported !== 1 ? 's' : ''} imported successfully.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate(`/app/${familyId}/transactions`)}
          >
            View Transactions
          </Button>
        </Stack>
      )}

      {/* Error state */}
      {isFailed && (
        <Stack spacing={2} sx={{ py: 2 }} alignItems="stretch">
          <Alert severity="error" sx={{ textAlign: 'left' }}>
            {dispatchError ?? jobStatus?.error ?? 'The import failed. Please check your CSV and try again.'}
          </Alert>
          <Button variant="outlined" onClick={onStartOver}>
            Start Over
          </Button>
        </Stack>
      )}
    </Box>
  );
}
