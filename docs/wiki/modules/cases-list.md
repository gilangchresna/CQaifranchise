# cases-list

**Type:** Edge Function (Deno)
**Path:** `supabase/functions/cases-list/index.ts`
**Endpoint:** `GET /functions/v1/cases-list`
**Auth:** JWT Bearer token required

## CORS
- `Access-Control-Allow-Origin: https://cqaifranchise.vercel.app`

## Query Parameters

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | string | — | NEW/IN_PROGRESS/RESOLVED/CLOSED |
| `priority` | string | — | URGENT/HIGH/MEDIUM/LOW |
| `assignee_id` | string (UUID) | — | Filter by assigned user |
| `outlet_id` | number | — | Filter by Outlet |
| `limit` | number | 50 | Max 200 |

## Response

```json
{
  "data": [
    {
      "id": 1,
      "title": "Action Required: Low Stock — KOPI-001",
      "description": "Outlet SG-01: Espresso beans stock at 8 units.",
      "type": "LOW_STOCK",
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "created_at": "2026-08-11T09:00:00Z",
      "sla_deadline": "2026-08-12T09:00:00Z",
      "resolved_at": null,
      "assignee": { "id": "...", "full_name": "John Tan", "role": "FRANCHISEE_OWNER" },
      "outlet": { "id": 164, "name": "SG-01", "code": "SG-01" },
      "alert": { "id": 126, "type": "LOW_STOCK", "severity": "P1_HIGH" }
    }
  ],
  "total": 15,
  "counts": { "NEW": 3, "IN_PROGRESS": 8, "RESOLVED": 4, "CLOSED": 0 }
}
```

## Role-Based Filtering (C9)

| Role | Scope |
|------|-------|
| HQ_ADMIN | All cases |
| REGIONAL_MANAGER | Cases from their region |
| FRANCHISEE_OWNER / STAFF | Cases from their assigned outlets |

## Case → Alert Link
Cases are created from alerts via `case-create` edge function. Each case has `source_alert_id` linking back to the originating alert.
