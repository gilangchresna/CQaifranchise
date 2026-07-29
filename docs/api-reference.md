# CyberQuote API Reference

**Base URL:** `https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1`

**Auth:** Bearer JWT in Authorization header

---

## Alert Endpoints

### GET /alerts-list
List alerts with filtering and pagination.

**Query Parameters:**
- `status` - NEW, IN_PROGRESS, RESOLVED
- `severity` - P0_CRITICAL, P1_HIGH, P2_MEDIUM, P3_LOW
- `type` - SALES_ANOMALY, STOCKOUT_RISK
- `region_id` - Filter by region
- `outlet_id` - Filter by outlet
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

**Response:**
```json
{
  "data": [{ "id", "type", "severity", "status", "title", "score", "outlet", "region" }],
  "pagination": { "page", "limit", "total_count", "total_pages" }
}
```

---

### POST /alert-generator
Generate a new alert.

**Body:**
```json
{
  "outlet_id": 37,
  "trigger_type": "MANUAL",
  "severity": "P2_MEDIUM",
  "title": "Alert title",
  "description": "Alert description"
}
```

**Response:**
```json
{ "success": true, "alert_id": 27, "alert_type": "SALES_ANOMALY" }
```

---

## ML Endpoints

### POST /ml-anomaly-score
Calculate anomaly score for outlet.

**Body:**
```json
{ "outlet_id": 37, "current_sales": 12000000 }
```

**Response:**
```json
{
  "is_anomaly": false,
  "score": 1.19,
  "threshold": 2.5,
  "percentile": 23,
  "message": "Normal sales pattern"
}
```

---

### POST /ml-stockout-risk
Predict stockout risk for outlet.

**Body:**
```json
{ "outlet_id": 37 }
```

**Response:**
```json
[
  {
    "outlet_id": 37,
    "product_name": "Mie Ayam Original",
    "risk_level": "LOW",
    "risk_score": 0,
    "days_until_stockout": 55,
    "current_stock": 55,
    "avg_daily_usage": 1
  }
]
```

---

## Case Endpoints

### POST /case-create
Create case from alert.

**Body:**
```json
{
  "alert_id": 24,
  "title": "Case title",
  "description": "Case description"
}
```

**Response:**
```json
{
  "success": true,
  "case_id": 13,
  "status": "NEW",
  "sla_deadline": "2026-07-21T04:42:00Z"
}
```

---

### POST /case-update
Update case status.

**Body:**
```json
{
  "case_id": 13,
  "status": "IN_PROGRESS",
  "assignee": "Steve",
  "notes": "Working on this",
  "resolution": "Issue resolved"
}
```

**Valid Status:** NEW, IN_PROGRESS, ASSIGNED, ESCALATED, RESOLVED, REJECTED, CLOSED

**Response:**
```json
{
  "success": true,
  "case_id": 13,
  "status": "RESOLVED"
}
```

---

## Data Endpoints

### GET /franchises-list
List outlets with sales summary.

**Response:**
```json
{
  "franchises": [
    {
      "id": 22,
      "name": "Jakarta Pusat",
      "code": "JKT-PUSAT-001",
      "region": { "id": 1, "name": "Jakarta" },
      "sales_summary": { "total_sales": 5000000, "daily_avg": 250000 },
      "alerts_count": 2
    }
  ],
  "total": 24
}
```

---

### GET /regions-list
List regions with outlet counts.

**Response:**
```json
{
  "regions": [
    { "id": 1, "name": "Jakarta", "code": "JKT", "outlet_count": 5 }
  ],
  "total": 9
}
```

---

### GET /agents-list
List AI agents.

**Response:**
```json
{
  "agents": [
    { "id": 1, "name": "SLA Monitor", "type": "MONITOR", "status": "ACTIVE" }
  ],
  "total": 7
}
```

---

### GET /staff-list
List staff/workforce.

**Response:**
```json
{
  "staff": [
    { "id": 1, "name": "Steve", "role": "Admin", "outlet_id": 37 }
  ],
  "total": 104
}
```

---

### GET /ml-models-list
List ML models.

**Response:**
```json
{
  "models": [
    {
      "id": 3,
      "model_name": "Anomaly Detection",
      "version": "v2.1",
      "model_type": "ANOMALY_DETECTION",
      "metrics": { "accuracy": 0.89 }
    }
  ]
}
```

---

## Notification Endpoints

### POST /notification-send
Send notification.

**Body:**
```json
{
  "alert_id": 24,
  "case_id": 13,
  "channel": "EMAIL",
  "type": "CASE_ASSIGNED",
  "recipient": "steve@cyberquote.id"
}
```

**Response:**
```json
{
  "success": true,
  "channel": "EMAIL",
  "message": "Notification sent"
}
```

---

## Seed Endpoints (Dev)

### POST /seed-sales
Seed sales transactions.

**Response:**
```json
{ "success": true, "records": 720 }
```

---

### POST /seed-inventory
Seed inventory data.

**Response:**
```json
{ "success": true, "seeded": 105 }
```

---

### POST /cron-run
Run ML pipeline.

**Response:**
```json
{
  "timestamp": "2026-07-16T04:36:50Z",
  "jobs": [
    { "name": "ml-anomaly-score", "status": "completed" },
    { "name": "ml-stockout-risk", "status": "completed" },
    { "name": "alert-generator", "status": "completed", "alert_created": 26 }
  ]
}
```

---

## Error Responses

```json
{ "error": "Error message", "code": "ERROR_CODE" }
```

| Code | Description |
|------|-------------|
| UNAUTHORIZED | Invalid or missing JWT |
| NOT_FOUND | Resource not found |
| INVALID_PARAMS | Missing required parameters |
| ALREADY_EXISTS | Resource already exists |
