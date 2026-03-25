import React from 'react';
import Box from '@mui/material/Box';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Avatar from '../atoms/Avatar';
import Chip from '../atoms/Chip';
import Icon from '../atoms/Icon';
import { formatDisplayDate } from '@/lib/dateUtils';

/**
 * Frontend Transaction shape aligned with backend Transaction model.
 * Keep tenant_id and account_id/category_id present in the object (for API actions)
 * but the UI shows `account` and `category` (their display names).
 */
export type Transaction = {
  id: string; // transaction id (used for actions)
  tenant_id?: string; // present in read_json but not displayed
  account_id?: string;
  account?: string; // display name
  category_id?: string | null;
  category?: string | null; // display name
  transaction_date: string; // ISO date
  transaction_type?: 'expense' | 'income'; // backend uses expense/income
  amount: number | string; // cents (number) or decimal string
  currency?: string;
  created_by?: string;
  description?: string | null;
  title?: string | null; // optional convenience field (not in backend)
  reconciled?: boolean;
  source?: 'manual' | 'recurring';
  avatarUrl?: string | null;
  recurring?: boolean; // convenience: may be derived from source === 'recurring'
};

export interface TransactionListItemProps {
  transaction: Transaction;
  onClick?: (transaction: Transaction) => void;
  showCategory?: boolean;
  compact?: boolean;
}

const formatCurrency = (amount: number | string, currency = 'BRL') => {
  // Support both integer cents and decimal string amounts.
  // If it's a string and contains '.', treat as decimal amount.
  let valueNumber: number;
  if (typeof amount === 'string') {
    if (amount.includes('.')) {
      // decimal string like "1234.56" -> numeric value in BRL
      valueNumber = parseFloat(amount);
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(valueNumber);
    }
    // otherwise fall back to parseInt (assume cents string)
    valueNumber = parseInt(amount, 10) / 100;
  } else {
    // numeric: assume cents
    valueNumber = amount / 100;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(valueNumber);
};

export const TransactionListItem: React.FC<TransactionListItemProps> = ({ transaction, onClick, showCategory = true, compact = false }) => {
  // Map backend transaction_type to a color: income -> credit (green), expense -> debit (red)
  const isCredit = transaction.transaction_type === 'income';
  const amountColor = isCredit ? 'success.main' : 'error.main';
  const dateLabel = transaction.transaction_date ? formatDisplayDate(transaction.transaction_date) : '';

  return (
    <ListItem disablePadding>
      <ListItemButton
        onClick={() => onClick?.(transaction)}
        sx={{
          px: 2,
          py: compact ? 0.75 : 1.5,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <ListItemAvatar>
          <Avatar src={transaction.avatarUrl ?? null} name={transaction.title ?? transaction.account ?? 'Transaction'} size={compact ? 36 : 48} />
        </ListItemAvatar>

        <ListItemText
          primary={
            <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
              <Box>
                <Typography variant={compact ? 'body2' : 'body1'} component="div" sx={{ fontWeight: 600 }}>
                  {transaction.title ?? transaction.description ?? 'Transaction'}
                </Typography>
                {/* show account name as subtitle if present */}
                {transaction.account && (
                  <Typography variant="caption" color="text.secondary" component="div">
                    {transaction.account}
                  </Typography>
                )}
              </Box>

              <Box textAlign="right">
                <Typography sx={{ fontWeight: 700, color: amountColor }}>
                  {formatCurrency(transaction.amount, transaction.currency)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dateLabel}
                </Typography>
              </Box>
            </Box>
          }
          secondary={
            showCategory ? (
              <Box mt={1} display="flex" alignItems="center" gap={1}>
                {transaction.category && <Chip label={transaction.category} size="small" />}
                {(transaction.source === 'recurring' || transaction.recurring) && <Icon name="Repeat" size={14} title="Recurring" />}
                {transaction.reconciled && <Chip label="Reconciled" size="small" />}
              </Box>
            ) : null
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

export default TransactionListItem;
