// src/features/transactions/types/index.ts
// TypeScript type definitions for Transactions feature
// Matches backend Pydantic schemas from OpenAPI spec

import { CategoryKind, TransactionSource } from '@/types';

/**
 * TransactionRead represents the full transaction response from the API
 * Includes joined account_name and category_name from related tables
 * Matches backend TransactionRead schema
 */
export interface TransactionRead {
  id: string;
  tenant_id: string;
  account_id: string;
  account_name: string;
  account_icon: string | null; // lucide-react icon name resolved from Account
  account_color: string | null; // hex color string resolved from Account
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null; // lucide-react icon name resolved from Category
  category_color: string | null; // hex color string resolved from Category
  amount: string; // Decimal returned as string for precision
  currency: string;
  transaction_date: string; // ISO date string (YYYY-MM-DD)
  transaction_type: CategoryKind;
  description: string | null;
  created_by: string;
  created_by_name: string | null; // Display name of the user who created this transaction
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
  reconciled: boolean;
  source: TransactionSource;
}

/**
 * TransactionCreate represents the payload for creating a new transaction
 * tenant_id must be included in the request body for multi-tenant validation
 * Matches backend TransactionCreate schema
 */
export interface TransactionCreate {
  tenant_id: string;
  account_id: string;
  category_id?: string | null;
  amount: number | string;
  currency?: string;
  transaction_date: string; // ISO date string (YYYY-MM-DD)
  transaction_type: CategoryKind;
  description?: string | null;
  source?: TransactionSource;
}

/**
 * TransactionUpdate represents the payload for updating an existing transaction
 * All fields are optional - only provided fields will be updated
 * Matches backend TransactionUpdate schema
 */
export interface TransactionUpdate {
  category_id?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  transaction_date?: string | null;
  transaction_type?: CategoryKind | null;
  description?: string | null;
  reconciled?: boolean | null;
}

/**
 * TransactionFilters represents optional query parameters for filtering transactions
 * Used in fetchTransactions to narrow down results by date, account, category, etc.
 */
export interface TransactionFilters {
  account_id?: string;
  category_id?: string;
  transaction_type?: CategoryKind;
  start_date?: string; // ISO date string (YYYY-MM-DD)
  end_date?: string; // ISO date string (YYYY-MM-DD)
  search?: string;
}

// Re-export enums for convenience
export { CategoryKind, TransactionSource };
