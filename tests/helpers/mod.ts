/**
 * Test helpers and mock utilities for CyberQuote Edge Function tests
 */

// Mock Supabase client for testing
export function createMockSupabaseClient(overrides: any = {}) {
  return {
    from: (table: string) => createMockQueryBuilder(table, overrides),
  };
}

function createMockQueryBuilder(table: string, overrides: any) {
  const mockData = overrides[table] || [];
  
  return {
    select: (columns?: string) => mockQueryBuilder('select', table, columns, mockData, overrides),
    insert: (data: any) => mockQueryBuilder('insert', table, undefined, data, overrides),
    update: (data: any) => mockQueryBuilder('update', table, undefined, data, overrides),
    eq: (column: string, value: any) => mockQueryBuilder('eq', table, undefined, { column, value }, overrides),
    order: (column: string, options: any) => mockQueryBuilder('order', table, undefined, { column, ...options }, overrides),
    limit: (n: number) => mockQueryBuilder('limit', table, undefined, n, overrides),
    gte: (column: string, value: any) => mockQueryBuilder('gte', table, undefined, { column, value }, overrides),
    single: () => mockQueryBuilder('single', table, undefined, undefined, overrides),
  };
}

function mockQueryBuilder(method: string, table: string, arg: any, extra: any, overrides: any) {
  const mockData = overrides[table] || [];
  
  // Return synchronous result for select queries
  if (method === 'select') {
    let result = mockData;
    
    // Simulate eq filter
    if (extra?.column && extra?.value !== undefined) {
      result = mockData.filter((row: any) => row[extra.column] === extra.value);
    }
    
    // Simulate gte filter
    if (mockQueryBuilder.gteColumn && mockQueryBuilder.gteValue) {
      result = result.filter((row: any) => row[mockQueryBuilder.gteColumn] >= mockQueryBuilder.gteValue);
    }
    
    return {
      select: () => mockQueryBuilder('select', table, arg, extra, overrides),
      eq: (col: string, val: any) => mockQueryBuilder('eq', table, arg, { column: col, value: val }, overrides),
      gte: (col: string, val: any) => {
        mockQueryBuilder.gteColumn = col;
        mockQueryBuilder.gteValue = val;
        return mockQueryBuilder('select', table, arg, extra, overrides);
      },
      order: (col: string, opts: any) => mockQueryBuilder('order', table, arg, { column: col, ...opts }, overrides),
      limit: (n: number) => mockQueryBuilder('limit', table, arg, n, overrides),
      single: () => {
        return result.length > 0 ? { data: result[0], error: null } : { data: null, error: { message: 'No rows found' } };
      },
      then: (resolve: any, reject: any) => {
        resolve({ data: result, error: null });
      },
    };
  }
  
  // For insert/update
  if (method === 'insert' || method === 'update') {
    return {
      select: () => ({
        single: () => {
          const newRecord = { id: Math.floor(Math.random() * 10000), ...extra };
          return { data: newRecord, error: null };
        },
      }),
      then: (resolve: any, reject: any) => {
        resolve({ data: { id: Math.floor(Math.random() * 10000) }, error: null });
      },
    };
  }
  
  return {
    then: (resolve: any, reject: any) => {
      resolve({ data: mockData, error: null });
    },
  };
}

// Reset mock state
export function resetMockState() {
  (mockQueryBuilder as any).gteColumn = null;
  (mockQueryBuilder as any).gteValue = null;
}

// Test data factories
export const mockSalesData = {
  amounts: [100, 120, 90, 110, 105, 95, 115, 108, 102, 98],
  transactions: [
    { id: 1, outlet_id: 1, amount: '100.00', hour: 10, day_of_week: 1, created_at: '2026-07-01T10:00:00Z' },
    { id: 2, outlet_id: 1, amount: '120.00', hour: 10, day_of_week: 1, created_at: '2026-07-02T10:00:00Z' },
    { id: 3, outlet_id: 1, amount: '90.00', hour: 10, day_of_week: 1, created_at: '2026-07-03T10:00:00Z' },
    { id: 4, outlet_id: 1, amount: '110.00', hour: 10, day_of_week: 1, created_at: '2026-07-04T10:00:00Z' },
    { id: 5, outlet_id: 1, amount: '105.00', hour: 10, day_of_week: 1, created_at: '2026-07-05T10:00:00Z' },
  ],
};

export const mockInventoryData = [
  { id: 1, outlet_id: 1, sku: 'SKU001', product_name: 'Product A', current_stock: 50, min_stock: 20, max_stock: 100 },
  { id: 2, outlet_id: 1, sku: 'SKU002', product_name: 'Product B', current_stock: 15, min_stock: 25, max_stock: 80 },
  { id: 3, outlet_id: 1, sku: 'SKU003', product_name: 'Product C', current_stock: 200, min_stock: 50, max_stock: 300 },
];

export const mockOutlets = [
  { id: 1, name: 'Test Outlet 1', code: 'TO1', status: 'ACTIVE', regions: { name: 'Region A', code: 'RA' } },
  { id: 2, name: 'Test Outlet 2', code: 'TO2', status: 'PILOT', regions: { name: 'Region B', code: 'RB' } },
  { id: 3, name: 'Inactive Outlet', code: 'IO1', status: 'INACTIVE', regions: { name: 'Region C', code: 'RC' } },
];

export const mockAlerts = [
  { id: 1, outlet_id: 1, type: 'SALES_ANOMALY', severity: 'P1_HIGH', status: 'NEW', title: 'Alert 1', description: 'Test alert', score: 0.8, triggered_at: new Date().toISOString() },
  { id: 2, outlet_id: 1, type: 'STOCKOUT_RISK', severity: 'P0_CRITICAL', status: 'IN_PROGRESS', title: 'Alert 2', description: 'Test alert 2', score: 0.95, triggered_at: new Date().toISOString() },
];

export const mockCases = [
  { id: 1, alert_id: 1, title: 'Case 1', status: 'NEW', priority: 'HIGH', assigned_to_id: 1, sla_deadline: '2026-07-20T00:00:00Z', created_at: '2026-07-16T00:00:00Z' },
];

export const mockUserProfiles = [
  { id: 1, full_name: 'Test User', role: 'admin' },
  { id: 2, full_name: 'Another User', role: 'analyst' },
];

// Assertion helpers
export function assertEquals(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

export function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Expected true but got false');
  }
}

export function assertFalse(condition: boolean, message?: string) {
  if (condition) {
    throw new Error(message || 'Expected false but got true');
  }
}

export function assertThrows(fn: () => void, message?: string) {
  try {
    fn();
    throw new Error(message || 'Expected function to throw but it did not');
  } catch (error) {
    if (error.message === (message || 'Expected function to throw but it did not')) {
      throw error;
    }
    // Expected - function threw
  }
}

export function assertArrayEquals(actual: any[], expected: any[], message?: string) {
  if (actual.length !== expected.length) {
    throw new Error(message || `Array length mismatch: expected ${expected.length} but got ${actual.length}`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(message || `Array mismatch at index ${i}: expected ${expected[i]} but got ${actual[i]}`);
    }
  }
}

export function assertObjectEquals(actual: any, expected: any, message?: string) {
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  
  if (actualKeys.length !== expectedKeys.length) {
    throw new Error(message || `Object key count mismatch`);
  }
  
  for (const key of expectedKeys) {
    if (!(key in actual)) {
      throw new Error(message || `Missing key in actual object: ${key}`);
    }
    if (actual[key] !== expected[key]) {
      throw new Error(message || `Value mismatch for key "${key}": expected ${expected[key]} but got ${actual[key]}`);
    }
  }
}
