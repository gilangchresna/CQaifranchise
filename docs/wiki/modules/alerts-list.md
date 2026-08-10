# alerts-list

**Type:** Edge Function (Deno)
**Path:** `supabase/functions/alerts-list/index.ts`
**Endpoint:** `GET /functions/v1/alerts-list`
**Auth:** JWT Bearer token required

## CORS
- `Access-Control-Allow-Origin: https://cqaifranchise.vercel.app`

## Query Parameters

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | string | — | Filter by status (NEW/ACKNOWLEDGED/RESOLVED/CLOSED) |
| `severity` | string | — | P0_CRITICAL/P1_HIGH/P2_MEDIUM/P3_LOW |
| `outlet_id` | number | — | Filter by outlet |
| `limit` | number | 100 | Max 200 |

## Response

```json
{
  "data": [
    {
      "id": 126,
      "type": "LOW_STOCK",
      "severity": "P1_HIGH",
      "status": "NEW",
      "title": "Low Stock — KOPI-001 (Espresso Beans)",
      "description": "Outlet SG-01: Espresso beans stock at 8 units, below minimum.",
      "triggered_at": "2026-08-11T10:00:00Z",
      "outlet": {
        "name": "SG-01",
        "code": "SG-01",
        "region": { "name": "Singapore", "code": "SG" }
      }
    }
  ],
  "total": 30
}
```

## Role-Based Filtering (C9)

| Role | Scope |
|------|-------|
| HQ_ADMIN | All non-RESOLVED alerts |
| REGIONAL_MANAGER | Alerts from their region |
| FRANCHISEE_OWNER / STAFF | Alerts from their assigned outlets |

## Status Values

| Status | Meaning |
|--------|--------|
| `NEW` | Just triggered, requires action |
| `ACKNOWLEDGED` | Seen but not resolved |
| `RESOLVED` | Fixed and closed |
| `CLOSED` | Archived |

## Severity Levels

| Severity | SLA |
|---------|-----|
| `P0_CRITICAL` | 4 hours |
| `P1_HIGH` | 24 hours |
| `P2_MEDIUM` | 72 hours |
| `P3_LOW` | 168 hours (1 week) |
