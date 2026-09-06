// Frontend Role type (UI display)
export type Role = 'HQ' | 'Regional' | 'Franchisee';

// Database Role type (matches Supabase enum)
export type DBRole = 'HQ_ADMIN' | 'REGIONAL_MANAGER' | 'FRANCHISEE_OWNER' | 'FRANCHISEE_STAFF';

// Mapping from frontend Role to DB role
export const roleToDB: Record<Role, DBRole> = {
  'HQ': 'HQ_ADMIN',
  'Regional': 'REGIONAL_MANAGER',
  'Franchisee': 'FRANCHISEE_OWNER',
};

// Mapping from DB role to frontend Role
export const dbToRole: Record<DBRole, Role> = {
  'HQ_ADMIN': 'HQ',
  'REGIONAL_MANAGER': 'Regional',
  'FRANCHISEE_OWNER': 'Franchisee',
  'FRANCHISEE_STAFF': 'Franchisee',
};

export interface Alert {
  id: string;
  outletId: string;
  type: 'anomaly' | 'stockout' | 'complaint' | 'staffing';
  severity: 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
  status: 'open' | 'in-progress' | 'resolved';
  aiRecommendation?: string;
}

export interface OutletKPI {
  id: string;
  name: string;
  sales: number;
  salesTrend: number;
  stockoutRisk: number;
  staffingStatus: 'optimal' | 'short' | 'critical';
  complaints: number;
}
