# CyberQuote MVP - Observability & Monitoring

## Overview

This document describes the monitoring and observability setup for CyberQuote MVP, including health checks, dashboard views, alerting thresholds, and metrics tracking.

---

## Quick Reference

### Health Check Endpoint

```bash
# Check system health
curl -s "https://<project>.supabase.co/functions/v1/health-check" \
  -H "Authorization: Bearer <service_role_key>" | jq '.'
```

**Response Structure:**
```json
{
  "overall": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-07-17T08:30:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "healthy", "latency_ms": 45 },
    "ml_anomaly_function": { "status": "healthy", "latency_ms": 120 },
    "ml_stockout_function": { "status": "healthy", "latency_ms": 89 },
    "alert_generation": { "status": "healthy", "latency_ms": 34 },
    "notifications": { "status": "healthy", "latency_ms": 56 }
  },
  "metrics": {
    "active_alerts": 23,
    "cases_pending": 8,
    "outlets_total": 50,
    "outlets_active": 48,
    "ml_models_loaded": 100,
    "recent_errors_1h": 0
  }
}
```

---

## Dashboard Views

### 1. Active Alerts by Severity

**View:** `public.v_active_alerts_by_severity`

```sql
SELECT * FROM public.v_active_alerts_by_severity;
```

| Column | Type | Description |
|--------|------|-------------|
| severity | alert_severity | P0_CRITICAL, P1_HIGH, P2_MEDIUM, P3_LOW |
| status | alert_status | NEW, ACKNOWLEDGED, IN_PROGRESS |
| alert_count | integer | Number of alerts |
| avg_score | decimal | Average anomaly score |
| oldest_alert | timestamptz | Oldest unclosed alert |
| newest_alert | timestamptz | Most recent alert |

### 2. Alert Summary

**View:** `public.v_alert_summary`

Quick snapshot of alert statistics:
- `active_alerts` - Total open alerts
- `new_alerts` - Unacknowledged alerts
- `critical_new` - P0 alerts needing attention
- `triggered_last_hour` - Alert generation rate

### 3. Cases with SLA Progress

**View:** `public.v_cases_with_sla`

```sql
-- Get at-risk cases
SELECT * FROM public.v_cases_with_sla 
WHERE sla_status IN ('breached', 'at_risk')
ORDER BY sla_hours_remaining;
```

| Column | Type | Description |
|--------|------|-------------|
| case_id | integer | Case identifier |
| title | varchar | Case title |
| priority | case_priority | URGENT, HIGH, MEDIUM, LOW |
| status | case_status | Current status |
| sla_status | text | met, breached, at_risk, on_track, no_sla |
| sla_hours_remaining | float | Hours until deadline (negative if breached) |
| hours_open | float | Total hours case has been open |

### 4. Case SLA Metrics

**View:** `public.v_case_sla_metrics`

```sql
SELECT * FROM public.v_case_sla_metrics;
```

| Column | Type | Description |
|--------|------|-------------|
| total_cases | integer | All cases |
| open_cases | integer | Currently open |
| sla_breached | integer | Breached SLAs |
| sla_at_risk | integer | SLAs expiring in 1 hour |
| sla_compliance_rate | decimal | Percentage meeting SLA |
| avg_resolution_hours | decimal | Average time to resolve |

### 5. ML Model Performance

**View:** `public.v_ml_performance_metrics`

```sql
-- Get today's ML performance
SELECT * FROM public.v_ml_performance_metrics 
WHERE score_date = CURRENT_DATE;
```

| Column | Type | Description |
|--------|------|-------------|
| model_type | varchar | anomaly, stockout |
| score_date | date | Date of scores |
| total_scores | integer | Total predictions |
| anomalies_detected | integer | Anomalies flagged |
| avg_score | decimal | Average model score |

### 6. ML Summary

**View:** `public.v_ml_summary`

Quick ML health check:
```sql
SELECT model_type, scores_today, anomalies_today, minutes_since_last_score 
FROM public.v_ml_summary;
```

### 7. Outlet Health Scores

**View:** `public.v_outlet_health`

```sql
-- Get outlets needing attention
SELECT outlet_name, health_score, active_alerts, low_stock_items 
FROM public.v_outlet_health 
WHERE health_score < 70 
ORDER BY health_score;
```

| Column | Type | Description |
|--------|------|-------------|
| outlet_id | integer | Outlet identifier |
| outlet_name | varchar | Outlet name |
| health_score | integer | 0-100 health score |
| active_alerts | integer | Open alerts |
| critical_alerts | integer | P0/P1 alerts |
| daily_avg_sales | decimal | 7-day average |
| anomaly_count_7d | integer | Anomalies this week |
| low_stock_items | integer | Items below min stock |
| open_cases | integer | Open support cases |
| sla_breached_cases | integer | Cases past SLA |

### 8. Outlet Health Summary

**View:** `public.v_outlet_health_summary`

Aggregated health by category:
```sql
SELECT * FROM public.v_outlet_health_summary;
```

---

## Alert Thresholds

### Pre-configured Thresholds

| Threshold | Warning | Critical | Description |
|----------|---------|----------|-------------|
| `alerts_per_hour` | 30 | 50 | Alert generation rate |
| `sla_breach_rate` | 5% | 10% | Cases breaching SLA |
| `ml_error_rate` | 5% | 10% | ML function failures |
| `function_duration_p95` | 3000ms | 5000ms | Edge function latency |
| `active_alerts` | 50 | 100 | Open alert count |
| `ml_stale_data` | 60 min | 120 min | No ML scores |

### Managing Thresholds

```sql
-- View all thresholds
SELECT * FROM public.alert_thresholds;

-- Update a threshold
UPDATE public.alert_thresholds 
SET critical_threshold = 75, warning_threshold = 50
WHERE threshold_name = 'alerts_per_hour';

-- Disable a threshold
UPDATE public.alert_thresholds 
SET is_enabled = false
WHERE threshold_name = 'ml_stale_data';
```

### Active Violations

```sql
-- View current threshold violations
SELECT * FROM public.v_active_threshold_violations;
```

---

## Metrics Tables

### Function Execution Logs

**Table:** `public.function_execution_logs`

Tracks all Edge Function executions:
```sql
-- Log execution in your function
SELECT log_function_execution(
    'my-function',
    'completed',
    234,           -- duration_ms
    NULL,          -- error_message
    50,            -- records_processed
    '{"key": "value"}'::jsonb
);
```

### Alert Generation Metrics

**Table:** `public.alert_generation_metrics`

Hourly aggregated alert generation:
```sql
SELECT * FROM public.alert_generation_metrics 
ORDER BY metric_hour DESC LIMIT 24;
```

### SLA Breach Events

**Table:** `public.sla_breach_events`

Auto-logged when SLA is breached. Use for:
- Reporting breach rates
- Identifying problem outlets
- Trend analysis

### ML Error Logs

**Table:** `public.ml_error_logs`

```sql
-- Log ML error
SELECT log_ml_error(
    'ml-anomaly-score',
    123,                    -- outlet_id
    'MODEL_ERROR',          -- error_type
    'Insufficient data',   -- error_message
    'warning',             -- severity
    '{"data_points": 2}'::jsonb
);

-- View unresolved errors
SELECT * FROM public.ml_error_logs WHERE resolved = false;
```

---

## Function Execution Summary

**View:** `public.v_function_execution_summary`

```sql
-- Get execution stats for last 24h
SELECT * FROM public.v_function_execution_summary;
```

### Error Rate Metrics

**View:** `public.v_error_rate_metrics`

```sql
-- Check error rates
SELECT function_name, total_executions_1h, errors_1h, error_rate_pct 
FROM public.v_error_rate_metrics;
```

---

## Recommended Monitoring Dashboard

### Key Metrics to Track

1. **System Health**
   - Overall status (healthy/degraded/unhealthy)
   - Database latency
   - Function execution times

2. **Alerting Health**
   - Active alerts by severity
   - New alerts per hour (rate)
   - Critical alert count

3. **SLA Compliance**
   - Open cases by priority
   - SLA breach count
   - SLA compliance rate
   - Average resolution time

4. **ML Health**
   - Scores generated per hour
   - Anomaly detection rate
   - Error rate
   - Minutes since last score

5. **Outlet Health**
   - Health score distribution
   - Outlets needing attention (<70 score)
   - Low stock items
   - Active anomalies

### Dashboard Widgets

```
┌─────────────────────────────────────────────────────────────────┐
│  System Health: [██████████] 100% - All Systems Operational    │
├───────────────────────┬─────────────────────────────────────────┤
│  Active Alerts        │  SLA Compliance                         │
│  P0: 3  P1: 12        │  ██████████░░░░░░░░ 78%               │
│  P2: 45  P3: 23       │  12/52 cases met SLA                   │
├───────────────────────┼─────────────────────────────────────────┤
│  ML Performance       │  Outlet Health                          │
│  Scores: 1,234        │  Excellent: 35  Good: 12               │
│  Anomalies: 89        │  Fair: 5  Poor: 2                      │
│  Error Rate: 0.3%     │  Critical Outlets: 2                   │
└───────────────────────┴─────────────────────────────────────────┘
```

---

## Alert Escalation

### Severity Mapping

| Threshold Severity | Alert Severity | Notification |
|-------------------|----------------|--------------|
| critical | P0_CRITICAL | Immediate |
| warning | P1_HIGH | Within 1 hour |

### Escalation Rules

1. **Critical Threshold Breach**
   - Alert severity: P0_CRITICAL
   - Notification: All channels (WhatsApp, Email)
   - Cooldown: 15 minutes

2. **Warning Threshold Breach**
   - Alert severity: P1_HIGH
   - Notification: Primary channel only
   - Cooldown: 30 minutes

---

## Troubleshooting

### Health Check Returns Degraded

1. Check `checks` object for which component is degraded
2. Review recent `function_execution_logs` for errors
3. Check `ml_error_logs` for ML function issues

### High Alert Generation Rate

```sql
-- Identify what's triggering alerts
SELECT type, COUNT(*) 
FROM public.alerts 
WHERE triggered_at >= NOW() - INTERVAL '1 hour'
GROUP BY type;
```

### SLA Breaches

```sql
-- Get breach details
SELECT c.*, o.name as outlet_name 
FROM public.sla_breach_events s
JOIN public.cases c ON c.id = s.case_id
JOIN public.outlets o ON o.id = s.outlet_id
ORDER BY s.breached_at DESC;
```

### ML Staleness

```sql
-- Check when ML last ran
SELECT model_type, MAX(scored_at) as last_score 
FROM public.ml_scores 
GROUP BY model_type;
```

---

## Files Created

| File | Description |
|------|-------------|
| `supabase/functions/health-check/index.ts` | Health check endpoint |
| `supabase/migrations/036_monitoring_views.sql` | Dashboard views |
| `supabase/migrations/037_monitoring_metrics.sql` | Metrics tables & logging |
| `supabase/migrations/038_alert_thresholds.sql` | Alert threshold configuration |
| `docs/observability.md` | This documentation |

---

## Deployment

```bash
cd /Users/weskonek/WeskonekWeb/unified-ai-CQ

# Push migrations
supabase db push --password CyberQuote2026

# Deploy health-check function
supabase functions deploy health-check
```

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-07-17 | 1.0.0 | Initial observability setup |
