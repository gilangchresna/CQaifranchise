# ML Batch Score

## Overview

ML Batch Score processes all active outlets to calculate anomaly and stockout risk scores. This function is typically called by the `ml-scheduler` orchestrator but can also be called directly.

## Features

- **Anomaly Detection**: Z-score based detection of unusual sales patterns
- **Stockout Prediction**: Inventory-based stockout risk calculation
- **Batch Processing**: Processes outlets in batches for efficiency
- **Score Persistence**: Stores results to `ml_scores` table
- **Deduplication**: Skips outlets scored within the last 12 hours

## Usage

### API Endpoint

```bash
POST /functions/v1/ml-batch-score
```

**Headers:**
- `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
- `Content-Type: application/json`

**Body (all optional):**
```json
{
  "outlet_ids": [1, 2, 3],  // Process specific outlets only
  "date": "2024-01-15",     // Date for scoring (default: today)
  "force": false             // Re-score even if recently scored
}
```

### Response

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
      "anomaly_data_points": 150,
      "stockout_risk": "HIGH",
      "stockout_score": 0.75,
      "days_until_stockout": 2.5,
      "stockout_data_points": 30
    }
  ],
  "summary": {
    "total": 50,
    "anomalies": 3,
    "high_risk": 2,
    "medium_risk": 5,
    "low_risk": 40,
    "errors": 0
  },
  "duration_ms": 12345
}
```

## Scoring Logic

### Anomaly Detection (Z-Score)

```
z_score = (current - avg) / std_dev
confidence = min(1.0, 0.5 + |z_score| / 5)
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

## Database

Results are persisted to `ml_scores` table with:
- `model_type`: 'anomaly' or 'stockout'
- `score`: 0-1 confidence/risk score
- `risk_level`: 'LOW', 'MEDIUM', 'HIGH' (stockout only)
- `is_anomaly`: boolean (anomaly only)
- `data_points`: number of historical records used

## Cron Schedule

Configured to run at 2 AM daily via `ml-scheduler`.

## Related

- `ml-scheduler`: Orchestrator that calls this function
- `ml_scores`: Table where results are stored
