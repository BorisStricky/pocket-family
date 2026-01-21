// src/types/transaction.ts
export type CategoryKind = 'expense' | 'income';
export type TransactionSource = 'manual' | 'recurring';

export interface Transaction {
  id: string;
  tenant_id: string;
  account_id: string;
  account_name: string;
  category_id: string | null;
  category_name: string | null;
  amount: string; // backend returns string for precision
  currency: 'BRL' | 'USD' | 'EUR' | string;
  transaction_date: string; // YYYY-MM-DD
  transaction_type: CategoryKind;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  reconciled: boolean;
  source: TransactionSource;
}
