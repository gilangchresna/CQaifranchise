# SLA Escalator — Audit Report

> **Document Version:** 1.0
> **Last Updated:** August 31, 2026
> **Status:** ⚠️ Partial — Backend Complete, Frontend Missing

---

## Overview

The SLA Escalator is a backend service that monitors case SLA deadlines and automatically escalates cases when thresholds are reached.

**Current State:** Backend logic complete, but frontend integration and cron setup missing.

---

## ✅ What EXISTS

### Edge Function

| Property | Value |
|----------|-------|
| **File** | `supabase/functions/sla-escalator/index.ts` |
| **Lines** | 515 |
| **Cron** | Every 15 minutes (per documentation) |
| **Language** | TypeScript / Deno |

### Database Table

```sql
CREATE TABLE IF NOT EXISTS sla_escalation_runs (
  id SERIAL PRIMARY KEY,
  run_id UUID DEFAULT gen_random_uuid(),
  cases_affected INTEGER DEFAULT 0,
  cases_escalated INTEGER DEFAULT 0,
  cases_warned INTEGER DEFAULT 0,
  errors TEXT[],
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);
```

### Escalation Logic

| Threshold | Action |
|-----------|--------|
| 50% SLA elapsed | Warning email sent (if not sent in last 1 hour) |
| 75% SLA elapsed | Case escalated to higher role |
| 100% SLA elapsed | Case auto-assigned to HQ_ADMIN |

### Escalation Chain

```
OUTLET_STAFF → FRANCHISEE_OWNER → AREA_LEAD → REGIONAL_MANAGER → HQ_ADMIN
     ↓              ↓                    ↓              ↓              ↓
   P3/Low       P3/Low             P2/Med         P2/Med         P1/P0
```

### Configurable Thresholds

| Setting | Default | Description |
|---------|---------|-------------|
| `sla_warning_threshold` | 50% | When to send warning |
| `sla_escalation_threshold` | 75% | When to escalate |

---

## ❌ What is MISSING

### Frontend

| Component | Status | Priority |
|-----------|--------|----------|
| **Cron Setup** | ❌ Not in cron list | High |
| **SLA Dashboard** | ❌ Not found | High |
| **Case SLA Display** | ❌ Not found | High |
| **Escalation History** | ❌ Not found | Medium |
| **Settings UI** | ❌ Not found | Medium |
| **Email Templates** | ⚠️ Implied | High |

### Integration

| Component | Status | Priority |
|-----------|--------|----------|
| **Notification Trigger** | ⚠️ Called, not verified | Medium |
| **WhatsApp Integration** | ❌ Not connected | Low |

---

## 🔄 Current Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SLA Escalation Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Case Created (with SLA deadline)                              │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │ sla-escalator  │ (runs every 15 min)                       │
│  │  edge function │                                           │
│  └────────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│  ┌─────────────────────────────────────────────────┐          │
│  │ Check SLA elapsed %                             │          │
│  └─────────────────────────────────────────────────┘          │
│           │                                                    │
│    ┌─────┴─────┐                                             │
│    │           │                                              │
│    ▼           ▼                                              │
│  < 50%     ≥ 50% elapsed                                     │
│  (Skip)    ┌──────────────────────────────────────┐          │
│            │  Check if warning already sent        │          │
│            │  (within last hour)                   │          │
│            └──────────────────────────────────────┘          │
│                       │                                       │
│              ┌────────┴────────┐                             │
│              │                 │                              │
│              ▼                 ▼                              │
│          Already sent     Not sent recently                   │
│          (Skip)          ┌────────────────┐                 │
│                          │ Send warning   │                 │
│                          │ (SLA_WARNING) │                 │
│                          └───────┬────────┘                 │
│                                  │                            │
│                                  ▼                            │
│                    ┌─────────────────────────┐               │
│                    │ elapsed >= 75%?         │               │
│                    └───────────┬─────────────┘               │
│                     Yes        │        No                     │
│                    ┌───────────┴───────────┐                  │
│                    │                       │                   │
│                    ▼                       ▼                   │
│            ┌───────────────┐         (Done)                  │
│            │ Escalate case │                                 │
│            │ to higher role│                                 │
│            └───────────────┘                                 │
│                    │                                          │
│                    ▼                                          │
│            ┌───────────────┐                                 │
│            │ Notify new    │                                 │
│            │ assignee      │                                 │
│            └───────────────┘                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 API Contract

### POST /functions/v1/sla-escalator

**Request (optional):**
```json
{
  "case_ids": [1, 2, 3],
  "warning_threshold": 50,
  "escalation_threshold": 75
}
```

**Response:**
```json
{
  "success": true,
  "checked": 10,
  "warnings_sent": 2,
  "escalated": 1,
  "overdue": 0,
  "errors": [],
  "warnings": [
    {
      "case_id": 1,
      "case_title": "High stockout risk",
      "assignee_id": "uuid",
      "assignee_name": "John Doe",
      "sla_deadline": "2026-08-31T15:00:00Z",
      "elapsed_percent": 65,
      "remaining_minutes": 120
    }
  ],
  "escalations": [
    {
      "case_id": 2,
      "case_title": "P0 anomaly detected",
      "from_assignee_id": "uuid1",
      "from_assignee_name": "Area Lead",
      "to_assignee_id": "uuid2",
      "to_assignee_name": "Regional Manager",
      "escalation_rule": "escalate_AREA_LEAD_to_REGIONAL_MANAGER",
      "elapsed_percent": 78
    }
  ]
}
```

---

## 🎯 Tasks to Complete

### Priority 1: Integration

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1 | Add cron job for sla-escalator | 1h | ⬜ |
| 2 | Verify notification-trigger integration | 2h | ⬜ |
| 3 | Test escalation flow end-to-end | 2h | ⬜ |

### Priority 2: Frontend

| # | Task | Effort | Status |
|---|------|--------|--------|
| 4 | Add SLA deadline to Case UI | 4h | ⬜ |
| 5 | Create SLA Status badge component | 2h | ⬜ |
| 6 | Add Escalation History page | 4h | ⬜ |
| 7 | Create SLA Settings page | 4h | ⬜ |
| 8 | Add SLA warning/overdue to Case list | 2h | ⬜ |

### Priority 3: Email Templates

| # | Task | Effort | Status |
|---|------|--------|--------|
| 9 | Create SLA warning email template | 2h | ⬜ |
| 10 | Create escalation notification template | 2h | ⬜ |
| 11 | Create overdue alert template | 1h | ⬜ |

---

## 📊 Effort Summary

| Phase | Tasks | Effort |
|-------|-------|--------|
| Integration | 3 | 5h |
| Frontend | 5 | 16h |
| Email Templates | 3 | 5h |
| **Total** | **11** | **26h** |

---

## 🔗 Related Documents

- [[02-Technical-Specs/Edge-Functions-Documentation]] — All edge functions
- [[02-Technical-Specs/Webhook-Flow]] — Notification system
- [[04-Decision-Log/Project-Audit-Report-Aug2026]] — Overall audit

---

## 📝 Notes

- The edge function is production-ready from backend perspective
- Missing cron setup is likely the main blocker for live operation
- Frontend team needs to add SLA indicators to Case components
- Escalation history table (`sla_escalation_runs`) exists but no UI to view it

---

**Document Status:** Complete
**Next Review:** September 7, 2026
**Owner:** Fullstack Team
