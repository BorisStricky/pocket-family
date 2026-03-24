// src/components/modals/TransactionDetailModal.tsx
import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, useMediaQuery, Box, Typography, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTransaction } from '../../hooks/useTransaction';
import { useUpdateTransaction, useDeleteTransaction, useDuplicateTransaction } from '../../hooks/useTransactionMutations';
import { TransactionForm } from '../TransactionForm';
import type { Transaction } from '../../types/transaction';

/**
 * TransactionDetailModal
 *
 * Route: /app/:family_id/transactions/:transactionId
 *
 * Behavior:
 * - Fetches transaction using useTransaction
 * - Shows readonly detail; toggle to edit by opening edit form in-place
 * - Actions: Edit (switches to form), Duplicate (creates a new tx copy), Delete (confirm)
 *
 * On close: navigate back to parent route (history.back equivalent)
 */

export default function TransactionDetailModal() {
  const { family_id: familyId, transactionId } = useParams() as { family_id?: string; transactionId?: string };
  const navigate = useNavigate();
  const isSmall = useMediaQuery('(max-width:600px)');
  const { data: tx, isLoading, error } = useTransaction(familyId || '', transactionId);
  const updateMut = useUpdateTransaction(familyId || '');
  const deleteMut = useDeleteTransaction(familyId || '');
  const dupMut = useDuplicateTransaction(familyId || '');

  // Local state: whether in-edit mode (simple approach)
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    // reset editing when transaction changes
    setEditing(false);
  }, [transactionId]);

  const close = () => {
    // go back to transactions list; prefer history.back-like behavior
    navigate(-1);
  };

  // Prevent closing on backdrop click to avoid accidental data loss on mobile
  const handleDialogClose = (_event: object, reason: string) => {
    if (reason === 'backdropClick') return;
    close();
  };

  // Minimal delete confirmation using window.confirm for now
  const onDelete = async () => {
    if (!transactionId) return;
    const ok = window.confirm('Delete transaction? This action cannot be undone.');
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(transactionId);
      close();
    } catch (e) {
      console.error(e);
      alert('Failed to delete transaction');
    }
  };

  const onDuplicate = async () => {
    if (!transactionId) return;
    try {
      await dupMut.mutateAsync(transactionId);
      // optionally close and let caller refresh list
      close();
    } catch (e) {
      console.error(e);
      alert('Failed to duplicate transaction');
    }
  };

  const onSubmitEdit = async (formData: Partial<Transaction>) => {
    if (!transactionId) return;
    try {
      await updateMut.mutateAsync({ transactionId, body: formData });
      setEditing(false);
    } catch (e) {
      console.error(e);
      alert('Failed to update transaction');
    }
  };

  const title = useMemo(() => {
    if (tx) {
      return `${tx.transaction_type === 'income' ? 'Income' : 'Expense'} • ${tx.amount} ${tx.currency}`;
    }
    return 'Transaction';
  }, [tx]);

  return (
    <Dialog
      open={true}
      fullScreen={isSmall}
      onClose={handleDialogClose}
      aria-labelledby="transaction-detail-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="transaction-detail-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">{title}</Typography>
          {tx && <Typography variant="caption" color="text.secondary">{tx.transaction_date}</Typography>}
        </Box>

        <Box>
          <IconButton aria-label="duplicate" onClick={onDuplicate} size="large">
            <ContentCopyIcon />
          </IconButton>
          <IconButton aria-label="edit" onClick={() => setEditing((s) => !s)} size="large">
            <EditIcon />
          </IconButton>
          <IconButton aria-label="delete" onClick={onDelete} size="large">
            <DeleteIcon />
          </IconButton>
          <IconButton aria-label="close" onClick={close} size="large">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {isLoading && <Typography>Loading...</Typography>}
        {error && <Typography color="error">Failed to load transaction</Typography>}
        {!isLoading && tx && !editing && (
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Typography variant="subtitle2">Amount</Typography>
            <Typography>{tx.amount} {tx.currency}</Typography>
            <Divider />
            <Typography variant="subtitle2">Account</Typography>
            <Typography>{tx.account_id}</Typography>
            <Divider />
            <Typography variant="subtitle2">Category</Typography>
            <Typography>{tx.category_id || 'Uncategorized'}</Typography>
            <Divider />
            <Typography variant="subtitle2">Date</Typography>
            <Typography>{tx.transaction_date}</Typography>
            <Divider />
            <Typography variant="subtitle2">Description</Typography>
            <Typography>{tx.description || '-'}</Typography>
            <Divider />
            <Typography variant="subtitle2">Meta</Typography>
            <Typography variant="caption">Created by: {tx.created_by}</Typography>
            <Typography variant="caption">Created: {new Date(tx.created_at).toLocaleString()}</Typography>
            <Typography variant="caption">Updated: {new Date(tx.updated_at).toLocaleString()}</Typography>
          </Box>
        )}

        {!isLoading && tx && editing && (
          <TransactionForm initial={tx} onSubmit={onSubmitEdit} loading={updateMut.isLoading} />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={close}>Close</Button>
        {editing ? (
          <Button onClick={() => setEditing(false)}>Cancel</Button>
        ) : (
          <Button onClick={() => setEditing(true)} variant="contained">Edit</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
