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
import { useTranslation } from 'react-i18next';
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

// Map each backend status value to the imports.status* translation key.
// Every possible ImportJobStatus value must have an entry here — a missing key
// would cause i18next to render the raw key string instead of translated text.
const STATUS_TRANSLATION_KEY: Record<ImportJobStatus, string> = {
  pending: 'imports.statusPending',
  started: 'imports.statusStarted',
  done: 'imports.statusDone',
  failed: 'imports.statusFailed',
};

// Context passed to the status cell renderer so it can call t() without being
// inside the React component tree (AG Grid cell renderers are plain functions).
interface HistoryGridContext {
  t: (key: string) => string;
}

function StatusCellRenderer(params: ICellRendererParams<ImportJobRead>) {
  const row = params.data;
  if (!row) return null;
  const ctx = params.context as HistoryGridContext;
  // Translate the raw backend status to the user's locale via the lookup table.
  // Falling back to row.status ensures nothing renders as blank if an unexpected
  // status value arrives from the server.
  const translatedLabel = ctx.t(STATUS_TRANSLATION_KEY[row.status] ?? row.status);
  const chip = (
    <Chip
      label={translatedLabel}
      color={STATUS_CHIP_COLOR[row.status]}
      size="small"
      variant={row.status === 'done' ? 'filled' : 'outlined'}
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
  const { t } = useTranslation();
  const currentRole = useCurrentRole();

  // Viewers have read-only access to family data — import history is an
  // operational view scoped to members/owners who can actually run imports.
  useEffect(() => {
    if (currentRole === 'viewer') {
      navigate(`/app/${familyId}/transactions`, { replace: true });
    }
  }, [currentRole, familyId, navigate]);

  const { data: importJobs, isLoading, error } = useImportJobs(familyId!);

  // Pass t into the grid context so the StatusCellRenderer (a plain function,
  // not a React component) can produce translated chip labels.
  const gridContext: HistoryGridContext = useMemo(() => ({ t }), [t]);

  const columnDefinitions: ColDef<ImportJobRead>[] = useMemo(() => [
    {
      field: 'created_at',
      headerName: t('imports.historyColDate'),
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
      headerName: t('imports.historyColAccount'),
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 160,
      // account_name is a user-defined account name — render verbatim
      valueFormatter: (params) => params.value || '—',
    },
    {
      field: 'filename',
      headerName: t('imports.historyColFile'),
      sortable: true,
      filter: true,
      flex: 1.4,
      minWidth: 220,
      // filename is the user's uploaded file name — render verbatim
      valueFormatter: (params) => params.value || '—',
    },
    {
      headerName: t('imports.historyColProgress'),
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
      headerName: t('imports.historyColStatus'),
      width: 130,
      cellRenderer: StatusCellRenderer,
      filter: true,
    },
  ], [t]);

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
            {t('imports.historyBackToTransactions')}
          </Button>
        </Stack>
        {currentRole !== 'viewer' && (
          <Button
            variant="contained"
            startIcon={<FileUploadIcon />}
            onClick={() => navigate(`/app/${familyId}/import-csv`)}
          >
            {t('imports.historyNewImport')}
          </Button>
        )}
      </Box>

      <Typography variant="h4" component="h1" gutterBottom>
        {t('imports.historyPageTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('imports.historyPageDescription')}
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
          {error instanceof Error ? error.message : t('imports.historyLoadError')}
        </Alert>
      )}

      {/* Empty state */}
      {!isLoading && !error && importJobs && importJobs.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('imports.historyEmptyTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('imports.historyEmptyBody')}
          </Typography>
          {currentRole !== 'viewer' && (
            <Button
              variant="contained"
              startIcon={<FileUploadIcon />}
              onClick={() => navigate(`/app/${familyId}/import-csv`)}
            >
              {t('imports.historyImportCsv')}
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
            context={gridContext}
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
