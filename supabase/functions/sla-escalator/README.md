# SLA Escalator - Edge Function

**Phase:** 2.2  
**Purpose:** Checks for overdue cases and escalates appropriately

## Endpoint

```
POST /functions/v1/sla-escalator
```

## Request Body

```json
{
  "case_ids": [1, 2, 3],      // Optional: specific cases to check
  "warning_threshold": 50,      // Optional: % of SLA elapsed to send warning (default: 50)
  "escalation_threshold": 75   // Optional: % of SLA elapsed to escalate (default: 75)
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `case_ids` | number[] | ❌ | Specific cases to check (default: all open) |
| `warning_threshold` | number | ❌ | % elapsed to trigger warning (default: 50%) |
| `escalation_threshold` | number | ❌ | % elapsed to trigger escalation (default: 75%) |

## Response

```json
{
  "success": true,
  "checked": 45,
  "warnings_sent": 12,
  "escalated": 3,
  "overdue": 1,
  "errors": [],
  "warnings": [
    {
      "case_id": 123,
      "case_title": "Sales Anomaly at Outlet X",
      "assignee_id": "user-uuid",
      "assignee_name": "John Doe",
      "sla_deadline": "2026-07-14T18:00:00Z",
      "elapsed_percent": 75,
      "remaining_minutes": 60
    }
  ],
  "escalations": [
    {
      "case_id": 456,
      "case_title": "Stockout Risk Alert",
      "from_assignee_id": "user-uuid-1",
      "from_assignee_name": "Regional Manager A",
      "to_assignee_id": "user-uuid-2",
      "to_assignee_name": "HQ Admin",
      "escalation_rule": "escalate_REGIONAL_MANAGER_to_HQ_ADMIN",
      "elapsed_percent": 100
    }
  ]
}
```

## Escalation Thresholds

| Level | Trigger | Action |
|-------|---------|--------|
| Warning | 50% of SLA elapsed | Reminder to assignee |
| Escalation | 75% of SLA elapsed | Notify manager |
| Overdue | 100% SLA elapsed | Escalate to next level |

## Escalation Chain

```
FRANCHISEE_OWNER → AREA_LEAD → REGIONAL_MANAGER → HQ_ADMIN
OUTLET_STAFF → FRANCHISEE_OWNER → AREA_LEAD → REGIONAL_MANAGER → HQ_ADMIN
```

## Logic Flow

```
1. Get all open cases with SLA deadlines
2. For each case:
   a. Calculate % of SLA time elapsed
   b. If >= 100%: OVERDUE
      - Find escalation target
      - Reassign to escalation target
      - Notify new assignee
      - Send SLA warning
   c. If >= warning_threshold (50%) and no recent warning:
      - Send warning to assignee
3. Log escalation run
4. Return summary
```

## Cron Configuration

**Schedule:** Every 15 minutes

### Option 1: Supabase Cron

```sql
SELECT cron.schedule(
  'sla-escalator',
  '0,15,30,45 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/sla-escalator',
    headers := '{"Authorization": "Bearer <service_role_jwt>"}'::jsonb
  );
  $$
);
```

### Option 2: External Cron

```bash
# Every 15 minutes (0, 15, 30, 45 of each hour)
0,15,30,45 * * * * curl -X POST https://your-project.supabase.co/functions/v1/sla-escalator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Dependencies

- `cases` table - For case details
- `alerts` table - For alert severity
- `user_profiles` table - For assignee info
- `notification_logs` table - To avoid duplicate warnings
- `notification-trigger` (Phase 1.3) - For sending notifications

## Acceptance Criteria

- [x] Checks all open cases with SLA deadlines
- [x] Sends warning when 50% of SLA elapsed
- [x] Escalates to next level when 75% elapsed
- [x] Handles overdue cases (100%+)
- [x] Follows escalation chain
- [x] Avoids duplicate warnings (once per hour)
- [x] Logs escalation runs

## Usage Examples

### Run full check
```bash
curl -X POST https://your-project.supabase.co/functions/v1/sla-escalator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Check specific cases
```bash
curl -X POST https://your-project.supabase.co/functions/v1/sla-escalator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"case_ids": [123, 456, 789]}'
```

### Custom thresholds
```bash
curl -X POST https://your-project.supabase.co/functions/v1/sla-escalator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"warning_threshold": 25, "escalation_threshold": 50}'
```

## Audit Table (Optional)

```sql
CREATE TABLE sla_escalation_runs (
  id SERIAL PRIMARY KEY,
  cases_checked INT,
  warnings_sent INT,
  cases_escalated INT,
  cases_overdue INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
