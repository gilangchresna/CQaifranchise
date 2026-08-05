# CyberQuote - Missing Tables Implementation Plan

**Version:** 1.0\
**Date:** July 14, 2026\
**Status:** Ready for Implementation\
**Based on:** app-gap-analysis.md

---

## Executive Summary

6 components broken due to 5 missing database tables. This plan covers:

- Creating all missing tables with proper schema
- Seeding realistic demo data
- Testing each component
- Full verification

**Total Effort:** ~8 hours\
**Components Fixed:** 6

---

## Pre-requisites

- [ ] Supabase CLI configured
- [ ] Database connection active
- [ ] Access to project ploqeifazcgzwjzmukgp

---

## Implementation Order

```
Phase 1: Core Tables (3 hours)
├── 1.1 cases table
├── 1.2 ai_agents table
├── 1.3 staff table
├── 1.4 ml_models table
└── 1.5 integrations table

Phase 2: Seed Data (2 hours)
├── 2.1 Seed cases
├── 2.2 Seed ai_agents
├── 2.3 Seed staff
├── 2.4 Seed ml_models
└── 2.5 Seed integrations

Phase 3: Testing (2 hours)
├── 3.1 Test edge functions
├── 3.2 Test components
└── 3.3 E2E verification

Phase 4: Documentation (1 hour)
└── 4.1 Update gap analysis
```

---

## Phase 1: Create Missing Tables

### 1.1 cases Table

**File:** `supabase/migrations/019_create_cases.sql`

**Purpose:** Store alert cases for workflow management

**Schema:**

```sql
-- Cases table for alert workflow management
CREATE TABLE IF NOT EXISTS public.cases (
    id BIGSERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES public.alerts(id) ON DELETE SET NULL,
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
    assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assignee_name VARCHAR(200),
    region_id INTEGER REFERENCES public.regions(id) ON DELETE SET NULL,
    
    -- Status & Priority
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' 
        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'ESCALATED')),
    priority VARCHAR(10) NOT NULL DEFAULT 'P2'
        CHECK (priority IN ('P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW')),
    
    -- Case Details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'ALERT_CASE'
        CHECK (type IN ('ALERT_CASE', 'TASK', 'INCIDENT', 'REQUEST')),
    
    -- Resolution
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cases_alert ON public.cases(alert_id);
CREATE INDEX IF NOT EXISTS idx_cases_assignee ON public.cases(assignee_id);
CREATE INDEX IF NOT EXISTS idx_cases_outlet ON public.cases(outlet_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON public.cases(priority);
CREATE INDEX IF NOT EXISTS idx_cases_created ON public.cases(created_at DESC);

-- RLS
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read cases"
    ON public.cases FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow service role to manage cases"
    ON public.cases FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_updated_at
    BEFORE UPDATE ON public.cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.cases IS 'Alert cases for workflow management';
```

---

### 1.2 ai_agents Table

**File:** `supabase/migrations/020_create_ai_agents.sql`

**Purpose:** Store AI agent configurations

**Schema:**

```sql
-- AI Agents table for agent management
CREATE TABLE IF NOT EXISTS public.ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL
        CHECK (type IN ('ROUTING', 'ESCALATION', 'NOTIFICATION', 'ANALYSIS', 'AUTOMATION')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'PAUSED', 'ERROR', 'RETIRED')),
    
    -- Configuration
    config JSONB DEFAULT '{}',
    instructions TEXT,
    
    -- Capabilities
    capabilities JSONB DEFAULT '[]',
    integrations JSONB DEFAULT '[]',
    
    -- Metrics
    stats JSONB DEFAULT '{"total_cases": 0, "avg_resolution_time": 0}',
    
    -- Ownership
    created_by UUID REFERENCES auth.users(id),
    region_id INTEGER REFERENCES public.regions(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_agents_type ON public.ai_agents(type);
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON public.ai_agents(status);
CREATE INDEX IF NOT EXISTS idx_ai_agents_region ON public.ai_agents(region_id);

-- RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read agents"
    ON public.ai_agents FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow service role to manage agents"
    ON public.ai_agents FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER ai_agents_updated_at
    BEFORE UPDATE ON public.ai_agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.ai_agents IS 'AI agent configurations for franchise monitoring';
```

---

### 1.3 staff Table

**File:** `supabase/migrations/021_create_staff.sql`

**Purpose:** Store workforce/staff information

**Schema:**

```sql
-- Staff table for workforce management
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) UNIQUE,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL
        CHECK (role IN ('MANAGER', 'ASSISTANT_MANAGER', 'CASHIER', 'COOK', 'WAITER', 'CLEANER', 'SECURITY')),
    
    -- Outlet Assignment
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
    region_id INTEGER REFERENCES public.regions(id) ON DELETE SET NULL,
    
    -- Employment
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'OFF_DUTY', 'ON_LEAVE', 'TERMINATED')),
    hire_date DATE,
    schedule JSONB DEFAULT '{"shifts": []}',
    
    -- Contact
    emergency_contact JSONB DEFAULT '{}',
    address TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_outlet ON public.staff(outlet_id);
CREATE INDEX IF NOT EXISTS idx_staff_region ON public.staff(region_id);
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff(status);

-- RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read staff"
    ON public.staff FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow service role to manage staff"
    ON public.staff FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER staff_updated_at
    BEFORE UPDATE ON public.staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.staff IS 'Staff/workforce information for outlets';
```

---

### 1.4 ml_models Table

**File:** `supabase/migrations/022_create_ml_models.sql`

**Purpose:** Store ML model configurations

**Schema:**

```sql
-- ML Models table for model management
CREATE TABLE IF NOT EXISTS public.ml_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL
        CHECK (type IN ('ANOMALY_DETECTION', 'STOCKOUT_PREDICTION', 'DEMAND_FORECASTING', 'CHURN_PREDICTION')),
    version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'STAGING'
        CHECK (status IN ('PRODUCTION', 'STAGING', 'RETIRED', 'FAILED')),
    
    -- Provider
    provider VARCHAR(100) DEFAULT 'internal',
    model_path VARCHAR(500),
    
    -- Metrics
    metrics JSONB DEFAULT '{}',
    performance JSONB DEFAULT '{}',
    
    -- Configuration
    config JSONB DEFAULT '{}',
    hyperparameters JSONB DEFAULT '{}',
    
    -- Training
    training_data_range JSONB DEFAULT '{}',
    last_trained_at TIMESTAMPTZ,
    training_duration_seconds INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deployed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ml_models_type ON public.ml_models(type);
CREATE INDEX IF NOT EXISTS idx_ml_models_status ON public.ml_models(status);
CREATE INDEX IF NOT EXISTS idx_ml_models_version ON public.ml_models(name, version);

-- RLS
ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read models"
    ON public.ml_models FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow service role to manage models"
    ON public.ml_models FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER ml_models_updated_at
    BEFORE UPDATE ON public.ml_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.ml_models IS 'ML model configurations and versions';
```

---

### 1.5 integrations Table

**File:** `supabase/migrations/023_create_integrations.sql`

**Purpose:** Store external integrations configuration

**Schema:**

```sql
-- Integrations table for external system connections
CREATE TABLE IF NOT EXISTS public.integrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL
        CHECK (type IN ('POS', 'ACCOUNTING', 'INVENTORY', 'HR', 'CRM', 'WEBHOOK', 'SLACK', 'EMAIL', 'SMS')),
    description TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED'
        CHECK (status IN ('CONNECTED', 'DISCONNECTED', 'ERROR', 'PENDING')),
    
    -- Configuration
    config JSONB DEFAULT '{}',
    credentials JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Sync Status
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(20),
    last_sync_error TEXT,
    sync_interval_minutes INTEGER DEFAULT 60,
    
    -- Statistics
    stats JSONB DEFAULT '{"records_synced": 0, "last_record_count": 0}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integrations_type ON public.integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON public.integrations(status);

-- RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read integrations"
    ON public.integrations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow service role to manage integrations"
    ON public.integrations FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER integrations_updated_at
    BEFORE UPDATE ON public.integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.integrations IS 'External system integrations';
```

---

## Phase 2: Seed Data

### 2.1 Seed cases

**File:** `supabase/migrations/024_seed_cases.sql`

**SQL:**

```sql
-- Seed cases from existing alerts
INSERT INTO public.cases (alert_id, outlet_id, region_id, title, description, status, priority, type, created_at)
SELECT 
    a.id,
    a.outlet_id,
    o.region_id,
    COALESCE(a.title, CONCAT(a.type, ' Alert for Outlet ', o.name)),
    COALESCE(a.description, CONCAT('Auto-generated case from alert: ', a.type)),
    CASE 
        WHEN a.status = 'RESOLVED' THEN 'RESOLVED'
        WHEN a.status = 'INVESTIGATING' THEN 'IN_PROGRESS'
        ELSE 'OPEN'
    END,
    COALESCE(a.severity, 'P2_MEDIUM'),
    'ALERT_CASE',
    a.created_at
FROM public.alerts a
LEFT JOIN public.outlets o ON a.outlet_id = o.id
WHERE a.id IN (SELECT DISTINCT alert_id FROM public.cases WHERE alert_id IS NOT NULL);

-- Add sample cases
INSERT INTO public.cases (outlet_id, region_id, title, description, status, priority, type, assignee_name)
SELECT 
    o.id,
    o.region_id,
    'Investigate low sales performance',
    'Sales are 15% below target for this week. Please investigate and provide action plan.',
    'OPEN',
    'P1_HIGH',
    'TASK',
    'Regional Manager'
FROM public.outlets o
WHERE o.status = 'ACTIVE'
LIMIT 5;

SELECT COUNT(*) as total_cases FROM public.cases;
```

---

### 2.2 Seed ai_agents

**File:** `supabase/migrations/025_seed_ai_agents.sql`

**SQL:**

```sql
-- Seed AI Agents
INSERT INTO public.ai_agents (name, description, type, status, config, capabilities, stats) VALUES
('Alert Router', 'Routes incoming alerts to appropriate handlers based on type and severity', 'ROUTING', 'ACTIVE',
 '{"rules": [{"type": "SALES_ANOMALY", "route_to": "regional_manager"}, {"type": "STOCKOUT", "route_to": "inventory_manager"}]}',
 '["route_alerts", "classify_severity", "assign_priority"]',
 '{"total_cases": 156, "avg_resolution_time": 45}'),

('Stockout Notifier', 'Monitors inventory levels and creates alerts for low stock situations', 'NOTIFICATION', 'ACTIVE',
 '{"threshold": {"min_stock_percent": 20}, "notification_channels": ["slack", "email"]}',
 '["monitor_inventory", "create_alerts", "send_notifications"]',
 '{"total_cases": 89, "avg_resolution_time": 12}'),

('SLA Monitor', 'Tracks case resolution times and escalates overdue cases', 'ESCALATION', 'ACTIVE',
 '{"sla": {"P0": 60, "P1": 240, "P2": 1440}, "escalate_to": "hq_admin"}',
 '["track_sla", "escalate_cases", "send_reminders"]',
 '{"total_cases": 34, "avg_resolution_time": 0}'),

('Sales Analyst', 'Analyzes sales patterns and identifies anomalies in real-time', 'ANALYSIS', 'ACTIVE',
 '{"model": "anomaly_detection_v2", "threshold": 0.7}',
 '["analyze_sales", "detect_anomalies", "generate_insights"]',
 '{"total_cases": 201, "avg_resolution_time": 5}'),

('Demand Forecaster', 'Predicts product demand to optimize inventory levels', 'AUTOMATION', 'ACTIVE',
 '{"horizon_days": 7, "confidence_level": 0.95}',
 '["forecast_demand", "optimize_inventory", "suggest_orders"]',
 '{"total_cases": 67, "avg_resolution_time": 30}'),

('Onboarding Assistant', 'Helps new franchisees with initial setup and training', 'AUTOMATION', 'ACTIVE',
 '{"checklist": ["setup_pos", "configure_inventory", "train_staff", "test_integration"]}',
 '["guide_setup", "provide_training", "check_progress"]',
 '{"total_cases": 12, "avg_resolution_time": 120}');

SELECT COUNT(*) as total_agents FROM public.ai_agents;
```

---

### 2.3 Seed staff

**File:** `supabase/migrations/026_seed_staff.sql`

**SQL:**

```sql
-- Seed Staff for each outlet
DO $$
DECLARE
    outlet_rec RECORD;
    staff_names TEXT[];
    staff_roles TEXT[];
BEGIN
    staff_names := ARRAY['Budi Santoso', 'Siti Rahayu', 'Ahmad Fauzi', 'Dewi Lestari', 'Rudi Hermawan', 
                          'Putri Ayu', 'Joko Widodo', 'Ani Susilowati', 'Dedi Kurniawan', 'Rina Melani'];
    staff_roles := ARRAY['MANAGER', 'CASHIER', 'COOK', 'WAITER'];
    
    FOR outlet_rec IN SELECT id, region_id FROM public.outlets WHERE status IN ('ACTIVE', 'PILOT')
    LOOP
        -- Manager
        INSERT INTO public.staff (name, role, outlet_id, region_id, email, phone, status, hire_date)
        VALUES (
            staff_names[1 + floor(random() * 10)::int],
            'MANAGER',
            outlet_rec.id,
            outlet_rec.region_id,
            CONCAT('manager_', outlet_rec.id, '@franchise.com'),
            '+6281' || floor(random() * 9000000000 + 1000000000)::bigint,
            'ACTIVE',
            CURRENT_DATE - floor(random() * 730)::int
        );
        
        -- 2-4 Staff per outlet
        FOR i IN 1..(2 + floor(random() * 3))::int LOOP
            INSERT INTO public.staff (name, role, outlet_id, region_id, email, phone, status, hire_date)
            VALUES (
                staff_names[1 + floor(random() * 10)::int],
                staff_roles[2 + floor(random() * 3)::int],
                outlet_rec.id,
                outlet_rec.region_id,
                CONCAT('staff_', outlet_rec.id, '_', i, '@franchise.com'),
                '+6281' || floor(random() * 9000000000 + 1000000000)::bigint,
                CASE WHEN random() < 0.1 THEN 'OFF_DUTY' ELSE 'ACTIVE' END,
                CURRENT_DATE - floor(random() * 365)::int
            );
        END LOOP;
    END LOOP;
END $$;

SELECT 
    COUNT(*) as total_staff,
    COUNT(DISTINCT outlet_id) as outlets_with_staff
FROM public.staff;
```

---

### 2.4 Seed ml_models

**File:** `supabase/migrations/027_seed_ml_models.sql`

**SQL:**

```sql
-- Seed ML Models
INSERT INTO public.ml_models (name, description, type, version, status, provider, metrics, performance, config, deployed_at) VALUES
('Anomaly Detection v2', 'Z-score based anomaly detection for sales data', 'ANOMALY_DETECTION', 'v2.1', 'PRODUCTION', 'internal',
 '{"accuracy": 0.89, "precision": 0.92, "recall": 0.85, "f1": 0.88}',
 '{"avg_z_score": 0.3, "anomalies_detected": 234, "false_positives": 12}',
 '{"window_size": 7, "threshold": 2.5, "min_data_points": 30}',
 '2026-06-15 10:00:00'),

('Stockout Risk Model', 'Random Forest based stockout prediction', 'STOCKOUT_PREDICTION', 'v1.3', 'PRODUCTION', 'internal',
 '{"accuracy": 0.91, "precision": 0.88, "recall": 0.93, "f1": 0.90}',
 '{"predictions_made": 1520, "stockouts_prevented": 89, "avg_lead_time_days": 3.2}',
 '{"model": "random_forest", "n_estimators": 100, "max_depth": 10}',
 '2026-07-01 08:00:00'),

('Demand Forecasting', 'Time series demand prediction using Prophet', 'DEMAND_FORECASTING', 'v1.0', 'PRODUCTION', 'prophet',
 '{"mape": 0.12, "mae": 150000, "rmse": 220000}',
 '{"forecasts_made": 456, "accuracy_7day": 0.88, "accuracy_14day": 0.82}',
 '{"horizon_days": 14, "seasonality": "multiplicative"}',
 '2026-06-20 14:00:00'),

('Churn Prediction', 'Customer churn prediction for outlet analysis', 'CHURN_PREDICTION', 'v0.9', 'STAGING', 'sklearn',
 '{"accuracy": 0.85, "precision": 0.82, "recall": 0.78, "f1": 0.80}',
 '{}',
 '{"model": "gradient_boosting", "n_estimators": 50}',
 NULL),

('Sales Trend Analysis', 'Moving average based sales trend analysis', 'ANOMALY_DETECTION', 'v1.5', 'RETIRED', 'internal',
 '{"accuracy": 0.75}',
 '{}',
 '{"window_days": 14, "trend_threshold": 0.15}',
 '2026-05-01 09:00:00');

SELECT COUNT(*) as total_models FROM public.ml_models;
```

---

### 2.5 Seed integrations

**File:** `supabase/migrations/028_seed_integrations.sql`

**SQL:**

```sql
-- Seed Integrations
INSERT INTO public.integrations (name, type, status, description, config, stats, last_sync_at) VALUES
('Aloha POS - Bandung Hub', 'POS', 'CONNECTED', 'Aloha POS integration for Bandung region outlets',
 '{"host": "pos-aloha-bdg.bandung.net", "port": 8080, "sync_interval": 30}',
 '{"records_synced": 15420, "last_record_count": 234}',
 NOW() - interval '1 hour'),

('SAP Accounting', 'ACCOUNTING', 'CONNECTED', 'SAP integration for financial reporting',
 '{"api_endpoint": "https://sap.cyberquote.com/api", "company_code": "ID01"}',
 '{"records_synced": 8920, "last_record_count": 45}',
 NOW() - interval '30 minutes'),

('Slack Notifications', 'SLACK', 'CONNECTED', 'Slack integration for alert notifications',
 '{"webhook_url": "https://hooks.slack.com/services/XXX", "channel": "#alerts"}',
 '{"notifications_sent": 2341}',
 NOW()),

('Email Notifications', 'EMAIL', 'CONNECTED', 'Email integration for daily reports',
 '{"smtp_host": "smtp.gmail.com", "from_address": "alerts@cyberquote.id"}',
 '{"emails_sent": 567, "last_record_count": 23}',
 NOW() - interval '2 hours'),

('Inventory Webhook', 'WEBHOOK', 'DISCONNECTED', 'Generic webhook for inventory updates',
 '{"url": "https://inventory.example.com/webhook", "secret": "***"}',
 '{"records_synced": 0}',
 NULL),

('HR System - Workday', 'HR', 'PENDING', 'Workday HR integration for staff management',
 '{"api_endpoint": "https://wd3.workday.com/ccx/api/v1/Cyberquote"}',
 '{"records_synced": 0}',
 NULL);

SELECT COUNT(*) as total_integrations, 
       COUNT(*) FILTER (WHERE status = 'CONNECTED') as connected
FROM public.integrations;
```

---

## Phase 3: Testing

### 3.1 Test Edge Functions

```bash
# Test agents-list
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/agents-list" \
  -H "Authorization: Bearer <anon_key>" | jq '.agents | length'

# Expected: 6 agents

# Test staff-list
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/staff-list" \
  -H "Authorization: Bearer <anon_key>" | jq '.staff | length'

# Expected: ~120 staff (24 outlets x 5 avg)

# Test ml-models-list
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-models-list" \
  -H "Authorization: Bearer <anon_key>" | jq '.models | length'

# Expected: 5 models
```

---

### 3.2 Test Components

| Component        | Test      | Expected             |
| ---------------- | --------- | -------------------- |
| Workflows.tsx    | Load page | Shows cases table    |
| Agents.tsx       | Load page | Shows 6 AI agents    |
| Workforce.tsx    | Load page | Shows staff list     |
| Models.tsx       | Load page | Shows 5 ML models    |
| Integrations.tsx | Load page | Shows 6 integrations |

---

### 3.3 E2E Verification

```
1. Login as steve.gilang@gmail.com
2. Navigate to Workflows
   - [ ] Cases table loads
   - [ ] Can view case details
   - [ ] Can change case status

3. Navigate to Agents
   - [ ] AI agents list loads
   - [ ] Shows 6 agents
   - [ ] Agent stats visible

4. Navigate to Workforce
   - [ ] Staff list loads
   - [ ] Can filter by outlet
   - [ ] Shows staff per outlet

5. Navigate to Models
   - [ ] ML models list loads
   - [ ] Shows 5 models
   - [ ] Model metrics visible

6. Navigate to Integrations
   - [ ] Integrations list loads
   - [ ] Shows 6 integrations
   - [ ] Status indicators work
```

---

## Phase 4: Documentation

### Update Gap Analysis

After implementation, update `docs/app-gap-analysis.md`:

- [ ] Mark all 5 tables as created
- [ ] Update component status to working
- [ ] Add test results

---

## File Checklist

| #  | File                        | Migration | Purpose            |
| -- | --------------------------- | --------- | ------------------ |
| 1  | 019_create_cases.sql        | ✅        | Cases table        |
| 2  | 020_create_ai_agents.sql    | ✅        | AI agents table    |
| 3  | 021_create_staff.sql        | ✅        | Staff table        |
| 4  | 022_create_ml_models.sql    | ✅        | ML models table    |
| 5  | 023_create_integrations.sql | ✅        | Integrations table |
| 6  | 024_seed_cases.sql          | ✅        | Seed cases         |
| 7  | 025_seed_ai_agents.sql      | ✅        | Seed AI agents     |
| 8  | 026_seed_staff.sql          | ✅        | Seed staff         |
| 9  | 027_seed_ml_models.sql      | ✅        | Seed ML models     |
| 10 | 028_seed_integrations.sql   | ✅        | Seed integrations  |

---

## Effort Estimate

| Phase     | Task                | Time        |
| --------- | ------------------- | ----------- |
| 1.1       | cases table         | 30 min      |
| 1.2       | ai_agents table     | 20 min      |
| 1.3       | staff table         | 20 min      |
| 1.4       | ml_models table     | 20 min      |
| 1.5       | integrations table  | 20 min      |
| 2.1-2.5   | Seed data           | 60 min      |
| 3.1       | Test edge functions | 30 min      |
| 3.2       | Test components     | 60 min      |
| 3.3       | E2E verification    | 30 min      |
| 4.1       | Documentation       | 30 min      |
| **Total** |                     | **8 hours** |

---

## Risks

| Risk                | Impact          | Mitigation                    |
| ------------------- | --------------- | ----------------------------- |
| Migration conflicts | Delay           | Run after existing migrations |
| RLS blocking access | Component fails | Test with service role first  |
| Data not seeding    | Empty tables    | Check foreign key constraints |

---

## Success Criteria

- [ ] All 5 tables created
- [ ] All seed data inserted
- [ ] All 5 components load correctly
- [ ] Edge functions return data
- [ ] No console errors
- [ ] RLS working correctly

---

**Implementation Ready - Awaiting Execution**
