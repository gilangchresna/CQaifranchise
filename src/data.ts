import { Alert, OutletKPI } from './types';

export const mockAlerts: Alert[] = [
  {
    id: 'ALT-1001',
    outletId: 'Outlet 104 (Jakarta)',
    type: 'anomaly',
    severity: 'high',
    message: 'Lunchtime sales down 18% compared to historical average.',
    timestamp: '10 mins ago',
    status: 'open',
    aiRecommendation: 'Investigate campaign setup and staffing levels. Recommended: Trigger emergency promotion and transfer 2 staff from Outlet 102.'
  },
  {
    id: 'ALT-1002',
    outletId: 'Outlet 089 (Surabaya)',
    type: 'stockout',
    severity: 'high',
    message: 'Stock for top 2 menu items critically low. Estimated depletion in 4 hours.',
    timestamp: '25 mins ago',
    status: 'in-progress',
    aiRecommendation: 'Initiate emergency stock transfer from Regional Hub A.'
  },
  {
    id: 'ALT-1003',
    outletId: 'Outlet 210 (Bali)',
    type: 'staffing',
    severity: 'medium',
    message: '2 key kitchen staff absent. Service delays expected.',
    timestamp: '1 hr ago',
    status: 'open',
    aiRecommendation: 'Adjust service SLA expectations on delivery apps to manage customer ratings. Consider pausing online orders.'
  }
];

export const mockOutlets: OutletKPI[] = [
  { id: '104', name: 'Outlet 104 (Jakarta)', sales: 12450, salesTrend: -18, stockoutRisk: 45, staffingStatus: 'short', complaints: 3 },
  { id: '089', name: 'Outlet 089 (Surabaya)', sales: 28900, salesTrend: 5, stockoutRisk: 92, staffingStatus: 'optimal', complaints: 0 },
  { id: '210', name: 'Outlet 210 (Bali)', sales: 19200, salesTrend: -2, stockoutRisk: 15, staffingStatus: 'critical', complaints: 5 },
  { id: '001', name: 'Outlet 001 (HQ Flagship)', sales: 45000, salesTrend: 12, stockoutRisk: 5, staffingStatus: 'optimal', complaints: 1 },
];

export const salesData = [
  { time: '08:00', today: 120, baseline: 110 },
  { time: '10:00', today: 250, baseline: 230 },
  { time: '12:00', today: 380, baseline: 450 },
  { time: '14:00', today: 290, baseline: 310 },
  { time: '16:00', today: 210, baseline: 220 },
  { time: '18:00', today: 340, baseline: 330 },
];
