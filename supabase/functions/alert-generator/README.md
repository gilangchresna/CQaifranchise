# Alert Generator - Edge Function

**Phase:** 1.1  
**Purpose:** Automatically create alerts when ML scoring detects anomalies or stockout risks

## Endpoint

```
POST /functions/v1/alert-generator
```

## Request Body

```json
{
  "outlet_id": 1,
  "trigger_type": "ANOMALY" | "STOCKOUT" | "MANUAL",
  "threshold_override": 0.7,
  "current_sales": 15000,
  "sku": "SKU-001"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `outlet_id` | number | ✅ | Outlet to generate alert for |
| `trigger_type` | string | ✅ | Type: `ANOMALY`, `STOCKOUT`, or `MANUAL` |
| `threshold_override` | number | ❌ | Override default threshold (default: 0.5) |
| `current_sales` | number | ❌ | Current sales amount (for anomaly detection) |
| `sku` | string | ❌ | SKU for stockout check |

## Response

**Success (201):**
```json
{
  "success": true,
  "alert_id": 123,
  "alert_type": "SALES_ANOMALY",
  "severity": "P1_HIGH",
  "score": 0.85,
  "message": "Alert created successfully"
}
```

**Below Threshold (200):**
```json
{
  "success": false,
  "reason": "below_threshold",
  "message": "Score 20% is below threshold 50%",
  "score": 0.2
}
```

**Duplicate Alert (200):**
```json
{
  "success": false,
  "reason": "duplicate",
  "message": "A similar alert was already created for this outlet in the last hour",
  "existing_alert_id": 45
}
```

## Severity Mapping

| Score Range | Severity | SLA |
|-------------|----------|-----|
| 0.9 - 1.0 | P0_CRITICAL | 1 hour |
| 0.7 - 0.89 | P1_HIGH | 4 hours |
| 0.5 - 0.69 | P2_MEDIUM | 24 hours |
| 0.3 - 0.49 | P3_LOW | 72 hours |
| < 0.3 | Skip | - |

## Logic Flow

```
1. Validate request (outlet_id, trigger_type)
2. Fetch outlet info (name, region, status)
3. Skip inactive outlets
4. Call ML service based on trigger_type:
   - ANOMALY → ml-anomaly-score
   - STOCKOUT → ml-stockout-risk
   - MANUAL → use threshold as score
5. Check if score >= threshold
6. Check for duplicate (same outlet/type in last hour)
7. Determine severity
8. Generate title and description
9. Insert into alerts table
10. Return alert_id
```

## Dependencies

- `ml-anomaly-score` - For sales anomaly detection
- `ml-stockout-risk` - For inventory stockout prediction
- `outlets` table - For outlet information
- `alerts` table - For inserting new alerts

## Acceptance Criteria

- [x] Function deploys successfully
- [x] Returns alert_id when score >= threshold
- [x] Returns success:false when score < threshold
- [x] Alert appears in alerts-list
- [x] Alert has correct severity based on score
- [x] Prevents duplicate alerts within 1 hour

## Usage Examples

### Generate Anomaly Alert
```bash
curl -X POST https://your-project.supabase.co/functions/v1/alert-generator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "outlet_id": 1,
    "trigger_type": "ANOMALY",
    "current_sales": 15000
  }'
```

### Generate Stockout Alert
```bash
curl -X POST https://your-project.supabase.co/functions/v1/alert-generator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "outlet_id": 1,
    "trigger_type": "STOCKOUT",
    "sku": "SKU-001"
  }'
```

### Manual Trigger with Custom Threshold
```bash
curl -X POST https://your-project.supabase.co/functions/v1/alert-generator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "outlet_id": 1,
    "trigger_type": "MANUAL",
    "threshold_override": 0.8
  }'
```
