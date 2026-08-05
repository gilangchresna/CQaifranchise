# CyberQuote App - Comprehensive Gap Analysis

**Date:** July 14, 2026  
**Version:** 1.0  

---

## Executive Summary

Analysis of 15 React components, 29 edge functions, and database tables reveals:
- ✅ **Core integration working** (Dashboard, Alerts, Outlets)
- ⚠️ **Missing tables** for 7 components
- ❌ **Components broken** without tables

---

## Current Database Tables

### ✅ Tables That Exist (6)

| Table | Rows | Status |
|-------|------|--------|
| regions | 9 | ✅ Active |
| outlets | 24 | ✅ Active |
| user_profiles | 3 | ✅ Active |
| sales_transactions | 720 | ✅ Seeded |
| alerts | 17 | ✅ Active |
| pilot_outreach | 12 | ✅ Active |

### ❌ Tables That DON'T Exist (10)

| Table | Needed By | Priority |
|-------|----------|----------|
| cases | Workflows, case-create | 🔴 CRITICAL |
| ai_agents | Agents | 🔴 CRITICAL |
| staff | Workforce | 🔴 CRITICAL |
| ml_models | Models | 🟠 HIGH |
| integrations | Integrations | 🟠 HIGH |
| settings | Settings | 🟡 MEDIUM |
| notifications | - | 🟡 MEDIUM |
| ml_model_versions | Models | 🟡 MEDIUM |
| webhook_secrets | Integrations | 🟡 MEDIUM |
| ai_explanations | AICopilot | 🟢 LOW |

---

## Component Analysis

### ✅ Already Working (4 components)

| Component | Edge Functions | Tables | Status |
|-----------|---------------|--------|--------|
| Dashboard.tsx | alerts-list, franchises-list, regions-list | ✅ | ✅ Working |
| AlertsList.tsx | alerts-list, case-create | alerts ✅ | ✅ Working |
| Outlets.tsx | franchises-list, regions-list | outlets ✅ | ✅ Working |
| Workflows.tsx | case-create | cases ❌ | ❌ **BROKEN** |

### ⚠️ Need Edge Functions (7 components)

| Component | Edge Function | Table | Status |
|-----------|---------------|-------|--------|
| Agents.tsx | agents-list | ai_agents ❌ | ❌ **BROKEN** |
| Workforce.tsx | staff-list | staff ❌ | ❌ **BROKEN** |
| Models.tsx | ml-models-list | ml_models ❌ | ❌ **BROKEN** |
| Integrations.tsx | - | integrations ❌ | ❌ **BROKEN** |
| Settings.tsx | settings-get | settings ❌ | ⚠️ No data |
| AccessManagement.tsx | users-list | user_profiles ✅ | ✅ Working |
| AICopilot.tsx | athena-chat | - | ⚠️ Simulated |

---

## Edge Functions Status

### ✅ Deployed (29 functions)

| Category | Functions |
|----------|-----------|
| **Data** | franchises-list, regions-list, alerts-list, users-list |
| **ML** | ml-anomaly-score, ml-stockout-risk, ml-batch-score, ml-models-list |
| **Cases** | case-create, case-update, case-assigner |
| **Ingestion** | ingestion-csv, ingestion-webhook, pos-connector, data-validation, data-validator |
| **Automation** | alert-generator, notification-trigger, sla-escalator, ml-scheduler |
| **Support** | pilot-dashboard, seed-data, seed-sales, debug-db |
| **New** | agents-list, staff-list, settings-get, smtp-test |

### ❌ Missing Functions

| Function | Needed By | Priority |
|----------|----------|----------|
| athena-chat | AICopilot | 🟠 HIGH |
| notifications-list | ? | 🟡 MEDIUM |

---

## Critical Issues

### Issue 1: cases Table Missing
**Impact:** Workflows component broken, case-create can't work

**Error:** 
```
Table 'cases' does not exist
```

**Fix Required:**
```sql
CREATE TABLE public.cases (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER REFERENCES public.alerts(id),
  assignee_id UUID REFERENCES public.user_profiles(id),
  status VARCHAR(20) DEFAULT 'OPEN',
  priority VARCHAR(10) DEFAULT 'P2',
  title VARCHAR(500),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
```

---

### Issue 2: ai_agents Table Missing
**Impact:** Agents component broken

**Error:**
```
Table 'ai_agents' does not exist
```

**Fix Required:**
```sql
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Issue 3: staff Table Missing
**Impact:** Workforce component broken

**Error:**
```
Table 'staff' does not exist
```

**Fix Required:**
```sql
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  role VARCHAR(50) NOT NULL,
  outlet_id INTEGER REFERENCES public.outlets(id),
  phone VARCHAR(20),
  email VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Issue 4: ml_models Table Missing
**Impact:** Models component broken

**Fix Required:**
```sql
CREATE TABLE public.ml_models (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  version VARCHAR(20) DEFAULT 'v1.0',
  status VARCHAR(20) DEFAULT 'PRODUCTION',
  metrics JSONB DEFAULT '{}',
  provider VARCHAR(100),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Issue 5: integrations Table Missing
**Impact:** Integrations component broken

**Fix Required:**
```sql
CREATE TABLE public.integrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'DISCONNECTED',
  config JSONB DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Recommended Actions

### Immediate (Day 1)

1. **Create cases table** - Unblocks Workflows + case-create
2. **Create ai_agents table** - Unblocks Agents
3. **Create staff table** - Unblocks Workforce
4. **Create ml_models table** - Unblocks Models
5. **Create integrations table** - Unblocks Integrations

### Short-term (Day 2-3)

6. **Seed ai_agents data** - Demo AI agents
7. **Seed staff data** - Demo workforce
8. **Seed ml_models data** - Demo ML models
9. **Seed integrations data** - Demo integrations

### Medium-term (Day 4-5)

10. **Create settings table** - User preferences
11. **Create ml_model_versions table** - Model versioning
12. **Connect AICopilot** - Real AI chat

---

## Implementation Order

```
Day 1: Core Tables
├── cases.sql
├── ai_agents.sql
├── staff.sql
├── ml_models.sql
└── integrations.sql

Day 2: Seed Data
├── seed-ai_agents.sql
├── seed-staff.sql
├── seed-ml_models.sql
└── seed-integrations.sql

Day 3: Settings & Extras
├── settings.sql
├── ml_model_versions.sql
├── notifications.sql
└── webhook_secrets.sql

Day 4: Integration Testing
└── Test all components

Day 5: AICopilot
└── athena-chat connection
```

---

## Verification Checklist

After each table creation:

- [ ] Run debug-db to verify table exists
- [ ] Test edge function that uses table
- [ ] Test component that needs table
- [ ] Verify RLS policies allow access

---

## Files to Create

| File | Location | Purpose |
|------|----------|---------|
| 019_create_cases.sql | migrations/ | Cases table |
| 020_create_ai_agents.sql | migrations/ | AI agents table |
| 021_create_staff.sql | migrations/ | Staff table |
| 022_create_ml_models.sql | migrations/ | ML models table |
| 023_create_integrations.sql | migrations/ | Integrations table |
| 024_seed_ai_agents.sql | migrations/ | Seed AI agents |
| 025_seed_staff.sql | migrations/ | Seed staff |
| 026_seed_ml_models.sql | migrations/ | Seed ML models |
| 027_seed_integrations.sql | migrations/ | Seed integrations |

---

## Summary

| Metric | Count |
|--------|-------|
| Total Components | 15 |
| Working | 4 |
| Broken | 6 |
| Partial | 5 |
| Total Tables Needed | 16 |
| Tables Existing | 6 |
| Tables Missing | 10 |
| Edge Functions | 29 |
| Edge Functions Working | 29 |

---

**Action Required:** Create missing tables immediately to unblock 6 broken components.
