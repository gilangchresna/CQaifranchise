# CyberQuote MVP - Implementation Plan
**Version:** 1.0  
**Date:** July 14, 2026  
**Status:** Ready for Implementation

---

## Executive Summary

CyberQuote MVP has solid building blocks (14 edge functions, 15 pages, database seeded) but **missing orchestration layer** that connects them into automated pipeline.

**Goal:** Enable full automation loop: POS Data → ML Scoring → Alert → Case → Notification

---

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Database | ✅ | 24 outlets, 9 regions, 15 alerts |
| Edge Functions | ✅ | 14 deployed |
| Frontend UI | ✅ | 15 pages |
| ML Scoring | ⚠️ | Works on-demand only |
| Alert Generation | ❌ | Not automated |
| Notifications | ❌ | Not wired |
| Scheduling | ❌ | No cron jobs |

---

## Implementation Phases

```
Phase 1: Core Automation (Week 1)
├── 1.1 Alert Auto-Generator
├── 1.2 ML Batch Scheduler
└── 1.3 Notification Trigger

Phase 2: Case Management (Week 2)
├── 2.1 Auto-Assignment Rules
├── 2.2 SLA Escalation Timer
└── 2.3 Case Status Updates

Phase 3: Data Integration (Week 3)
├── 3.1 POS Connector Stub
├── 3.2 Webhook Receiver
└── 3.3 Data Validation
```

---

## Phase 1.1: Alert Auto-Generator

### Objective
Automatically create alerts when ML scoring detects anomalies or stockout risks.

### Files to Create

```
supabase/functions/alert-generator/
├── index.ts          # Main logic
└── README.md         # Documentation
```

### Function Spec

**Endpoint:** `POST /functions/v1/alert-generator`

**Request Body:**
```json
{
  "outlet_id": 1,
  "trigger_type": "ANOMALY" | "STOCKOUT" | "MANUAL",
  "threshold_override": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "alert_id": 123,
  "alert_type": "SALES_ANOMALY",
  "severity": "P1_HIGH",
  "score": 0.85
}
```

### Logic Flow

```
1. Receive outlet_id + trigger_type
2. Call ml-anomaly-score → get score
3. Call ml-stockout-risk → get risk level
4. If score > threshold:
   a. Determine alert_type (SALES_ANOMALY | STOCKOUT_RISK | ...)
   b. Determine severity (P0_CRITICAL | P1_HIGH | P2_MEDIUM | P3_LOW)
   c. Get outlet info (name, region, franchisee)
   d. Generate title and description
   e. Insert into alerts table
   f. Return alert_id
5. If score <= threshold: return { success: false, reason: "below_threshold" }
```

### Severity Mapping

| Score Range | Severity | SLA |
|-------------|----------|-----|
| 0.9 - 1.0 | P0_CRITICAL | 1 hour |
| 0.7 - 0.89 | P1_HIGH | 4 hours |
| 0.5 - 0.69 | P2_MEDIUM | 24 hours |
| 0.3 - 0.49 | P3_LOW | 72 hours |
| < 0.3 | Skip | - |

### Database Changes

None needed - uses existing `alerts` table.

### Dependencies
- `ml-anomaly-score` (existing)
- `ml-stockout-risk` (existing)
- `outlets` table (existing)

### Acceptance Criteria
- [ ] Function deploys successfully
- [ ] Returns alert_id when score > threshold
- [ ] Returns success:false when score <= threshold
- [ ] Alert appears in alerts-list
- [ ] Alert has correct severity based on score

---

## Phase 1.2: ML Batch Scheduler

### Objective
Run ML scoring on all outlets on schedule (every 6 hours) and auto-generate alerts.

### Files to Create

```
supabase/functions/ml-scheduler/
├── index.ts          # Scheduler logic
└── README.md
```

### Function Spec

**Endpoint:** `POST /functions/v1/ml-scheduler`

**Request Body (optional):**
```json
{
  "outlet_ids": [1, 2, 3],  // Optional: specific outlets
  "force": false            // Force re-score even if recent
}
```

**Response:**
```json
{
  "success": true,
  "processed": 24,
  "anomalies": 3,
  "stockouts": 2,
  "alerts_created": 5,
  "duration_ms": 4520
}
```

### Logic Flow

```
1. Get all active outlets
2. For each outlet (parallel, batch of 10):
   a. Call ml-anomaly-score
   b. Call ml-stockout-risk
   c. If anomaly_score > 0.5: call alert-generator
   d. If stockout_risk > 0.6: call alert-generator
3. Log results to audit table
4. Return summary
```

### Cron Configuration

**Schedule:** Every 6 hours (0,6,12,18)

**Implementation via Supabase Cron:**

```sql
-- Create cron job (run once in Supabase dashboard or via API)
SELECT cron.schedule(
  'ml-batch-scheduler',
  '0 */6 * * *',  -- Every 6 hours
  $$
  SELECT net.http_post(
    url := 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-scheduler',
    headers := '{"Authorization": "Bearer <service_role_jwt>"}'::jsonb
  );
  $$
);
```

**Alternative (Hermes Cron Job):**
```yaml
# Via Hermes cron
schedule: "0 */6 * * *"
prompt: "Call ml-scheduler function..."
skills: ["supabase-edge-functions"]
```

### Dependencies
- `ml-anomaly-score` (existing)
- `ml-stockout-risk` (existing)
- `alert-generator` (Phase 1.1)
- `outlets` table (existing)

### Acceptance Criteria
- [ ] Processes all 24 outlets in < 60 seconds
- [ ] Creates alerts for high scores
- [ ] Returns accurate summary
- [ ] Cron triggers on schedule

---

## Phase 1.3: Notification Trigger

### Objective
Automatically send notifications when alerts are created or cases are updated.

### Files to Modify

```
supabase/functions/notification-trigger/
├── index.ts          # New function
└── README.md
```

### Function Spec

**Endpoint:** `POST /functions/v1/notification-trigger`

**Request Body:**
```json
{
  "event_type": "ALERT_CREATED" | "CASE_ASSIGNED" | "CASE_UPDATED" | "SLA_WARNING",
  "entity_id": 123,
  "channels": ["EMAIL", "SLACK"]  // Optional, defaults to user preference
}
```

**Response:**
```json
{
  "success": true,
  "notifications_sent": 2,
  "channels": ["EMAIL", "SLACK"],
  "recipients": ["regional_manager@outlet.com"]
}
```

### Logic Flow

```
1. Receive event_type + entity_id
2. Fetch entity details:
   - If ALERT_CREATED: get alert + outlet + assignee
   - If CASE_ASSIGNED: get case + assignee
   - If SLA_WARNING: get case + assignee + deadline
3. Determine recipients based on event:
   - Regional: Regional Manager of outlet's region
   - HQ: HQ_ADMIN for P0_CRITICAL
4. Fetch user notification preferences
5. For each channel (email/slack):
   a. Format message template
   b. Call notification-send
6. Log to notification_logs table
7. Return summary
```

### Message Templates

**ALERT_CREATED:**
```
📢 New Alert: {alert_type}
Outlet: {outlet_name} ({outlet_code})
Severity: {severity}
Score: {score}
Time: {created_at}

{alert_description}

[View Alert](https://cyberquote.app/alerts/{alert_id})
```

**CASE_ASSIGNED:**
```
📋 Case Assigned to You
Case: {case_title}
Alert: {alert_title}
Outlet: {outlet_name}
Priority: {priority}
Due: {due_date}

[View Case](https://cyberquote.app/cases/{case_id})
```

### Dependencies
- `notification-send` (existing)
- `alerts` table (existing)
- `cases` table (existing)
- `user_profiles` table (existing)

### Acceptance Criteria
- [ ] Sends email on alert creation
- [ ] Notifies correct assignee
- [ ] Escalates P0 to HQ_ADMIN
- [ ] Logs to notification_logs

---

## Phase 2.1: Auto-Assignment Rules

### Objective
Automatically assign cases to appropriate users based on rules.

### Files to Create

```
supabase/functions/case-assigner/
├── index.ts          # Assignment logic
└── README.md
```

### Function Spec

**Endpoint:** `POST /functions/v1/case-assigner`

**Request Body:**
```json
{
  "alert_id": 123,
  "force": false  // Override existing assignment
}
```

**Response:**
```json
{
  "success": true,
  "case_id": 456,
  "assigned_to": "regional_manager_id",
  "assignment_rule": "REGIONAL_PRIMARY",
  "sla_deadline": "2026-07-14T18:00:00Z"
}
```

### Assignment Rules

| Priority | Severity | Region | Assignee |
|----------|----------|--------|----------|
| 1 | P0_CRITICAL | Any | HQ_ADMIN |
| 2 | P1_HIGH | Any | Regional Manager |
| 3 | P2_MEDIUM | Specific | Area Lead |
| 4 | P3_LOW | Any | Outlet Owner |

### Logic Flow

```
1. Receive alert_id
2. Fetch alert details (severity, type, outlet_id)
3. Fetch outlet details (region_id)
4. Apply assignment rules:
   a. P0_CRITICAL → Assign to HQ_ADMIN (role = HQ_ADMIN)
   b. P1_HIGH → Assign to Regional Manager of outlet's region
   c. P2_MEDIUM → Assign to Area Lead of region
   d. P3_LOW → Assign to outlet's franchisee
5. Calculate SLA deadline based on severity
6. Create case with assignment
7. Trigger notification to assignee
8. Return case_id + assignment
```

### SLA Deadlines

| Severity | Deadline | Escalation |
|----------|----------|------------|
| P0_CRITICAL | 1 hour | 30 min warning |
| P1_HIGH | 4 hours | 2 hour warning |
| P2_MEDIUM | 24 hours | 12 hour warning |
| P3_LOW | 72 hours | 48 hour warning |

### Dependencies
- `case-create` (existing)
- `alert-generator` (Phase 1.1)
- `notification-trigger` (Phase 1.3)
- `cases` table (existing)
- `user_profiles` table (existing)

### Acceptance Criteria
- [ ] P0 assigned to HQ_ADMIN
- [ ] P1 assigned to Regional Manager
- [ ] SLA calculated correctly
- [ ] Notification sent to assignee

---

## Phase 2.2: SLA Escalation Timer

### Objective
Check for overdue cases and escalate appropriately.

### Files to Create

```
supabase/functions/sla-escalator/
├── index.ts          # Escalation logic
└── README.md
```

### Function Spec

**Endpoint:** `POST /functions/v1/sla-escalator`

**Response:**
```json
{
  "success": true,
  "checked": 45,
  "warning_sent": 12,
  "escalated": 3,
  "overdue": 1
}
```

### Logic Flow

```
1. Get all open cases with deadlines
2. For each case:
   a. Calculate time remaining
   b. If overdue: escalate to next level
   c. If warning threshold: send warning
   d. If approaching deadline: send reminder
3. Log escalations
4. Return summary
```

### Escalation Rules

| Level | Trigger | Action |
|-------|---------|--------|
| Warning | 50% of SLA elapsed | Reminder to assignee |
| Escalation | 75% of SLA elapsed | Notify manager |
| Critical | 100% SLA elapsed | Escalate to HQ |

### Dependencies
- `cases` table (existing)
- `notification-trigger` (Phase 1.3)

---

## Phase 2.3: Case Status Updates

### Objective
Update case status based on alert resolution or manual actions.

### Files to Modify

```
supabase/functions/case-update/
└── index.ts  # Add new endpoints
```

### New Endpoints

**POST /functions/v1/case-resolve**
```json
{
  "case_id": 123,
  "resolution": "FIXED" | "WONT_FIX" | "DUPLICATE",
  "notes": "Restored stock from regional warehouse"
}
```

**POST /functions/v1/case-escalate**
```json
{
  "case_id": 123,
  "reason": "No response for 2 hours"
}
```

---

## Phase 3: Data Integration

### Phase 3.1: POS Connector Stub

**Supported POS Systems:**
- Aloha (IRISPY)
- SAP S/4HANA
- Microsoft Dynamics

**Connector Interface:**
```typescript
interface POSConnector {
  fetchSales(date: Date): Promise<SalesData[]>;
  fetchInventory(outletId: string): Promise<InventoryData[]>;
  authenticate(): Promise<void>;
}
```

### Phase 3.2: Webhook Receiver

**Endpoint:** `POST /functions/v1/ingestion-webhook`

**Process Flow:**
```
1. Receive webhook payload
2. Validate signature
3. Parse data format
4. Transform to standard schema
5. Insert to sales_transactions
6. Trigger ML scoring
7. Return acknowledgment
```

### Phase 3.3: Data Validation

**Validation Rules:**
- Sales amount > 0
- Date within last 30 days
- Outlet_id exists
- Required fields present

---

## Implementation Order

```
Week 1 (Phase 1: Core Automation)
├── Day 1-2: alert-generator
├── Day 3: ml-scheduler
├── Day 4: notification-trigger
└── Day 5: Integration test

Week 2 (Phase 2: Case Management)
├── Day 1-2: case-assigner
├── Day 3: sla-escalator
├── Day 4: case-status-updates
└── Day 5: Integration test

Week 3 (Phase 3: Data Integration)
├── Day 1-2: POS connector stubs
├── Day 3: Webhook receiver
├── Day 4: Data validation
└── Day 5: E2E test
```

---

## Testing Plan

### Unit Tests
- alert-generator: score thresholds
- case-assigner: rule engine
- notification-trigger: message formatting

### Integration Tests
- Full flow: ingestion → ML → alert → case → notification
- Cron trigger: ml-scheduler → alert-generator
- Escalation: sla-escalator → notification

### E2E Tests
- Login → View Dashboard → View Alerts → Approve Alert → Case Created
- POS data received → Alert generated → Notification sent

---

## Rollout Checklist

### Pre-Launch
- [ ] All Phase 1 functions deployed
- [ ] Cron jobs configured
- [ ] RLS policies verified
- [ ] Notification channels tested
- [ ] Alert email template verified

### Launch Day
- [ ] Disable test mode
- [ ] Enable real notifications
- [ ] Monitor error logs
- [ ] Verify alert generation

### Post-Launch (Week 1)
- [ ] Monitor false positives
- [ ] Tune score thresholds
- [ ] Add more outlets
- [ ] Collect user feedback

---

## Monitoring & Alerts

### Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Alerts created/day | 50-100 | > 200 |
| Avg case resolution | < 4 hours | > 8 hours |
| Notification delivery | > 95% | < 90% |
| ML processing time | < 60s | > 120s |

### Dashboard Panels

1. **Alert Volume** - Line chart, 7-day trend
2. **Case Resolution** - Bar chart by severity
3. **SLA Compliance** - Gauge, percentage
4. **Notification Status** - Table, last 24h

---

## Rollback Plan

If issues occur:

1. **Disable cron jobs:**
   ```sql
   SELECT cron.unschedule('ml-batch-scheduler');
   ```

2. **Disable auto-alerts:**
   - Set flag in config table
   - Manual approval only mode

3. **Disable notifications:**
   - Set `notifications_enabled = false`
   - All notifications go to /dev/null

---

## Appendix: Function Inventory

### New Functions (This Plan)

| Function | Phase | Dependencies |
|----------|-------|--------------|
| alert-generator | 1.1 | ml-*, outlets |
| ml-scheduler | 1.2 | alert-generator, ml-* |
| notification-trigger | 1.3 | notification-send, alerts, cases |
| case-assigner | 2.1 | case-create, alerts |
| sla-escalator | 2.2 | cases, notification-trigger |
| case-update | 2.3 | cases |

### Existing Functions (Used)

| Function | Purpose |
|----------|---------|
| ml-anomaly-score | Score outlet for anomalies |
| ml-stockout-risk | Predict stockout probability |
| case-create | Create case from alert |
| notification-send | Send email/SMS |
| ingestion-webhook | Receive POS data |

### Functions to Deprecate

| Function | Reason |
|----------|--------|
| (none) | All existing functions are still needed |

---

## Cost Estimation

### Supabase Edge Functions

| Function | Invocations/month | Est. Cost |
|----------|-------------------|-----------|
| alert-generator | 10,000 | ~$0.50 |
| ml-scheduler | 120 (2x/day) | ~$0.10 |
| notification-trigger | 5,000 | ~$0.25 |
| case-assigner | 1,000 | ~$0.05 |
| sla-escalator | 720 (hourly) | ~$0.10 |

**Total:** ~$1.00/month (within free tier)

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Alert auto-generated within 5 min of ML scoring
- [ ] ML scheduler runs on schedule
- [ ] Notification sent within 1 min of alert
- [ ] Zero manual alert creation needed

### Phase 2 Complete When:
- [ ] Cases auto-assigned with >90% accuracy
- [ ] SLA warnings sent on time
- [ ] Escalations work correctly

### MVP Complete When:
- [ ] Full E2E flow working: data → ML → alert → case → notification
- [ ] Dashboard shows real data
- [ ] User can resolve cases from UI
- [ ] No manual intervention required for normal flow

---

**Prepared by:** Hermes Agent  
**For:** CyberQuote MVP Team  
**Date:** July 14, 2026
