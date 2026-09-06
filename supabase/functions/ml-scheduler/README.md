# ML Scheduler

## Overview

The ML Scheduler is the orchestrator for the nightly ML batch scoring pipeline. It coordinates the processing of all active outlets and generates alerts for high-risk items.

## Architecture

```
Cron (2 AM) → ml-scheduler → ml-batch-score → ml_scores table
                      ↓
               Alert Generation → alerts table
```

## Features

- **Batch Processing**: Processes all active outlets in batches
- **Score Persistence**: Stores results in `ml_scores` table
- **Alert Generation**: Automatically creates alerts for high-risk items
- **Audit Trail**: Logs all runs to `ml_scheduler_runs` table
- **Idempotent**: Skips recently scored outlets unless forced

## Usage

### API Endpoint

```bash
POST /functions/v1/ml-scheduler
```

**Headers:**
- `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
- `Content-Type: application/json`

**Body (all optional):**
```json
{
  "outlet_ids": [1, 2, 3],  // Process specific outlets only
  "force": false             // Re-score even if recently scored
}
```

### Cron Schedule

The scheduler runs automatically at 2 AM daily (configured in `033_ml_batch_cron.sql`).

## Response

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
  "duration_ms": 15432,
  "message": "Processed 50 outlets, created 5 alerts"
}
```

## Alert Thresholds

| Type | Threshold | Alert Created |
|------|-----------|---------------|
| Anomaly | score >= 0.7 | SALES_ANOMALY |
| Stockout | risk_level = HIGH | STOCKOUT_RISK |

## Related Functions

- `ml-batch-score`: Does the actual scoring work
- `alert-generator`: Creates alert records

## Related Tables

- `ml_scores`: Stores scoring results
- `ml_scheduler_runs`: Audit log
- `alerts`: Generated alerts
