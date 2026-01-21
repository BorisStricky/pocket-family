// src/components/TransactionForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { TextField, Button, MenuItem, Grid } from '@mui/material';
import type { Transaction } from '../types/transaction';

type Props = {
  initial?: Partial<Transaction>;
  onSubmit: (data: Partial<Transaction>) => Promise<any> | any;
  loading?: boolean;
};

export function TransactionForm({ initial = {}, onSubmit, loading = false }: Props) {
  const { register, handleSubmit, formState } = useForm<Partial<Transaction>>({
    defaultValues: {
      amount: initial.amount || '',
      currency: initial.currency || 'BRL',
      transaction_date: initial.transaction_date || new Date().toISOString().slice(0, 10),
      transaction_type: initial.transaction_type || 'expense',
      description: initial.description || '',
      account_id: initial.account_id || '',
      category_id: initial.category_id || null,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} aria-label="transaction-form">
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField label="Amount" fullWidth {...register('amount', { required: true })} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField select label="Currency" fullWidth {...register('currency')}>
            <MenuItem value="BRL">BRL</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
            <MenuItem value="EUR">EUR</MenuItem>
          </TextField>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField label="Date" type="date" fullWidth {...register('transaction_date', { required: true })} InputLabelProps={{ shrink: true }} />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField select label="Type" fullWidth {...register('transaction_type')}>
            <MenuItem value="expense">Expense</MenuItem>
            <MenuItem value="income">Income</MenuItem>
          </TextField>
        </Grid>

        <Grid item xs={12}>
          <TextField label="Description" fullWidth multiline rows={2} {...register('description')} />
        </Grid>

        {/* account/category fields should be replaced by searchable selects in real app */}
        <Grid item xs={12} container spacing={2} justifyContent="flex-end">
          <Grid item>
            <Button onClick={() => { /* handled by parent via dialog close */ }} disabled={loading} variant="outlined">Cancel</Button>
          </Grid>
          <Grid item>
            <Button type="submit" variant="contained" disabled={loading || formState.isSubmitting}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Grid>
        </Grid>
      </Grid>
    </form>
  );
}
