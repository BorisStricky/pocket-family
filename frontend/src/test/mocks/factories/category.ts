// src/test/mocks/factories/category.ts
// Factory functions for creating mock Category objects in tests

export type CategoryKind = 'expense' | 'income';

/**
 * Category Read type matching backend CategoryRead schema
 */
export interface CategoryRead {
  id: string;
  tenant_id: string;
  name: string;
  kind: CategoryKind;
  parent_id: string | null;
  parent_name: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Category Create type matching backend CategoryCreate schema
 */
export interface CategoryCreate {
  name: string;
  kind: CategoryKind;
  parent_id?: string | null;
}

/**
 * Category Update type matching backend CategoryUpdate schema
 */
export interface CategoryUpdate {
  name?: string | null;
  kind?: CategoryKind | null;
  parent_id?: string | null;
}

/**
 * Options for creating mock category objects
 */
interface CreateMockCategoryOptions {
  id?: string;
  tenant_id?: string;
  name?: string;
  kind?: CategoryKind;
  parent_id?: string | null;
  parent_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Create a mock CategoryRead object with customizable properties
 * Matches the CategoryRead interface from backend schemas
 *
 * @example
 * const category = createMockCategory({ name: 'Groceries', kind: 'expense' });
 * const childCategory = createMockCategory({ parent_id: 'parent-uuid-123', parent_name: 'Food' });
 */
export function createMockCategory(options: CreateMockCategoryOptions = {}): CategoryRead {
  const {
    id = 'category-uuid-123',
    tenant_id = 'tenant-uuid-456',
    name = 'Test Category',
    kind = 'expense',
    parent_id = null,
    parent_name = null,
    created_at = new Date().toISOString(),
    updated_at = new Date().toISOString(),
  } = options;

  return {
    id,
    tenant_id,
    name,
    kind,
    parent_id,
    parent_name,
    created_at,
    updated_at,
  };
}

/**
 * Create a mock expense category
 */
export function createMockExpenseCategory(options: CreateMockCategoryOptions = {}): CategoryRead {
  return createMockCategory({
    name: 'Expense Category',
    kind: 'expense',
    ...options,
  });
}

/**
 * Create a mock income category
 */
export function createMockIncomeCategory(options: CreateMockCategoryOptions = {}): CategoryRead {
  return createMockCategory({
    name: 'Income Category',
    kind: 'income',
    ...options,
  });
}

/**
 * Create a mock child category with parent relationship
 */
export function createMockChildCategory(
  parentId: string,
  parentName: string,
  options: CreateMockCategoryOptions = {}
): CategoryRead {
  return createMockCategory({
    name: 'Subcategory',
    parent_id: parentId,
    parent_name: parentName,
    ...options,
  });
}

/**
 * Create a list of mock categories for testing list views
 * Returns a mix of parent and child categories
 *
 * @example
 * const categories = createMockCategoryList(5);
 * const tenantCategories = createMockCategoryList(3, 'tenant-uuid-456');
 */
export function createMockCategoryList(
  count: number = 3,
  tenantId: string = 'tenant-uuid-456'
): CategoryRead[] {
  const kinds: CategoryKind[] = ['expense', 'income'];
  const categories: CategoryRead[] = [];

  // Create parent categories
  const parentCount = Math.ceil(count / 2);
  for (let index = 0; index < parentCount; index++) {
    const kind = kinds[index % kinds.length];
    categories.push(
      createMockCategory({
        id: `category-uuid-${index + 1}`,
        tenant_id: tenantId,
        name: `${kind === 'expense' ? 'Expense' : 'Income'} Category ${index + 1}`,
        kind,
        parent_id: null,
        parent_name: null,
      })
    );
  }

  // Create child categories for remaining count
  const childCount = count - parentCount;
  for (let index = 0; index < childCount; index++) {
    const parentIndex = index % parentCount;
    const parent = categories[parentIndex];
    categories.push(
      createMockCategory({
        id: `category-uuid-child-${index + 1}`,
        tenant_id: tenantId,
        name: `Subcategory ${index + 1}`,
        kind: parent.kind,
        parent_id: parent.id,
        parent_name: parent.name,
      })
    );
  }

  return categories;
}

/**
 * Create a hierarchical category tree for testing nested structures
 * Returns an array with parent and child categories
 *
 * @example
 * const tree = createMockCategoryTree(); // Creates "Food" parent with "Groceries" and "Restaurants" children
 */
export function createMockCategoryTree(): CategoryRead[] {
  const foodParent = createMockCategory({
    id: 'category-uuid-food',
    name: 'Food',
    kind: 'expense',
    parent_id: null,
    parent_name: null,
  });

  const groceriesChild = createMockCategory({
    id: 'category-uuid-groceries',
    name: 'Groceries',
    kind: 'expense',
    parent_id: foodParent.id,
    parent_name: foodParent.name,
  });

  const restaurantsChild = createMockCategory({
    id: 'category-uuid-restaurants',
    name: 'Restaurants',
    kind: 'expense',
    parent_id: foodParent.id,
    parent_name: foodParent.name,
  });

  const salaryParent = createMockCategory({
    id: 'category-uuid-salary',
    name: 'Salary',
    kind: 'income',
    parent_id: null,
    parent_name: null,
  });

  return [foodParent, groceriesChild, restaurantsChild, salaryParent];
}
