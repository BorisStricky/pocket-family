// src/features/transactions/components/AddTransactionModal.tsx
// Modal dialog for creating new transactions with session memory.
// Wraps TransactionForm in a Dialog and persists the last submitted values
// to sessionStorage so repeat entries pre-fill account, type, category, etc.

import React from 'react';
import { Dialog, DialogTitle, DialogContent, Alert } from '@mui/material';
import { TransactionForm } from './TransactionForm';
import { useCreateTransaction } from '../hooks/useCreateTransaction';
import type { TransactionCreate } from '../types';

/** sessionStorage key for remembering the last submitted transaction defaults */
const SESSION_KEY = 'pf_last_transaction_defaults';

/**
 * Fields persisted across successive "Add Transaction" submissions within the
 * same browser tab session. Amount and description are always fresh.
 */
interface TransactionSessionDefaults {
  account_id: string;
  transaction_type: string;
  category_id: string;
  currency: string;
  transaction_date: string;
}

interface AddTransactionModalProps {
  open: boolean;
  familyId: string;
  onClose: () => void;
}

/**
 * Read previously submitted defaults from sessionStorage.
 * Returns undefined if nothing was saved yet.
 */
function readSessionDefaults(): Partial<TransactionCreate> | undefined {
  try {
    const raw = sessionStorage.getItem('pf_last_transaction_defaults');
    if (!raw) return undefined;
    return JSON.parse(raw) as TransactionSessionDefaults;
  } catch {
    return undefined;
  }
}

/**
 * Persist structural fields so the next "Add Transaction" pre-fills them.
 */
function writeSessionDefaults(data: TransactionCreate): void {
  const defaults: TransactionSessionDefaults = {
    account_id: data.account_id,
    transaction_type: data.transaction_type,
    category_id: data.category_id ?? '',
    currency: data.currency ?? 'BRL',
    transaction_date: data.transaction_date,
  };
  sessionStorage.setItem('pf_last_transaction_defaults', JSON.stringify(defaults));
}

/**
 * AddTransactionModal — Dialog wrapper around TransactionForm for inline creation.
 *
 * The component is conditionally rendered from TransactionsPage so the form
 * remounts on each open, picking up fresh defaultValues from sessionStorage.
 */
export function AddTransactionModal({ open, familyId, onClose }: AddTransactionModalProps) {
  const { mutate: createTransaction, isPending, error } = useCreateTransaction();

  // Load session defaults once when the modal mounts
  const sessionDefaults = readSessionDefaults();

  const handleSubmit = (data: TransactionCreate) => {
    createTransaction(data, {
      onSuccess: () => {
        // Persist the submitted values for next time
        writeSessionDefaults(data);
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Transaction</DialogTitle>
      <DialogContent>
        {/* API error displayed above the form */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error instanceof Error ? error.message : 'Failed to create transaction'}
          </Alert>
        )}

        <TransactionForm
          familyId={familyId}
          defaultOverrides={sessionDefaults}
          onSubmit={handleSubmit}
          onCancel={onClose}
          isLoading={isPending}
          hideTitle
        />
      </DialogContent>
    </Dialog>
  );
}
