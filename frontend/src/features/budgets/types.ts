// src/features/budgets/types.ts
// TypeScript type definitions for Budget entities matching backend schemas

import type { CategoryRead } from '@/types/category';

/**
 * BudgetRead - Full budget data returned from API
 *
 * Represents a monthly spending limit that can track one or more categories.
 * The "spent" field is calculated on-read by the backend by aggregating
 * expense transactions matching the budget's currency for the requested month.
 * A budget with no categories acts as a "universal budget" tracking ALL tenant expenses.
 */
export interface BudgetRead {
  id: string; // UUID of the budget
  tenant_id: string; // UUID of the family/tenant this budget belongs to
  name: string; // Budget display name (e.g., "Monthly Entertainment")
  amount: number; // Spending limit for the month (must be > 0)
  currency: string; // ISO 4217 currency code (e.g., "BRL", "USD")
  categories: CategoryRead[]; // Categories tracked by this budget (empty = universal)
  spent: number; // Calculated: total expense transactions for the month matching currency
  month: number; // Calendar month (1-12) the spent calculation covers
  year: number; // Calendar year the spent calculation covers
  icon: string | null; // lucide-react icon name for visual identity, null if not set
  color: string | null; // hex color string (#RRGGBB) for display, null if not set
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

/**
 * BudgetCreatePayload - Data required to create a new budget
 *
 * Only name and amount are required. Currency defaults to "BRL" on the backend.
 * Omitting category_ids creates a universal budget that tracks all tenant spending.
 */
export interface BudgetCreatePayload {
  name: string; // Required: budget display name
  amount: number; // Required: monthly spending limit (must be > 0)
  currency?: string; // Optional: ISO 4217 code, defaults to "BRL"
  category_ids?: string[]; // Optional: UUIDs of categories to track (empty = universal)
  icon?: string | null; // Optional: lucide-react icon name
  color?: string | null; // Optional: hex color string (#RRGGBB)
}

/**
 * BudgetUpdatePayload - Partial update data for existing budget
 *
 * All fields are optional. Only provided fields will be updated.
 * When category_ids is provided, it fully REPLACES the existing category set
 * (not additive). Omitting category_ids leaves the current categories unchanged.
 */
export interface BudgetUpdatePayload {
  name?: string; // Optional: new budget name
  amount?: number; // Optional: new spending limit (must be > 0)
  currency?: string; // Optional: new ISO 4217 currency code
  category_ids?: string[]; // Optional: full replacement of category set
  icon?: string | null; // Pass null to clear the icon
  color?: string | null; // Pass null to clear the color
}
