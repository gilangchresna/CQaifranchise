/**
 * Data utilities - removed mock data
 * All data should now come from Supabase via Edge Functions
 */

// Re-export types for convenience
export type { Alert, OutletKPI } from './types';

// Sales data format for charts (can be populated from real API)
export interface SalesDataPoint {
  time: string;
  today: number;
  baseline: number;
}

export const salesData: SalesDataPoint[] = [];
