# CQaiFranchise - Code vs Architecture Mapping

**Date:** August 21, 2026
**Updated based on:** Big Data Framework + Athena/Hermes Architecture Documents

---

## 7-Layer Architecture (Target)

| Layer | Name | Description |
|-------|------|-------------|
| L1 | Source Systems | POS, ERP, HR, external systems |
| L2 | Ingestion | Webhooks, CSV import, CDC |
| L3 | Data Platform | Supabase PostgreSQL + RLS |
| L4 | AI/ML Layer | Anomaly detection, stockout prediction |
| L5 | Hermes Agent | Triage, routing, explanation |
| L6 | Workflow Automation | Alert → Case → Resolution |
| L7 | Presentation | Dashboard, Chat, Alerts |

---

## Current Implementation Mapping

### L1: Source Systems

| Component | Status | Code Location |
|-----------|--------|---------------|
| POS Data | ✅ Simulated | `scripts/unified-pos-inventory.js` |
| POS Webhook | ✅ Working | `scripts/pos-simulator.py` |
| Bank Statements | ✅ DBS/OCBC/UOB parser | `supabase/functions/bank-statement-parse` |
| Financial Statements | ✅ AI-powered PDF | `supabase/functions/financial-statement-parse` |
| Cash Flow CSV | ✅ Upload | `src/components/CashFlowUpload.tsx` |
| Staff/HR | ❌ Missing | No integration |
| ERP | ❌ Future | Not in scope |
| IoT/Sensors | ❌ Future | Not in scope |

### L2: Ingestion

| Component | Status | Code Location |
|-----------|--------|---------------|
| POS Webhook | ✅ Working | `supabase/functions/pos-webhook` |
| CSV Import | ✅ Working | `supabase/functions/ingestion-csv` |
| PDF Parsing | ✅ Working | `supabase/functions/bank-statement-parse`, `financial-statement-parse` |
| Cash Flow Import | ✅ Working | `supabase/functions/cashflow-import` |
| CDC | ❌ Future | Not implemented |
| API Polling | ❌ Future | Not implemented |

### L3: Data Platform

| Table | Status | Purpose |
|-------|--------|---------|
| `sales_transactions` | ✅ | POS sales data |
| `inventory` | ✅ | Stock levels |
| `inventory_movements` | ✅ | Stock changes log |
| `outlets` | ✅ | Outlet master data |
| `regions` | ✅ | Region/country mapping |
| `outlet_features` | ✅ | Aggregated metrics for ML |
| `ml_anomaly_scores` | ✅ | Anomaly detection results |
| `ml_stockout_risk` | ✅ | Stockout predictions |
| `alerts` | ✅ | Alert system |
| `cases` | ✅ | Case management |
| `documents` | ✅ | Document storage |
| `regulatory_documents` | ✅ | Compliance docs |
| `royalty_payments` | ✅ | Royalty tracking |
| `debt_obligations` | ✅ | Debt tracking |
| `cash_flow_imports` | ✅ | Cash flow data |
| `financial_metrics_snapshot` | ✅ | Financial snapshots |
| `application_risk_scores` | ✅ | Credit risk scores |
| `financing_applications` | ✅ | Financing requests |
| `notifications` | ✅ | Alert notifications |
| `staff` | ✅ | Staff records |
| `workflow_instances` | ✅ | Workflow state |
| `workflow_steps` | ✅ | Workflow steps |
| `user_profiles` | ✅ | User/RBAC |
| `user_outlets` | ✅ | User-outlet mapping |
| `settings` | ✅ | Platform settings |
| `filing_links` | ✅ | SG/ID filing URLs |

**RLS (Row Level Security):** ✅ Implemented across all tables

### L4: AI/ML Layer

| Model | Status | Code Location |
|-------|--------|---------------|
| Z-Score Anomaly | ✅ | `supabase/functions/ml-anomaly-v2` |
| Stockout Prediction | ✅ | `supabase/functions/ml-stockout-v2` |
| Outlet Features | ✅ | `supabase/functions/mcp-tools` (outlet_features) |
| Credit Risk Score | ✅ | `src/components/Financing.tsx` (35/25/15/15/10) |
| Peer Benchmark | ✅ | `src/components/PeerBenchmark.tsx` |
| Demand Forecasting | ❌ Future | Not implemented |
| Fraud Detection | ❌ Future | Not implemented |
| Churn Prediction | ❌ Future | Not implemented |

### L5: Hermes Agent (AI Brain)

| Component | Status | Code Location |
|-----------|--------|---------------|
| Alert Triage | ⚠️ Partial | `supabase/functions/athena-case-triage` |
| Routing | ⚠️ Manual | Case routing not automated |
| Explanation (Athena Chat) | ✅ | `supabase/functions/athena-chat` |
| Notification Orchestration | ⚠️ Partial | `supabase/functions/notification-trigger` |
| SLA Monitoring | ❌ Missing | Not implemented |
| Human Approval | ❌ Missing | Approval workflow incomplete |

### L6: Workflow Automation

| Component | Status | Code Location |
|-----------|--------|---------------|
| Alert → Case | ✅ | `supabase/functions/case-create` |
| Case Assignment | ✅ | `supabase/functions/case-assigner` |
| Case Update | ✅ | `supabase/functions/case-update` |
| SLA Enforcement | ⚠️ Partial | `supabase/functions/sla-escalator` |
| Approval Routing | ⚠️ Partial | `supabase/functions/approvals` |
| Escalation | ⚠️ Partial | `supabase/functions/sla-escalator` |
| Audit Logging | ✅ | `ai_audit_log` table |
| Playbooks | ❌ Future | Not implemented |

### L7: Presentation

| Component | Status | Code Location |
|-----------|--------|---------------|
| Dashboard | ✅ | `src/components/Dashboard.tsx` |
| Alerts List | ✅ | `src/components/AlertsList.tsx` |
| Cases List | ✅ | `src/components/CasesList.tsx` |
| Athena Chat | ✅ | `src/components/AICopilot.tsx` |
| Document Vault | ✅ | `src/components/DocumentVault.tsx` |
| Financing | ✅ | `src/components/Financing.tsx` |
| Cash Flow | ✅ | `src/components/CashFlowDashboard.tsx` |
| Bank Statement Upload | ✅ | `src/components/BankStatementUpload.tsx` |
| Financial Statement Upload | ✅ | `src/components/FinancialStatementUpload.tsx` |
| Peer Benchmark | ✅ | `src/components/PeerBenchmark.tsx` |
| Role-based Views | ✅ | Layout based on user role |
| Mobile Alerts | ❌ Future | Not implemented |
| Scheduled Reports | ❌ Future | Not implemented |

---

## Completion Status

| Layer | Completion | Gap |
|-------|------------|-----|
| L1: Source Systems | 60% | Need real POS integration |
| L2: Ingestion | 70% | Need CDC, API polling |
| L3: Data Platform | 95% | Complete |
| L4: AI/ML | 75% | Need forecasting, fraud |
| L5: Hermes Agent | 35% | Need auto triage, SLA |
| L6: Workflow | 40% | Need playbooks, full approval |
| L7: Presentation | 85% | Need mobile, reports |

**Overall: ~60%** (vs Athena/Hermes 45% - we're ahead!)

---

## Gap Analysis: What's Missing

### Critical (P0)

| Gap | Layer | Impact |
|-----|-------|--------|
| Real POS Integration | L1-L2 | ML needs real data |
| Inventory Dashboard | L7 | Can't see stock levels |
| Auto Triage | L5 | Manual case assignment |
| Financing Gate | L7 | Compliance check |

### Important (P1)

| Gap | Layer | Impact |
|-----|-------|--------|
| Workflow Playbooks | L6 | No automated actions |
| SLA Automation | L5-L6 | Timers not enforced |
| Mobile Alerts | L7 | No push notifications |
| Reports | L7 | No scheduled reports |

### Nice-to-have (P2)

| Gap | Layer | Impact |
|-----|-------|--------|
| ERP Integration | L1 | Accounting data |
| HR Integration | L1 | Staff attendance |
| IoT Integration | L1 | Real-time sensors |
| Demand Forecasting | L4 | Better inventory |

---

## Data Flow (Current)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CURRENT DATA FLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  L1-L2: Ingestion                                                   │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│  │ POS Sim     │     │ CSV Upload  │     │ PDF Parse   │          │
│  │ (scripts/)  │     │ (CashFlow)  │     │ (BankStmt) │          │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘          │
│         │                   │                   │                   │
│         └───────────────────┼───────────────────┘                   │
│                             ▼                                       │
│                    ┌─────────────────┐                              │
│                    │  pos-webhook   │                              │
│                    │  cashflow-     │                              │
│                    │  import        │                              │
│                    └────────┬────────┘                              │
│                             │                                       │
│  L3: Data Platform        ▼                                       │
│  ┌─────────────────────────────────────────┐                      │
│  │  sales_transactions  │  cash_flow_imports  │                   │
│  │  inventory           │  financial_metrics  │                   │
│  │  royalty_payments    │  debt_obligations   │                   │
│  └─────────────────────────────────────────┘                      │
│                             │                                       │
│  L4: AI/ML                ▼                                       │
│  ┌─────────────────────────────────────────┐                      │
│  │  ml-anomaly-v2    → anomaly_scores      │                      │
│  │  ml-stockout-v2   → stockout_risk       │                      │
│  │  outlet_features  → aggregated metrics   │                      │
│  └─────────────────────────────────────────┘                      │
│                             │                                       │
│  L5-L6: Agent + Workflow ▼                                       │
│  ┌─────────────────────────────────────────┐                      │
│  │  athena-chat     → AI explanations      │                      │
│  │  alert-generator → alerts               │                      │
│  │  case-create     → cases                │                      │
│  └─────────────────────────────────────────┘                      │
│                             │                                       │
│  L7: Presentation         ▼                                       │
│  ┌─────────────────────────────────────────┐                      │
│  │  Dashboard       → KPIs, charts         │                      │
│  │  AlertsList      → Alert queue          │                      │
│  │  CasesList       → Case management      │                      │
│  │  AICopilot       → Athena chat           │                      │
│  │  Financing       → Loan applications     │                      │
│  └─────────────────────────────────────────┘                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What's Working Well

| Component | Why It's Good |
|-----------|---------------|
| POS Webhook | Real-time, validated, HMAC secured |
| CSV/PDF Parsing | Multi-format support (DBS/OCBC/UOB) |
| Database Schema | Complete, RLS enforced |
| ML Models | Z-score anomaly, LSTM stockout |
| Dashboard | Real-time data, role-based |
| Athena Chat | Natural language queries |

---

## What Needs Work

| Priority | Component | Action |
|----------|-----------|--------|
| 1 | Inventory Dashboard | Build `InventoryDashboard.tsx` |
| 2 | Real POS Integration | Partner with POS vendor (Moka/GoFood) |
| 3 | Workflow Playbooks | Define + implement automated actions |
| 4 | Auto Triage | Build `auto-triage` edge function |
| 5 | SLA Enforcement | Improve `sla-escalator` |

---

## Next Sprint Recommendations

```
┌─────────────────────────────────────────────────────────┐
│                    NEXT SPRINT                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Inventory Dashboard (L7)                           │
│     • Stock levels per outlet                           │
│     • Low stock alerts                                 │
│     • Restock recommendations                          │
│                                                          │
│  2. Real POS Pilot (L1-L2)                            │
│     • Partner with 1 SG franchisee                     │
│     • Connect real POS data                            │
│     • Validate ML models                               │
│                                                          │
│  3. Workflow Playbooks (L6)                            │
│     • Define playbook templates                       │
│     • Implement automated actions                      │
│     • Add approval gates                               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

**Document Ends**
