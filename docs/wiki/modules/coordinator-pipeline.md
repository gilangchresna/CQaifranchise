# coordinator-pipeline

**Type:** Edge Function (Deno)
**Path:** `supabase/functions/coordinator-pipeline/index.ts`
**Endpoint:** `POST /functions/v1/coordinator-pipeline`
**Auth:** None (internal service role)
**Cron:** Every 15 minutes (pg_cron registered)

## Pipeline Steps

### Step 1 — Anomaly Detection
- Fetches 30-day sales per outlet
- Computes Z-score: `(today - mean) / std`
- Classifies: CRITICAL (z ≥ 2.5), WARNING (z ≥ 1.5), OK
- Writes to `ml_anomaly_scores` table

### Step 2 — Stockout Risk
- Checks inventory where `current_stock < 25`
- Computes `days_remaining = current_stock / (avg_txn_per_day)`
- Classifies: HIGH (< 7 days), MEDIUM (< 14 days), LOW
- Writes to `ml_stockout_risks` table

### Step 3 — Alert Creation
- Creates NEW alerts for outlets with CRITICAL anomaly in last 1 hour
- Deduplicates: only if no existing NEW alert for same outlet + type
- Alert types: SALES_ANOMALY, LOW_STOCK, HIGH_VALUE, RAPID_SUCCESSION

### Step 4 — Agent Task Log
- Inserts record to `agent_tasks` table for observability

## Response

```json
{
  "success": true,
  "timestamp": "2026-08-11T10:15:00Z",
  "pipeline": {
    "anomaly": { "critical": 2, "warning": 5, "ok": 13 },
    "stockout": { "high": 3, "medium": 7, "checked": 20 },
    "alerts": { "created": 1 }
  }
}
```

## Configuration

| Setting | Value |
|---------|-------|
| Anomaly Z-score threshold | 2.5 (CRITICAL), 1.5 (WARNING) |
| Stockout threshold | < 25 units |
| Alert deduplication window | 1 hour |
| FX rates | SGD=1, IDR=1/12500, THB=1/27.5, MYR=1/3.4 |

## Cron Registration

```sql
SELECT cron.schedule(
  'coordinator-pipeline',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/coordinator-pipeline',
    headers=>'{"Content-Type": "application/json"}',
    body=>'{}'
  )$$);
```
