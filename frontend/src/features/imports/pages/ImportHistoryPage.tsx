// src/features/imports/pages/ImportHistoryPage.tsx
// Shows the history of CSV import jobs for the active family in an AG Grid.
//
// The list is live: while any job is still pending/started, useImportJobs
// polls every 5 seconds so the status chip flips to "done" or "failed"
// without a manual refresh.

import React, { useMemo, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FileUpload as FileUploadIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { useImportJobs } from '../hooks/useImportJobs';
import type { ImportJobRead, ImportJobStatus } from '../types';
import { formatDisplayDate } from '@/lib/dateUtils';
import { useCurrentRole } from '@/features/family/hooks/useCurrentRole';

// Map each job status to a Chip color so the row is scannable at a glance.
const STATUS_CHIP_COLOR: Record<ImportJobStatus, 'default' | 'info' | 'success' | 'error'> = {
  pending: 'default',
  started: 'info',
  done: 'success',
  failed: 'error',
};

function StatusCellRenderer(params: ICellRendererParams<ImportJobRead>) {
  const row = params.data;
  if (!row) return null;
  const chip = (
    <Chip
      label={row.status}
      color={STATUS_CHIP_COLOR[row.status]}
      size="small"
      variant={row.status === 'done' ? 'filled' : 'outlined'}
      sx={{ textTransform: 'capitalize' }}
    />
  );
  // Failed rows surface their error message via a tooltip so the whole table
  // doesn't have to widen to fit long stack traces.
  if (row.status === 'failed' && row.error_message) {
    return <Tooltip title={row.error_message}>{chip}</Tooltip>;
  }
  return chip;
}

/**
 * ImportHistoryPage — list every previous CSV import for the active family.
 */
export function ImportHistoryPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const currentRole = useCurrentRole();

  // Viewers have read-only access to family data — import history is an
  // operational view scoped to members/owners who can actually run imports.
  useEffect(() => {
    if (currentRole === 'viewer') {
      navigate(`/app/${familyId}/transactions`, { replace: true });
    }
  }, [currentRole, familyId, navigate]);

  const { data: importJobs, isLoading, error } = useImportJobs(familyId!);

  const columnDefinitions: ColDef<ImportJobRead>[] = useMemo(() => [
    {
      field: 'created_at',
      headerName: 'Date',
      sortable: true,
      sort: 'desc',
      width: 180,
      valueFormatter: (params) => {
        if (!params.value) return '';
        // Show date + time so multiple imports on the same day are distinguishable.
        const dateObject = new Date(params.value);
        return `${formatDisplayDate(dateObject)} ${dateObject.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
      },
    },
    {
      field: 'account_name',
      headerName: 'Account',
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 160,
      valueFormatter: (params) => params.value || '—',
    },
    {
      field: 'filename',
      headerName: 'File',
      sortable: true,
      filter: true,
      flex: 1.4,
      minWidth: 220,
      valueFormatter: (params) => params.value || '—',
    },
    {
      headerName: 'Imported / Total',
      colId: 'progress',
      width: 160,
      valueGetter: (params) => {
        const row = params.data;
        if (!row) return '';
        return `${row.imported_rows} / ${row.total_rows}`;
      },
      cellStyle: { fontVariantNumeric: 'tabular-nums' },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      cellRenderer: StatusCellRenderer,
      filter: true,
    },
  ], []);

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/app/${familyId}/transactions`)}
            variant="text"
          >
            Back to transactions
          </Button>
        </Stack>
        {currentRole !== 'viewer' && (
          <Button
            variant="contained"
            startIcon={<FileUploadIcon />}
            onClick={() => navigate(`/app/${familyId}/import-csv`)}
          >
            New Import
          </Button>
        )}
      </Box>

      <Typography variant="h4" component="h1" gutterBottom>
        Previous Imports
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every CSV import dispatched from this family appears here with its
        current status. Running imports refresh automatically.
      </Typography>

      {/* Loading state */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : 'Could not load import history.'}
        </Alert>
      )}

      {/* Empty state */}
      {!isLoading && !error && importJobs && importJobs.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No imports yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Once you import a CSV it will appear here with its status.
          </Typography>
          {currentRole !== 'viewer' && (
            <Button
              variant="contained"
              startIcon={<FileUploadIcon />}
              onClick={() => navigate(`/app/${familyId}/import-csv`)}
            >
              Import CSV
            </Button>
          )}
        </Paper>
      )}

      {/* Grid */}
      {!isLoading && !error && importJobs && importJobs.length > 0 && (
        <Box className="ag-theme-alpine" sx={{ height: 560, width: '100%' }}>
          <AgGridReact<ImportJobRead>
            rowData={importJobs}
            columnDefs={columnDefinitions}
            theme="legacy"
            getRowId={(params) => params.data.id}
            rowHeight={52}
            defaultColDef={{ resizable: true, filter: false, sortable: true }}
            animateRows={true}
          />
        </Box>
      )}
    </Box>
  );
}
