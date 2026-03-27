import React from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import CircularProgress from '@mui/material/CircularProgress';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TransactionListItem, { Transaction } from '../molecules/TransactionListItem';
import Button from '../atoms/Button';

export interface TransactionsListProps {
  data?: Transaction[]; // optional: if omitted, component shows loading or empty
  loading?: boolean;
  onRowClick?: (transaction: Transaction) => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
}

export const TransactionsList: React.FC<TransactionsListProps> = ({
  data,
  loading = false,
  onRowClick,
  page = 1,
  totalPages = 1,
  onPageChange,
  emptyMessage = 'No transactions found',
}) => {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box textAlign="center" py={6}>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {emptyMessage}
        </Typography>
        <Button variant="secondary" onClick={() => console.log('retry')}>Retry</Button>
      </Box>
    );
  }

  return (
    <Box>
      <List>
        {data.map((transaction) => (
          <TransactionListItem key={transaction.id} transaction={transaction} onClick={onRowClick} />
        ))}
      </List>

      <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
        <Pagination count={totalPages} page={page} onChange={(_, p) => onPageChange?.(p)} />
      </Stack>
    </Box>
  );
};

export default TransactionsList;
