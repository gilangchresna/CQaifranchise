# sla-escalator

**Type:** Edge Function (Deno)
**Path:** `supabase/functions/sla-escalator/index.ts`
**Endpoint:** `POST /functions/v1/sla-escalator`
**Auth:** None (internal service)
**Cron:** Every 15 minutes (pg_cron registered)

## SLA Thresholds

| Severity | Deadline |
|---------|----------|
| P0_CRITICAL | 4 hours |
| P1_HIGH | 24 hours |
| P2_MEDIUM | 72 hours |
| P3_LOW | 168 hours (1 week) |

## Escalation Chain

```
FRANCHISEE_OWNER → AREA_LEAD → REGIONAL_MANAGER → HQ_ADMIN
OUTLET_STAFF → FRANCHISEE_OWNER → AREA_LEAD → REGIONAL_MANAGER → HQ_ADMIN
REGIONAL_MANAGER → HQ_ADMIN
```

Region-aware: escalates to RM in the same region first.

## Actions

### 1. Warning (50% SLA elapsed)
- Sends SLA_WARNING notification if no warning sent in last 1 hour

### 2. Escalation (100% SLA elapsed)
- Reassigns to next person in escalation chain
- Sends CASE_ASSIGNED notification
- Logs to `sla_escalation_runs` table

## Response

```json
{
  "success": true,
  "checked": 12,
  "warnings_sent": 3,
  "escalated": 1,
  "overdue": 2,
  "errors": [],
  "warnings": [{ "case_id": 5, "elapsed_percent": 75, "remaining_minutes": 120 }],
  "escalations": [{ "case_id": 3, "from_assignee": "John", "to_assignee": "Sarah" }]
}
```

## Cron Registration

```sql
SELECT cron.schedule(
  'sla-escalator',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/sla-escalator',
    headers=>'{"Content-Type": "application/json"}',
    body=>'{}'
  )$$);
```
