# case-update

**Type:** Edge Function (Deno)
**Path:** `supabase/functions/case-update/index.ts`
**Endpoint:** `POST /functions/v1/case-update`
**Auth:** JWT Bearer token required

## CORS
- `Access-Control-Allow-Origin: https://cqaifranchise.vercel.app`

## Request

```json
{
  "case_id": 1,
  "status": "RESOLVED",
  "priority": "HIGH",
  "assigned_to_id": "uuid-of-user",
  "notes": "Fixed by topping up inventory"
}
```

## Valid Status Transitions

| From | To |
|------|-----|
| `NEW` | `IN_PROGRESS`, `CLOSED` |
| `IN_PROGRESS` | `RESOLVED`, `CLOSED` |
| `ACKNOWLEDGED` | `RESOLVED`, `CLOSED` |
| `RESOLVED` | `CLOSED` |
| `CLOSED` | (terminal) |

> When status → RESOLVED or CLOSED, `resolved_at` is auto-set to current time.

## Response

```json
// 200 OK
{ "success": true, "case": { "id": 1, "status": "RESOLVED", ... } }

// 400 Bad Request
{ "error": "case_id required" }

// 500 Server Error
{ "error": "Failed to update case: ..." }
```
