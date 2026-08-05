# ML Batch Scoring Pipeline

## Overview

The ML batch scoring pipeline runs nightly to analyze all active outlets for:
1. **Sales Anomaly Detection** - Identifying unusual sales patterns
2. **Stockout Risk Prediction** - Predicting inventory stockout risks

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Nightly Cron Job (2 AM)                      │
│                    pg_cron → ml-scheduler                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ml-scheduler                                │
│                   (Orchestrator Function)                        │
│  • Creates scheduler run record                                  │
│  • Calls ml-batch-score for all outlets                          │
│  • Generates alerts for high-risk items                          │
│  • Logs completion to ml_scheduler_runs                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ml-batch-score                             │
│                    (Batch Processing Function)                    │
│  • Processes all active outlets in batches                       │
│  • Calculates anomaly scores (z-score based)                     │
│  • Calculates stockout risk (inventory/sales ratio)              │
│  • Persists results to ml_scores table                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ml_scores                                 │
│                    (Results Table)                              │
│  • Stores anomaly and stockout scores                            │
│  • Maintains score history for 90 days                          │
│  • Powers dashboard queries                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Cron Schedule

| Job | Schedule | Description |
|-----|----------|-------------|
| `ml-scheduler-nightly` | `0 2 * * *` (2 AM daily) | Main orchestrator - runs full batch |
| `alert-cleanup` | `0 3 * * *` (3 AM daily) | Removes resolved alerts older than 30 days |
| `ml-scores-cleanup` | `0 4 * * 0` (4 AM Sundays) | Removes scores older than 90 days |

## API Endpoints

### POST /functions/v1/ml-scheduler

Main orchestrator endpoint called by cron job.

**Request Body:**
```json
{
  "outlet_ids": [1, 2, 3],  // Optional: process specific outlets
  "force": false            // Optional: re-score even if recent
}
```

**Response:**
```json
{
  "success": true,
  "batch_result": {
    "processed": 50,
    "summary": {
      "total": 50,
      "anomalies": 3,
      "high_risk": 2,
      "medium_risk": 5,
      "low_risk": 40,
      "errors": 0
    }
  },
  "alerts_created": 5,
  "run_id": 123,
  "duration_ms": 15432
}
```

### POST /functions/v1/ml-batch-score

Direct batch scoring endpoint (usually called by scheduler).

**Request Body:**
```json
{
  "outlet_ids": [1, 2, 3],  // Optional: process specific outlets
  "date": "2024-01-15",     // Optional: scoring date
  "force": false            // Optional: re-score even if recent
}
```

**Response:**
```json
{
  "success": true,
  "processed": 50,
  "results": [
    {
      "outlet_id": 1,
      "outlet_name": "Outlet Jakarta-01",
      "anomaly_score": 0.85,
      "is_anomaly": true,
      "stockout_risk": "HIGH",
      "days_until_stockout": 2.5
    }
  ],
  "summary": { ... },
  "duration_ms": 12345
}
```

## Database Tables

### ml_scores
Stores ML model scoring results.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| outlet_id | INTEGER | FK to outlets |
| model_type | VARCHAR(50) | 'anomaly' or 'stockout' |
| score | DECIMAL(5,4) | 0-1 confidence score |
| risk_level | VARCHAR(20) | 'LOW', 'MEDIUM', 'HIGH' (stockout) |
| is_anomaly | BOOLEAN | True if anomaly detected |
| days_until_stockout | DECIMAL(10,2) | Days until stockout (stockout) |
| avg | DECIMAL(15,2) | Historical average (anomaly) |
| std_dev | DECIMAL(15,2) | Standard deviation (anomaly) |
| data_points | INTEGER | Number of data points used |
| scored_at | TIMESTAMPTZ | When scored |

### ml_scheduler_runs
Audit log for batch processing.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| outlets_processed | INTEGER | Number of outlets processed |
| anomalies_detected | INTEGER | Count of anomalies |
| stockouts_detected | INTEGER | Count of high-risk stockouts |
| alerts_created | INTEGER | Alerts generated |
| duration_ms | INTEGER | Execution time |
| status | VARCHAR(50) | 'running', 'completed', 'failed' |
| scheduled_at | TIMESTAMPTZ | Scheduled run time |
| started_at | TIMESTAMPTZ | Actual start time |
| completed_at | TIMESTAMPTZ | Actual completion time |

## Views

### outlet_ml_summary
Combined view for dashboard display.

```sql
SELECT * FROM public.outlet_ml_summary 
WHERE needs_attention = true
ORDER BY anomaly_score DESC;
```

### get_outlets_needing_attention()
Function returning outlets with high-risk issues.

```sql
SELECT * FROM public.get_outlets_needing_attention();
```

## Scoring Logic

### Anomaly Detection (Z-Score)
```
z_score = (current_value - avg) / std_dev
anomaly_score = min(1.0, 0.5 + |z_score| / 5)
is_anomaly = |z_score| > 2.5
```

### Stockout Risk
```
days_until_stockout = current_stock / avg_daily_usage
risk_score = 1 - (days_until_stockout / 10)
risk_level:
  - HIGH: days < 3
  - MEDIUM: 3 <= days < 7
  - LOW: days >= 7
```

## Alert Thresholds

| Condition | Threshold | Alert Type |
|-----------|-----------|------------|
| Anomaly | score >= 0.7 | SALES_ANOMALY |
| Stockout HIGH | days_until_stockout < 3 | STOCKOUT_RISK |

## Maintenance

### Manual Trigger
```bash
# Via curl
curl -X POST https://your-project.supabase.co/functions/v1/ml-scheduler \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### Check Scheduler Status
```sql
SELECT * FROM public.ml_scheduler_runs 
ORDER BY scheduled_at DESC LIMIT 5;
```

### View Latest Scores
```sql
SELECT * FROM public.outlet_ml_summary;
```

### Disable Cron Job
```sql
SELECT cron.unschedule('ml-scheduler-nightly');
```
