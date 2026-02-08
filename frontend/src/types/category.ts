// src/types/category.ts
// TypeScript type definitions for Category entities matching backend schemas

export type CategoryKind = 'expense' | 'income';

/**
 * CategoryRead - Full category data returned from API
 * Represents an expense or income category with optional parent relationship for hierarchies
 */
export interface CategoryRead {
  id: string; // UUID
  tenant_id: string; // UUID of family/tenant this category belongs to
  name: string; // Category name (e.g., "Groceries", "Salary")
  kind: CategoryKind; // Category type: expense or income
  parent_id: string | null; // UUID of parent category for subcategories, null for top-level
  parent_name: string | null; // Name of parent category, null for top-level
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

/**
 * CategoryCreate - Data required to create a new category
 * Parent relationship is optional - omit parent_id to create top-level category
 */
export interface CategoryCreate {
  name: string; // Required: category name
  kind: CategoryKind; // Required: category type (expense/income)
  parent_id?: string | null; // Optional: parent category ID for creating subcategories
}

/**
 * CategoryUpdate - Partial update data for existing category
 * All fields are optional, only provided fields will be updated
 */
export interface CategoryUpdate {
  name?: string | null;
  kind?: CategoryKind | null;
  parent_id?: string | null;
}
