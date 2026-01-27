// src/types/account.ts
// TypeScript type definitions for Account entities matching backend schemas

export type AccountType = 'cash' | 'debit' | 'credit';
export type Currency = 'BRL' | 'USD' | 'EUR';
export type ShareVisibility = 'hidden' | 'visible';

/**
 * AccountRead - Full account data returned from API
 * Represents a financial account (bank, credit card, cash) with current balance
 */
export interface AccountRead {
  id: string; // UUID
  user_id: string; // UUID of account owner
  user_name: string; // Display name of account owner
  name: string; // Account name (e.g., "Checking Account", "Credit Card")
  type: AccountType; // Account type: cash, debit, or credit
  currency: Currency; // Currency code (BRL, USD, EUR)
  balance: string | null; // Current balance as string for precision, may be null if masked
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

/**
 * AccountCreate - Data required to create a new account
 * Optional share_with field allows atomic creation of account + share
 */
export interface AccountCreate {
  name: string; // Required: account name
  type: AccountType; // Required: account type (cash/debit/credit)
  currency?: Currency; // Optional: defaults to BRL if not provided
  balance?: number | string; // Optional: initial balance, defaults to 0
  share_with?: AccountShareWith; // Optional: atomically share account with family on creation
}

/**
 * AccountUpdate - Partial update data for existing account
 * All fields are optional, only provided fields will be updated
 */
export interface AccountUpdate {
  name?: string | null;
  type?: AccountType | null;
  currency?: Currency | null;
  balance?: number | string | null;
}

/**
 * AccountShareWith - Data for atomically sharing account during creation
 * Used in AccountCreate.share_with field to create account and share in single transaction
 */
export interface AccountShareWith {
  tenant_id: string; // UUID of family to share account with
  visibility?: ShareVisibility; // Optional: defaults to "hidden" if not provided
}

/**
 * AccountShareCreate - Data for creating a new account share
 * Used when sharing an existing account with a family
 */
export interface AccountShareCreate {
  tenant_id: string; // UUID of family to share with
  visibility?: ShareVisibility; // Optional: defaults to "hidden"
}

/**
 * AccountShareRead - Full account share data returned from API
 * Represents a link between an account and a family with visibility settings
 */
export interface AccountShareRead {
  id: string; // UUID of the share record
  account_id: string; // UUID of the shared account
  tenant_id: string; // UUID of the family the account is shared with
  visibility: ShareVisibility; // Visibility level: hidden (balance masked) or visible (balance shown)
  granted_by: string; // UUID of user who created the share
  granted_at: string; // ISO datetime when share was created
}

/**
 * AccountShareUpdate - Partial update data for existing share
 * Currently only visibility can be updated
 */
export interface AccountShareUpdate {
  visibility?: ShareVisibility | null;
}
