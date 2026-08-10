# Module: Dashboard.tsx

Main KPI dashboard — 598 lines. Renders stat cards, line chart, alert list, live transaction feed, and risk table. Fetches from `dashboard-full` edge function.

## Responsibilities

- Aggregate KPI stats (today revenue, avg variance, stockouts, alerts)
- Render Recharts `LineChart` from `daily_breakdown` (not `chart` key — was a bug)
- Poll `dashboard-full` on mount and every 30s
- Fetch agent orchestration status in parallel
- Role-based header display

## Key Files

- [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx) — main dashboard
- [`src/components/StatCard.tsx`](src/components/StatCard.tsx) — reusable KPI card
- [`src/components/AlertsList.tsx`](src/components/AlertsList.tsx) — alert queue (embedded)
- [`src/components/LiveTransactionFeed.tsx`](src/components/LiveTransactionFeed.tsx) — live feed (embedded)

## Public API

```typescript
// Props
activeRole: Role  // 'HQ_ADMIN' | 'REGIONAL_MANAGER' | 'FRANCHISEE_OWNER' | 'FRANCHISEE_STAFF'
onTabChange?: (tab: string) => void

// Internal state
stats: DashboardStats  // { todayRevenue, monthTotal, avgDaily, openAlerts, grossProfit, marginPercent }
salesData: { time: string; today: number; baseline: number }[]
alerts: Alert[]
outlets: Outlet[]
anomalyData: Record<outletId, { score, percentile, is_anomaly, status }>
```

## Data Fetching

```typescript
// On mount (useEffect)
fetch(`${EDGE_FUNCTIONS_URL}/dashboard-full?period=7d`)  // stats
fetch(`${EDGE_FUNCTIONS_URL}/agent-orchestration`)          // agent status
fetch(`${EDGE_FUNCTIONS_URL}/franchises-list?role=${activeRole}`) // outlets
fetch(`${EDGE_FUNCTIONS_URL}/ml-anomaly-batch`)            // anomaly scores

// Chart: daily_breakdown → { time, today, baseline }
// Bug was: setSalesData(statsData.chart || []) — chart key didn't exist
// Fix: transform daily_breakdown to { time, today, baseline }
```

## Known Bugs Fixed

- `setSalesData(statsData.chart)` — chart was undefined → empty chart
- Fixed: `setSalesData(daily_breakdown.map(d => ({ time: dayLabel, today: d.amount, baseline: d.amount * 0.85 })))`
