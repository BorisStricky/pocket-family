import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GridReadyEvent,
  GridApi,
  FirstDataRenderedEvent,
  ICellRendererParams,
  ValueFormatterParams,
  CellClassParams,
  ValueGetterParams,
  RowClickedEvent,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '../atoms/Button';
import Typography from '../atoms/Typography';
import Pagination from '@mui/material/Pagination';
import Chip from '../atoms/Chip';

// import shared Transaction type
import { Transaction } from '../molecules/TransactionListItem';
import { formatDisplayDate } from '@/lib/dateUtils';

export interface TransactionsGridProps {
  data: Transaction[];
  pageSize?: number; // client-side pagination page size
  onRowClicked?: (transaction: Transaction) => void;
  height?: number | string;
  showQuickFilter?: boolean;
}

const currencyFormatter = (params: ValueFormatterParams<Transaction>) => {
  const raw = params.value;
  if (raw == null) return '';
  // support cents (number) or decimal string
  if (typeof raw === 'string') {
    if (raw.includes('.')) {
      const numericValue = parseFloat(raw);
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: params.data?.currency || 'BRL' }).format(numericValue);
    } else {
      const numericValue = parseInt(raw, 10) / 100;
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: params.data?.currency || 'BRL' }).format(numericValue);
    }
  }
  const numericValue = raw / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: params.data?.currency || 'BRL' }).format(numericValue);
};

const dateFormatter = (params: ValueFormatterParams<Transaction>) => {
  const value = params.value;
  if (!value) return '';
  return formatDisplayDate(value);
};

export const TransactionsGrid: React.FC<TransactionsGridProps> = ({
  data,
  pageSize = 10,
  onRowClicked,
  height = 520,
  showQuickFilter = true,
}) => {
  const gridApiRef = useRef<GridApi<Transaction> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [quickFilter, setQuickFilter] = useState('');

  const rowData = useMemo(() => data ?? [], [data]);

  console.debug('[TransactionsGrid] rowData.length =', rowData?.length);

  const columnDefs = useMemo<ColDef<Transaction>[]>(
    () => [
      {
        headerName: 'Description',
        field: 'description',
        flex: 2,
        sortable: true,
        filter: 'agTextColumnFilter',
        resizable: true,
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams<Transaction>) => params.value ?? params.data?.title ?? '—',
      },
      {
        headerName: 'Account',
        field: 'account',
        flex: 1,
        filter: 'agTextColumnFilter',
        resizable: true,
        minWidth: 150,
      },
      {
        headerName: 'Category',
        field: 'category',
        width: 140,
        filter: 'agTextColumnFilter',
        resizable: true,
      },
      {
        headerName: 'Date',
        field: 'transaction_date',
        width: 120,
        valueFormatter: dateFormatter,
        filter: 'agDateColumnFilter',
        sortable: true,
      },
      {
        headerName: 'Amount',
        field: 'amount',
        width: 130,
        valueFormatter: currencyFormatter,
        filter: 'agNumberColumnFilter',
        sortable: true,
        cellStyle: (params: CellClassParams<Transaction>) => ({
          color: params.data?.transaction_type === 'income' ? 'var(--ag-theme-alpine-color-7, #2e7d32)' : 'var(--ag-theme-alpine-color-1, #c62828)',
          fontWeight: 700,
          textAlign: 'right',
        }),
      },
      {
        headerName: 'Added By',
        field: 'created_by',
        width: 140,
        filter: 'agTextColumnFilter',
        resizable: true,
      },
      {
        headerName: 'Recurring',
        field: 'source',
        width: 110,
        filter: 'agSetColumnFilter',
        filterParams: {
          values: ['Yes', 'No'],
          // show the pretty label in the popup (this just returns the same string)
          valueFormatter: (params: ValueFormatterParams<Transaction>) => params.value
        },
        // what the filter uses internally (turns raw data into the string the set filter expects)
        filterValueGetter: (params: ValueGetterParams<Transaction>) => (params.data?.source === 'recurring' ? 'Yes' : 'No'),
        // how the cell displays (optional if you already format elsewhere)
        valueFormatter: (params: ValueFormatterParams<Transaction>) => (params.value === 'recurring' ? 'Yes' : 'No'),
        cellRenderer: (params: ICellRendererParams<Transaction>) => (params.value === 'recurring' ? 'Yes' : 'No'),
      },
      {
        headerName: 'Reconciled',
        field: 'reconciled',
        width: 110,
        filter: 'agSetColumnFilter',
        filterParams: {
          values: [true, false], // ensures the popup shows True/False
          valueFormatter: (params: ValueFormatterParams<Transaction>) => (params.value ? 'Yes' : 'No'),
        },
        cellRenderer: (params: ICellRendererParams<Transaction>) => (params.value ? 'Yes' : 'No'),
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef<Transaction>>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
      floatingFilter: true,
      suppressMovable: false,
    }),
    []
  );

  const onGridReady = useCallback((params: GridReadyEvent<Transaction>) => {
    gridApiRef.current = params.api;
    try {
      params.api.paginationSetPageSize(pageSize);
      params.api.paginationGoToPage(currentPage - 1);
    } catch (gridError) {
      console.warn('[TransactionsGrid] pagination init warning', gridError);
    }
  }, [pageSize, currentPage]);

  const onFirstDataRendered = useCallback((params: FirstDataRenderedEvent<Transaction>) => {
    try {
      params.api.sizeColumnsToFit();
    } catch (_ignored) { /* grid may not be ready */ }
    const pageCount = Math.max(1, Math.ceil((rowData?.length || 0) / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), pageCount);
    setCurrentPage(safePage);
    try {
      params.api.paginationGoToPage(safePage - 1);
    } catch (_ignored) { /* grid may not be ready */ }
  }, [rowData, pageSize, currentPage]);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    if (gridApiRef.current) {
      gridApiRef.current.paginationGoToPage(page - 1);
    }
  };

  const onQuickFilterChange = (value: string) => {
    setQuickFilter(value);
    if (gridApiRef.current) {
      gridApiRef.current.setQuickFilter(value);
      setCurrentPage(1);
      gridApiRef.current.paginationGoToPage(0);
    }
  };

  const onRowClickedInternal = (event: RowClickedEvent<Transaction>) => {
    if (onRowClicked && event.data) onRowClicked(event.data);
  };

  const pageCount = Math.max(1, Math.ceil((rowData?.length || 0) / pageSize));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body" children={`Transactions (${rowData?.length ?? 0})`} />
        <Stack direction="row" spacing={1} alignItems="center">
          {showQuickFilter && (
            <input
              placeholder="Quick filter..."
              value={quickFilter}
              onChange={(event) => onQuickFilterChange(event.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.12)',
                minWidth: 200,
              }}
            />
          )}
          <Button
            variant="secondary"
            onClick={() => {
              gridApiRef.current?.setFilterModel(null);
              gridApiRef.current?.setSortModel(null);
              setCurrentPage(1);
              gridApiRef.current?.paginationGoToPage(0);
            }}
          >
            Reset
          </Button>
        </Stack>
      </Stack>

      <div className="ag-theme-alpine" style={{ height, width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowSelection="single"
          onGridReady={onGridReady}
          onFirstDataRendered={onFirstDataRendered}
          onRowClicked={onRowClickedInternal}
          pagination={true}
          paginationPageSize={pageSize}
          suppressRowClickSelection={true}
          animateRows={true}
          rowBuffer={0}
          rowModelType="clientSide"
          cacheQuickFilter={true}
          rowHoverHighlight={true}
          rowHeight={44}
        />
      </div>

      <Stack direction="row" justifyContent="flex-end" alignItems="center" sx={{ mt: 2 }}>
        <Chip label={`Page ${currentPage} / ${pageCount}`} />
        <Pagination count={pageCount} page={currentPage} onChange={handlePageChange} sx={{ ml: 2 }} />
      </Stack>
    </Box>
  );
};

export default TransactionsGrid;
