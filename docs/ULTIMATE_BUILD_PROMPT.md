# CYBERQUOTE - ULTIMATE BUILD PROMPT
## AI-Powered Franchise Monitoring Platform on Supabase

---

## 🎯 PROJECT OVERVIEW

**CyberQuote** adalah platform AI untuk monitoring 30+ franchise outlets di Indonesia.

**Tech Stack:**
- **Backend:** Supabase (PostgreSQL + Edge Functions + Auth + RLS)
- **Frontend:** React + Vite + TypeScript + TailwindCSS
- **AI/ML:** Z-Score Anomaly Detection + Stockout Prediction
- **Notifications:** WhatsApp (via Fonnte/Nurisms)

---

## 📊 COMPLETE DATABASE SCHEMA

### 1. CORE TABLES

```sql
-- Regions
CREATE TABLE regions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outlets
CREATE TABLE outlets (
  id SERIAL PRIMARY KEY,
  region_id INTEGER REFERENCES regions(id),
  franchisee_id UUID REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, PILOT, INACTIVE
  daily_target DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email VARCHAR(255),
  full_name VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL, -- HQ_ADMIN, REGIONAL_MANAGER, FRANCHISEE_OWNER, OUTLET_STAFF
  region_id INTEGER REFERENCES regions(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Transactions
CREATE TABLE sales_transactions (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER REFERENCES outlets(id),
  date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_count INTEGER DEFAULT 1,
  hour INTEGER,
  day_of_week INTEGER,
  anomaly_score DECIMAL(5,4),
  is_anomaly BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Items
CREATE TABLE inventory_items (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER REFERENCES outlets(id),
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  current_stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 10,
  unit VARCHAR(50) DEFAULT 'pcs',
  avg_daily_sales DECIMAL(10,2) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER REFERENCES outlets(id),
  type VARCHAR(50) NOT NULL, -- SALES_ANOMALY, STOCKOUT_RISK, ATTENDANCE_ISSUE, COMPLAINT
  severity VARCHAR(20) NOT NULL, -- P0_CRITICAL, P1_HIGH, P2_MEDIUM, P3_LOW
  status VARCHAR(50) DEFAULT 'NEW', -- NEW, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED
  title VARCHAR(255) NOT NULL,
  description TEXT,
  score DECIMAL(5,4),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cases (for alert tracking)
CREATE TABLE cases (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER REFERENCES alerts(id),
  assigned_to_id UUID REFERENCES auth.users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'P2_MEDIUM',
  status VARCHAR(50) DEFAULT 'OPEN',
  sla_deadline TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Log
CREATE TABLE notification_logs (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER REFERENCES alerts(id),
  channel VARCHAR(20) NOT NULL, -- WHATSAPP, EMAIL, PUSH
  recipient VARCHAR(255),
  status VARCHAR(50) DEFAULT 'PENDING',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id INTEGER,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔐 RLS POLICIES (Row Level Security)

```sql
-- Enable RLS on all tables
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- HQ_ADMIN: can see all
CREATE POLICY "HQ can view all" ON outlets FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'role' = 'HQ_ADMIN' OR auth.jwt() ->> 'role' = 'service_role');

-- REGIONAL_MANAGER: can see own region
CREATE POLICY "Regional can view own" ON outlets FOR SELECT TO authenticated
  USING (
    region_id IN (
      SELECT region_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- FRANCHISEE: can see own outlets
CREATE POLICY "Franchisee can view own" ON outlets FOR SELECT TO authenticated
  USING (franchisee_id = auth.uid());

-- Service role: full access
CREATE POLICY "Service role full access" ON outlets FOR ALL TO service_role USING (true);
```

---

## ⚡ EDGE FUNCTIONS (Deno/TypeScript)

### 1. alerts-list
```typescript
// GET /functions/v1/alerts-list
// Returns alerts with outlet/region info, filtered by user role
```

### 2. alert-update
```typescript
// PATCH /functions/v1/alert-update
// Update alert status: ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED
```

### 3. case-create
```typescript
// POST /functions/v1/case-create
// Create case from alert
```

### 4. ml-anomaly-score
```typescript
// POST /functions/v1/ml-anomaly-score
// Input: { outlet_id, current_sales, hour, day_of_week }
// Output: { score, is_anomaly, threshold, avg, std_dev, z_score }
// Algorithm: Z-Score with rolling mean/std from last 30 days
```

### 5. ml-stockout-risk
```typescript
// POST /functions/v1/ml-stockout-risk
// Input: { outlet_id, sku, current_stock, avg_daily_sales, lead_time_days }
// Output: { days_remaining, risk_score, is_at_risk }
// Algorithm: Simple (current_stock / avg_daily_sales) vs lead_time_days
```

### 6. ml-batch-score
```typescript
// POST /functions/v1/ml-batch-score
// Batch scoring for all outlets at once
// Cron job-friendly
```

### 7. ingestion-webhook
```typescript
// POST /functions/v1/ingestion-webhook
// POS data ingestion endpoint
// Input: { outlet_id, date, sales_data[] }
// Auth: API Key or JWT
```

### 8. ingestion-csv
```typescript
// POST /functions/v1/ingestion-csv
// CSV file upload processing
// Returns: { imported: number, failed: number, errors: [] }
```

### 9. notification-send
```typescript
// POST /functions/v1/notification-send
// Input: { alert_id, channel: 'WHATSAPP' | 'EMAIL' | 'ALL' }
// Sends via Fonnte WhatsApp API or Supabase Email
```

### 10. pilot-dashboard
```typescript
// GET /functions/v1/pilot-dashboard
// Pilot program metrics and outreach tracking
```

---

## 🔄 DAILY CRON JOBS (pg_cron)

```sql
-- Run ML scoring every day at 6 AM
SELECT cron.schedule(
  'ml-daily-scoring',
  '0 6 * * *',
  $$
    SELECT net.http_post(
      url:='https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-batch-score',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <service_role_key>"}'::jsonb,
      body:=jsonb_build_object('scoring_type', 'anomaly')
    );
  $$
);

-- Run stockout check every 4 hours
SELECT cron.schedule(
  'stockout-check',
  '0 */4 * * *',
  $$
    SELECT net.http_post(
      url:='https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-batch-score',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <service_role_key>"}'::jsonb,
      body:=jsonb_build_object('scoring_type', 'stockout')
    );
  $$
);
```

---

## 📱 FRONTEND STRUCTURE (React)

```
src/
├── lib/
│   └── supabase.ts          # Supabase client
├── components/
│   ├── Layout.tsx           # Main layout with sidebar
│   ├── Dashboard.tsx        # Dashboard with KPIs
│   ├── Outlets.tsx          # Outlet management
│   ├── Workforce.tsx        # Staff management
│   ├── Workflows.tsx         # Workflow automation
│   ├── Agents.tsx            # AI agents config
│   ├── Integrations.tsx      # POS integrations
│   ├── Models.tsx           # ML models config
│   ├── AlertsList.tsx       # Alert list component
│   ├── Login.tsx             # Login page
│   └── Settings.tsx          # Settings page
├── hooks/
│   └── useAuth.ts           # Auth hook
└── App.tsx                  # Main app with routing
```

### Supabase Client Setup
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
})
```

### Environment Variables
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🚀 DEPLOYMENT CHECKLIST

### 1. Supabase Project Setup
- [ ] Create project at supabase.com
- [ ] Enable Email Auth in Authentication settings
- [ ] Configure SMTP for emails (optional)
- [ ] Get anon key and service role key

### 2. Database Setup
- [ ] Run all migrations in order
- [ ] Verify RLS policies
- [ ] Insert initial regions data

### 3. Edge Functions
- [ ] Deploy all 10 functions
- [ ] Set environment secrets
- [ ] Test each function

### 4. Frontend
- [ ] `npm install @supabase/supabase-js react-router-dom`
- [ ] Configure .env.local
- [ ] Build: `npm run build`
- [ ] Deploy to Vercel/Netlify

### 5. Monitoring
- [ ] Setup pg_cron jobs
- [ ] Configure logging
- [ ] Setup error tracking

---

## 📋 PILOT PROGRAM SETUP

### Outreach Pipeline
```
CONTACTED → DEMO_SCHEDULED → DEMO_COMPLETED → AGREEMENT_SIGNED → ONBOARDED
```

### Pilot Agreement Template
```markdown
PILOT AGREEMENT - CyberQuote

Outlet: [Name]
Contact: [Name, Phone]
Duration: 1 month free
Included:
- AI Anomaly Detection
- Stockout Prediction
- WhatsApp Notifications
- Dashboard Access

Terms:
- Data usage for improvement
- Bi-weekly feedback session
- Option to continue subscription
```

---

## 🔑 API ENDPOINTS SUMMARY

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/v1/token?grant_type=password` | POST | None | Login |
| `/auth/v1/signup` | POST | None | Register |
| `/rest/v1/outlets` | GET/POST | JWT | Manage outlets |
| `/rest/v1/alerts` | GET/PATCH | JWT | Manage alerts |
| `/rest/v1/sales_transactions` | GET/POST | JWT | Sales data |
| `/functions/v1/alerts-list` | GET | JWT | List alerts with joins |
| `/functions/v1/ml-anomaly-score` | POST | JWT | Anomaly detection |
| `/functions/v1/ml-stockout-risk` | POST | JWT | Stockout prediction |
| `/functions/v1/ingestion-webhook` | POST | API Key | POS data ingestion |
| `/functions/v1/notification-send` | POST | JWT | Send notifications |

---

## 💰 COST ESTIMATION (Supabase)

| Resource | Free Tier | Pro ($25/mo) |
|----------|-----------|--------------|
| Database | 500MB | 8GB |
| API Requests | 60K/day | Unlimited |
| Edge Functions | 2 concurrent | 10 concurrent |
| Auth Users | Unlimited | Unlimited |
| File Storage | 1GB | 100GB |

---

## 🎯 SUCCESS METRICS

| Metric | Target | Current |
|--------|--------|---------|
| Pilot Conversion | 80% (3/3) | 0% |
| Alert Detection | < 1 hour | - |
| False Positive Rate | < 10% | - |
| User Retention | > 80% | - |
| Daily Active Users | 100% | - |

---

## 📞 SUPPORT

- **Email:** support@cyberquote.id
- **WhatsApp:** +62-xxx-xxxx-xxxx
- **Docs:** https://docs.cyberquote.id

---

## 🔧 QUICK START COMMANDS

```bash
# Clone and setup
git clone <repo>
cd unified-ai-CQ
npm install

# Supabase CLI
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>

# Deploy migrations
supabase db push

# Deploy functions
supabase functions deploy

# Run locally
npm run dev
```

---

*Last Updated: July 13, 2026*
*Version: 1.0.0*
