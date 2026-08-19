# 🚀 CyberQuote Franchise Financing — Credit Assessment Implementation Plan

**Document Reference:** CyberQuote_Franchise_Financing_Credit_Assessment_Overview.docx  
**Created:** August 19, 2026  
**Status:** Draft for Review

---

## 📋 Executive Summary

Platform CQaiFranchise saat ini memiliki **infrastruktur dasar** untuk Bridge Financing:
- POS transactions: 100K+ rows (real-time ✅)
- Revenue data: `outlet_features` table ✅
- Financing applications: 9 applications dengan berbagai status ✅
- Financing UI: Tab exists with applications, repayments, risk sections ✅

**Gap Analysis:**
| Feature | Status | Priority |
|---------|--------|----------|
| Risk Score Calculation | ⚠️ UI exists, scores EMPTY | P0 |
| POS Data | ✅ Complete | - |
| Cash Flow (Revenue) | ✅ Available | - |
| Bank Cash Flow (Open Banking) | ❌ Missing | P2 |
| Royalty/Fee Payment Tracking | ❌ Missing | P1 |
| Compliance/Audit Scores | ❌ Missing | P2 |
| Debt Obligations | ❌ Missing | P1 |
| Credit Bureau API | ❌ Missing | P3 |
| Financial Statements Upload | ⚠️ Document Vault exists | P2 |

---

## 🎯 Risk Score Model (Per Document)

### Scoring Formula
```
Overall Risk Score = Σ (Sub-score × Weight)

Risk Bands:
- LOW:      0-29  (Score 70-100)
- MEDIUM:  30-59  (Score 40-69)
- HIGH:    60-79  (Score 20-39)
- WATCH:   80-100 (Score 0-19)
```

### Risk Drivers & Weightage

| Driver | Weight | Data Source | Current Status |
|--------|--------|------------|----------------|
| **Payment Behaviour** | 35% | repayment_events | ✅ 3 rows, need scoring |
| **Cash Flow Stability** | 25% | outlet_features.revenue_* | ✅ Data exists |
| **Franchisor Performance** | 15% | compliance/audit scores | ❌ Not tracked |
| **Leverage/Debt Burden** | 15% | debt obligations | ❌ Not tracked |
| **Credit Bureau Score** | 10% | External API | ❌ No integration |

---

## 🗃️ Required Data Sources

### Phase 1 (MVP) — Available Now
```sql
-- Already in platform
sales_transactions     -- POS data
outlet_features        -- Revenue metrics  
financing_applications -- Loan applications
repayment_events       -- Payment history
```

### Phase 2 — Need Integration
```sql
-- Bank cash flow (Open Banking)
CREATE TABLE public.bank_transactions (
    id UUID PRIMARY KEY,
    franchisee_id UUID REFERENCES user_profiles(id),
    outlet_id INTEGER REFERENCES outlets(id),
    transaction_date DATE,
    amount DECIMAL(12,2),
    category VARCHAR(50),
    balance DECIMAL(12,2),
    source VARCHAR(20), -- 'openbanking', 'manual'
    fetched_at TIMESTAMPTZ
);

-- Royalty/Fee payments
CREATE TABLE public.royalty_payments (
    id UUID PRIMARY KEY,
    franchisee_id UUID REFERENCES user_profiles(id),
    outlet_id INTEGER REFERENCES outlets(id),
    payment_date DATE,
    amount DECIMAL(12,2),
    currency VARCHAR(3),
    status VARCHAR(20), -- 'ON_TIME', 'LATE', 'MISSED'
    days_past_due INTEGER,
    period VARCHAR(10) -- '2026-08'
);

-- Compliance/Audit scores
CREATE TABLE public.audit_scores (
    id UUID PRIMARY KEY,
    outlet_id INTEGER REFERENCES outlets(id),
    audit_date DATE,
    overall_score DECIMAL(5,2),
    category_scores JSONB,
    auditor VARCHAR(100),
    findings TEXT
);

-- Debt obligations
CREATE TABLE public.debt_obligations (
    id UUID PRIMARY KEY,
    franchisee_id UUID REFERENCES user_profiles(id),
    creditor_name VARCHAR(100),
    outstanding_amount DECIMAL(12,2),
    monthly_payment DECIMAL(12,2),
    interest_rate DECIMAL(5,2),
    maturity_date DATE,
    status VARCHAR(20)
);
```

---

## 🔌 Required API Integrations

| API | Provider | Purpose | Priority |
|-----|----------|---------|----------|
| Open Banking | Plaid / Stripe | Bank cash flow data | P2 |
| Credit Bureau SG | Experian / CB SG | Credit scoring | P3 |
| Accounting Software | Xero / QuickBooks | Financial statements | P3 |
| Payment Gateway | Stripe / PayNow | Royalty payments | P1 |

---

## 📅 Implementation Phases

### PHASE 1: MVP (4-6 Weeks) — Demo Ready

| # | Feature | Effort | Priority | Technical Notes |
|---|---------|--------|---------|----------------|
| 1.1 | **Risk Score Calculation Engine** | 1 week | P0 | `repayment-risk-scorer` exists, needs data |
| 1.2 | **Generate Risk Scores for Existing Apps** | 2 days | P0 | Batch job to calculate 9 applications |
| 1.3 | **Seed Sample Repayment Data** | 3 days | P0 | 50+ events with varying payment patterns |
| 1.4 | **Enhance Risk Dashboard UI** | 1 week | P1 | Show 5 drivers with weights, bands |
| 1.5 | **Royalty Payment Tracking Table** | 1 week | P1 | Basic INSERT/UPDATE for demo |
| 1.6 | **Payment Behaviour Sub-score** | 1 week | P1 | Calculate from repayment_events |

**Phase 1 Deliverables:**
- ✅ Risk Score visible per application
- ✅ 5-driver breakdown (even if some are placeholder)
- ✅ LOW/MEDIUM/HIGH/WATCH status badges
- ✅ Sample data for demo walkthrough

### PHASE 2: Full Implementation (3-6 Months)

| # | Feature | Effort | Priority | Technical Notes |
|---|---------|--------|---------|----------------|
| 2.1 | **Open Banking Integration** | 8 weeks | P2 | Plaid API → bank_transactions |
| 2.2 | **Cash Flow Stability Sub-score** | 2 weeks | P2 | Calculate from bank + POS |
| 2.3 | **Debt Burden Tracking** | 4 weeks | P1 | debt_obligations table + UI |
| 2.4 | **Compliance Audit System** | 6 weeks | P2 | audit_scores table + workflow |
| 2.5 | **Credit Bureau API** | 4 weeks | P3 | Experian/CB SG integration |
| 2.6 | **Financial Statements Upload** | 3 weeks | P2 | Document Vault integration |
| 2.7 | **Real-time Risk Monitoring** | 4 weeks | P2 | Cron job → daily score refresh |
| 2.8 | **Alerting on Risk Changes** | 2 weeks | P2 | Notification system |

**Phase 2 Deliverables:**
- Full 5-driver risk model with real data
- Open banking → daily cash flow analysis
- Credit bureau score integration
- Compliance dashboard
- Automated risk alerts

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CYBERQUOTE FRANCHISE                       │
│                   CREDIT ASSESSMENT FLOW                      │
└─────────────────────────────────────────────────────────────┘

DATA SOURCES:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ POS System   │  │ Open Banking │  │ Franchisor   │
│ (Real-time)  │  │ (Plaid API)  │  │ ERP          │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  sales_transactions  │  bank_transactions  │  royalty_payments │
│  outlet_features     │  audit_scores      │  debt_obligations │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 RISK CALCULATION ENGINE                      │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Payment (35%)│  │ CashFlow(25%)│ │ Franchisor(15%)│     │
│  │             │  │             │  │             │          │
│  │ - on_time%  │  │ - revenue_var│  │ - audit_score│         │
│  │ - days_past │  │ - trend     │  │ - benchmark  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │ Leverage(15%)│  │ Credit(10%) │                           │
│  │             │  │             │                           │
│  │ - debt/rev  │  │ - bureau   │                           │
│  │ - utilization│ │ - score    │                           │
│  └─────────────┘  └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    RISK SCORE OUTPUT                         │
│                                                              │
│  overall_risk_score: 0-100                                   │
│  risk_level: LOW | MEDIUM | HIGH | WATCH                     │
│  risk_factors: ["High leverage", "Late payments"]            │
│  recomputed_at: TIMESTAMPTZ                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      UI LAYER                                 │
│                                                              │
│  Financing.tsx → Risk Tab                                    │
│  - Score gauge (0-100)                                       │
│  - 5-driver breakdown with bars                              │
│  - Risk band badge                                           │
│  - Factors list                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Edge Functions Required

### Phase 1
```typescript
// 1. Calculate risk score (extend existing)
supabase/functions/
├── repayment-risk-scorer/     // EXISTS, needs enhancement
│   └── index.ts               // Add 4 more drivers
├── risk-score-batch/          // NEW: Batch calculate for all apps
│   └── index.ts               // Cron job: daily refresh
└── risk-score-get/            // NEW: Get score for one application
    └── index.ts
```

### Phase 2
```typescript
// 2. Open banking integration
├── openbanking-webhook/       // NEW: Receive Plaid webhooks
│   └── index.ts
├── bank-transactions-sync/    // NEW: Sync transactions
│   └── index.ts
└── credit-bureau-pull/        // NEW: Pull credit score
    └── index.ts
```

---

## 💾 Database Schema Changes

### Phase 1 (MVP)
```sql
-- Risk scores table (already partially exists)
CREATE TABLE public.financing_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES financing_applications(id),
    overall_risk_score DECIMAL(5,2),
    risk_level VARCHAR(20), -- 'LOW', 'MEDIUM', 'HIGH', 'WATCH'
    payment_timing_score DECIMAL(5,2),
    cash_flow_score DECIMAL(5,2),
    franchisor_score DECIMAL(5,2),
    leverage_score DECIMAL(5,2),
    credit_bureau_score DECIMAL(5,2),
    risk_factors JSONB DEFAULT '[]',
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(application_id)
);

-- Royalty payments (basic tracking)
CREATE TABLE public.royalty_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchisee_id UUID REFERENCES user_profiles(id),
    outlet_id INTEGER REFERENCES outlets(id),
    payment_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'SGD',
    status VARCHAR(20) DEFAULT 'ON_TIME', -- 'ON_TIME', 'LATE', 'MISSED'
    days_past_due INTEGER DEFAULT 0,
    period VARCHAR(10), -- '2026-08'
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 2
```sql
-- Add to existing tables
ALTER TABLE public.outlet_features ADD COLUMN IF NOT EXISTS audit_score DECIMAL(5,2);
ALTER TABLE public.outlet_features ADD COLUMN IF NOT EXISTS benchmark_rank INTEGER;

CREATE TABLE public.bank_transactions (...);
CREATE TABLE public.debt_obligations (...);
CREATE TABLE public.audit_scores (...);
```

---

## ✅ Action Items

### Immediate (This Week)
- [ ] Generate risk scores for 9 existing applications
- [ ] Seed 50+ sample repayment events
- [ ] Test Financing UI with Alice (Outlet 200)
- [ ] Verify regional@test.com sees cases after auth fix

### Phase 1 (4-6 weeks)
- [ ] Enhance repayment-risk-scorer with 5 drivers
- [ ] Create risk-score-batch edge function
- [ ] Add royalty_payments table
- [ ] Build payment behaviour sub-score
- [ ] UI: Show 5-driver breakdown

### Phase 2 (3-6 months)
- [ ] Open Banking (Plaid) integration
- [ ] Credit Bureau API
- [ ] Compliance Audit system
- [ ] Debt tracking
- [ ] Financial statements upload

---

## 📈 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Risk scores calculated | 100% of applications | Count / Total |
| Demo readiness | All 5 drivers show data | UI verification |
| Processing time | < 5 seconds per app | Edge function logs |
| Data refresh | Daily (cron) | Schedule verification |

---

**Prepared by:** AIFrCQ Team  
**Next Review:** August 26, 2026
