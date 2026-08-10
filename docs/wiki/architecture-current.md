# Architecture Document — CQaiFranchise
**Project:** AI Franchise CyberQuote
**Owner:** Stefanus Gilang Chresna
**Version:** 2.0
**Date:** 11 August 2026
**Status:** Live — Active Development

---

## 1. Executive Summary

Platform monitoring franchise operations dengan AI-driven anomaly detection dan automated workflow. Built on Supabase + Vercel + Claude via Bluepack.

**Overall Completion:** ~55% terhadap 7-layer blueprint (up from 45% on July 30)

| Layer | Name | Completion | Trend |
|-------|------|-----------|-------|
| L1 | Source Systems | 60% | ↑ |
| L2 | Ingestion | 80% | — |
| L3 | Data Platform | 90% | ↑ |
| L4 | AI/ML Layer | 55% | ↑ |
| **L5** | **Hermes Agent** | **40%** | **↑ NEW FOCUS** |
| L6 | Workflow Automation | 35% | ↑ |
| L7 | Presentation | 85% | ↑ |

**Status Change Since v1.0 (July 30):**
- ✅ Fixed chart to use real `daily_breakdown` data
- ✅ Connected `agent-orchestration` to real DB (removed all mock data)
- ✅ Created `agent_tasks`, `agent_metrics`, `agents`, `agent_logs` tables + RPCs
- ✅ POS Simulator stopped (data corruption issue resolved)
- ✅ FloatingChat header accessibility fixed
- ⚠️ Corrupted simulator data Aug 4-10 cleaned

---

## 2. Target Architecture — 7-Layer Blueprint

| Layer | Name | Key Components | Purpose |
|-------|------|---------------|---------|
| L1 | Source Systems | POS (Moka, GoFood, Square, Custom), ERP, HR Systems | Data collection from outlet-level systems |
| L2 | Ingestion | Webhooks, Batch CSV, CDC, API polling | Reliable transport into the platform |
| L3 | Data Platform | Supabase PostgreSQL, Feature Store, Storage | Storage + transformation, multi-tenant |
| L4 | AI/ML Layer | Anomaly Detection (z-score, Isolation Forest), Stockout Prediction, Demand Forecast | Statistical/ML signal generation |
| L5 | Hermes Agent Layer | Alert Triage, Case Routing, Explanation Gen, Notification Orchestration, SLA Monitoring | AI reasoning + orchestration |
| L6 | Workflow Automation | Alert → Case → Approval → Resolution state machine, SLA enforcement | Business process orchestration |
| L7 | Presentation | Dashboard (Vercel), Alert Queue, Case View, Athena Copilot UI | End-user interface |

---

## 3. Current As-Built Architecture

### 3.1 Layer Status

| Layer | Name | Implemented | Not Implemented | Files |
|-------|------|-------------|-----------------|-------|
| L1 | Source Systems | POS Webhook, POS Simulator (stopped), CSV ingestion | Real POS vendors | `pos-webhook/`, `scripts/pos-*.py`, `ingestion-csv/` |
| L2 | Ingestion | Webhooks (7+ endpoints), CSV import | CDC, API polling | `pos-webhook/`, `ingestion-webhook/`, `ingestion-csv/` |
| L3 | Data Platform | 51 migrations, 37 tables, RLS, multi-tenant | Feature Store | `supabase/migrations/*.sql` |
| L4 | AI/ML | z-score anomaly, stockout prediction, peer benchmarking | Demand forecast, model retraining | `coordinator-pipeline/`, `ml-anomaly-v2/`, `ml-stockout-v2/` |
| L5 | Hermes Agent | Task router (basic), agent registration | Alert triage (full), case routing, SLA monitoring | `agent-coordinator/`, `agent-orchestration/` |
| L6 | Workflow | Alert creation, case creation, basic approval | State machine, auto-escalation, audit log | `alerts-list/`, `case-create/`, `approvals/` |
| L7 | Presentation | Dashboard, Alert Queue, Athena Chat, Role views, Peer Benchmark | PDF/Excel export, Mobile app | `Dashboard.tsx`, `FloatingChat.tsx`, `AlertsList.tsx`, `ChatPanel.tsx` |

### 3.2 Edge Functions (Active)

```
supabase/functions/
├── POS / Ingestion (L1-L2)
│   ├── pos-webhook/           ← Real POS webhook receiver (HMAC validation)
│   ├── ingestion-webhook/     ← Generic webhook ingestor
│   ├── ingestion-csv/          ← CSV batch import
│   └── pos-connector/          ← POS connector config
│
├── Dashboard / Stats (L3-L4)
│   ├── dashboard-full/          ← Main dashboard data (currency FX conversion)
│   ├── dashboard-stats/        ← Stats aggregation
│   ├── dashboard-api/         ← Dashboard API
│   ├── coordinator-pipeline/  ← ML pipeline: z-score + stockout → alerts
│   ├── ml-anomaly-v2/         ← Anomaly detection
│   ├── ml-stockout-v2/        ← Stockout prediction
│   └── peer-benchmark/        ← Peer benchmarking
│
├── Athena AI (L5-L7)
│   ├── athena-chat/            ← AI chat with Claude/Bluepack (974 lines)
│   ├── athena-insights/       ← AI-generated insights
│   ├── athena-case-triage/    ← Case AI triage
│   └── hermes-query/           ← Hermes query interface
│
├── Agent Orchestration (L5)
│   ├── agent-coordinator/     ← Task routing hub (250 lines)
│   ├── agent-orchestration/    ← Agent status dashboard (REAL DB) ← FIXED
│   ├── agent-status/           ← Agent status
│   └── agents-list/           ← List registered agents
│
├── Workflow / Cases (L6)
│   ├── alerts-list/            ← Alert queue
│   ├── alert-generator/       ← Generate alerts
│   ├── alert-update/          ← Update alert
│   ├── case-create/           ← Create case from alert
│   ├── case-assigner/          ← Assign case
│   ├── case-update/           ← Update case status
│   ├── cases-list/            ← Case list
│   ├── approvals/             ← Approval workflow
│   ├── sla-escalator/         ← SLA monitoring
│   └── notification-send/      ← Send notification
│
├── Reference Data
│   ├── franchises-list/        ← Franchise/outlet list
│   ├── regions-list/          ← Regions
│   ├── staff-list/            ← Staff
│   ├── inventory-api/          ← Inventory
│   └── settings-get/save/     ← Settings
│
├── System / Utils
│   ├── health-check/          ← Health check
│   ├── db-stats/             ← DB statistics
│   ├── data-quality-monitor/ ← Data quality
│   ├── seed-*/                ← Seed data (12+ files)
│   ├── apply-migration/       ← Apply migrations
│   └── setup-cron/            ← Cron setup
│
└── Shared
    └── _shared/               ← Auth, config helpers
```

### 3.3 React Components (L7)

```
src/components/
├── Core UI
│   ├── Dashboard.tsx           ← Main dashboard (598 lines)
│   ├── Layout.tsx              ← Layout with sidebar + header
│   ├── LiveTransactionFeed.tsx ← Real-time transaction feed
│   ├── AlertsList.tsx          ← Alert queue (310 lines)
│   └── StatCard.tsx            ← Reusable stat card
│
├── AI / Chat (Athena)
│   ├── FloatingChat.tsx         ← Floating AI chat (fixed header)
│   ├── ChatPanel.tsx           ← Full chat panel w/ quick prompts
│   ├── AICopilot.tsx          ← AI copilot embedded
│   └── KnowledgeBaseAdmin.tsx  ← KB management
│
├── Workflow
│   ├── ApprovalWorkflows.tsx ← Approval workflow UI
│   └── Workflows.tsx           ← Workflow management
│
├── Reports / Analytics
│   ├── RiskDashboard.tsx      ← Risk overview
│   ├── PeerBenchmark.tsx      ← Peer comparison
│   └── Financing.tsx          ← Financing module
│
├── Entities
│   ├── Outlets.tsx            ← Outlet management
│   ├── Workforce.tsx          ← Staff management
│   └── Models.tsx             ← ML models
│
├── System
│   ├── Integrations.tsx       ← Integration management
│   ├── Settings.tsx           ← Settings
│   ├── AccessManagement.tsx   ← Access control
│   └── LanguageSwitcher.tsx   ← i18n
│
└── Auth
    └── Login.tsx              ← Login page
```

### 3.4 Database Schema

```
supabase/migrations/ (51 migrations)

Core Tables:
├── outlets                     ← Franchise outlets (164-171 = new format)
├── regions                     ← Regions (SG=12 outlets, JKT=4, BKK/BDG/SBY/KUL=1 each)
├── sales_transactions          ← POS transactions (CLEANED: Aug 9 only real data)
├── inventory                   ← Inventory levels
├── staff                      ← Staff records
├── alerts                     ← Generated alerts
├── cases                      ← Cases from alerts
├── user_outlets               ← User ↔ outlet mapping
└── system_status              ← Live indicator (last_txn_at)

Agent Tables:                  ← NEW (Aug 11)
├── agents                     ← 6 registered agents
├── agent_tasks                ← Task execution log
├── agent_metrics              ← Agent performance metrics
└── agent_logs                 ← Agent event logs

ML Tables:
├── ml_anomaly_scores          ← Anomaly scores per outlet
├── ml_stockout_risks          ← Stockout predictions
├── ml_models                  ← Model registry
└── outlet_features            ← Feature store

Finance:
├── loan_applications
├── repayment_schedule
└── financing_cases

Reference:
├── notifications
├── knowledge_base
├── settings
└── approvals
```

### 3.5 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS, Recharts |
| Backend | Supabase Edge Functions (Deno/TypeScript) |
| Database | Supabase PostgreSQL (37+ tables) |
| AI | Claude via Bluepack (ai.bluepack.my.id) |
| Auth | Supabase Auth (JWT) |
| Hosting | Vercel (frontend), Supabase (backend) |
| Database ID | `ploqeifazcgzwjzmukgp` |

---

## 4. End-to-End Data Flow

```
╔═══════════════════════════════════════════════════════════════════╗
║  L1: SOURCE SYSTEMS                                               ║
║  POS Simulator (STOPPED) | Real POS webhook → pos-webhook        ║
╚════════════════════════════════╬════════════════════════════════╝
                                 │ POST /functions/v1/pos-webhook
                                 ▼
╔═══════════════════════════════════════════════════════════════════╗
║  L2: INGESTION                                                   ║
║  pos-webhook → validate HMAC → normalize → INSERT               ║
╚════════════════════════════════╬════════════════════════════════╝
                                 │
                                 ▼
╔═══════════════════════════════════════════════════════════════════╗
║  L3: DATA PLATFORM                                               ║
║  sales_transactions → system_status.last_txn_at updated          ║
╚════════════════════════════════╬════════════════════════════════╝
                                 │ cron: every 1 min
                                 ▼
╔═══════════════════════════════════════════════════════════════════╗
║  L4: AI/ML                                                       ║
║  coordinator-pipeline: z-score anomaly → stockout → alert gen   ║
║  ml_anomaly_scores, alerts tables updated                        ║
╚════════════════════════════════╬════════════════════════════════╝
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
╔═══════════════════════════╗   ╔═══════════════════════════╗
║  L5: HERMES AGENT          ║   ║  L7: PRESENTATION        ║
║  agent-coordinator          ║   ║  Dashboard.tsx          ║
║  agent-orchestration (DB)   ║   ║  FloatingChat.tsx       ║
║  Routes: anomaly→monitor    ║   ║  AlertsList.tsx         ║
║  stockout→analyst           ║   ║  LiveTransactionFeed   ║
║  alert_triage→triage        ║   ║                         ║
║  user_query→athena          ║   ║                         ║
╚═══════════════════════════╝   ╚═══════════════════════════╝
                    │                         │
                    │                         ▼
                    │         ╔═══════════════════════════╗
                    └────────►║  athena-chat edge fn       ║
                              ║  Claude via Bluepack      ║
                              ║  Returns NL explanation    ║
                              ╚═══════════════════════════╝
```

---

## 5. Gap Analysis

| Component | Blueprint Scope | Current Status | Gap % |
|-----------|----------------|---------------|-------|
| **L1: Sources** | | | |
| POS Integration | Square, Moka, GoFood, Custom | ✅ Webhook ready (pos-webhook) | 80% |
| Real POS Data | Actual franchise POS | ⚠️ Simulator stopped, real POS not connected | 0% |
| ERP Integration | Finance, Inventory, Purchasing | ❌ Not implemented | 0% |
| HR Integration | Staff, Attendance, Payroll | ⚠️ Basic staff DB only | 20% |
| **L2: Ingestion** | | | |
| Webhooks | REST endpoints | ✅ Working (7+ endpoints) | 100% |
| Batch CSV | CSV import | ✅ Working (ingestion-csv) | 100% |
| CDC | Change Data Capture | ❌ Not implemented | 0% |
| API Polling | Periodic sync | ❌ Not implemented | 0% |
| **L3: Data Platform** | | | |
| PostgreSQL | Multi-tenant DB | ✅ 37 tables, RLS | 95% |
| Feature Store | ML-ready aggregates | ⚠️ Basic (outlet_features) | 30% |
| Storage | Files, exports | ❌ Not implemented | 0% |
| **L4: AI/ML** | | | |
| Anomaly Detection | z-score, Isolation Forest | ✅ z-score working | 70% |
| Stockout Prediction | Regression-based | ✅ Working | 60% |
| Demand Forecast | Time series | ❌ Not implemented | 0% |
| Model Retraining | Retraining pipeline | ❌ Not implemented | 0% |
| **L5: Hermes Agent** | | | |
| Alert Triage | Categorize & prioritize | ⚠️ Basic (athena-case-triage) | 40% |
| Case Routing | Assign to owner | ⚠️ Basic (case-assigner) | 30% |
| Explanation Gen | Natural language | ✅ Athena Chat working | 75% |
| Notification Orch | WhatsApp, Email | ⚠️ Simulated only | 30% |
| SLA Monitoring | Timer + escalation | ❌ Not implemented | 0% |
| **L6: Workflow** | | | |
| State Machine | Alert→Case→Resolution | ⚠️ Basic alerts→cases | 35% |
| SLA Enforcement | Auto-escalate | ❌ Not implemented | 0% |
| Approvals | Multi-level | ⚠️ Basic UI | 30% |
| Audit Log | Compliance tracking | ❌ Not implemented | 0% |
| **L7: Presentation** | | | |
| Dashboard | KPI cards, charts | ✅ Working | 90% |
| Alert Queue | List + acknowledge | ✅ Working | 85% |
| Case View | Timeline + actions | ⚠️ Basic | 40% |
| Athena Copilot | Chat UI | ✅ Working | 85% |
| Reports | PDF/Excel export | ❌ Not implemented | 0% |
| Mobile App | PWA/Native | ❌ Not implemented | 0% |

---

## 6. Agent System (L5) — New as of Aug 11

### 6.1 Architecture

```
agent-coordinator (task router)
    │
    ├── Routes per task_type:
    │     anomaly_check   → monitor (ml-anomaly-v2)
    │     stockout_predict → analyst (ml-stockout-v2)
    │     alert_triage    → triage (athena-case-triage)
    │     case_triage     → triage
    │     user_query      → athena (athena-chat)
    │     notification_send → executor (notification-send)
    │
    └── Logs to: agent_tasks, agent_metrics, agent_logs
```

### 6.2 Database Tables (NEW)

| Table | Purpose |
|-------|---------|
| `agents` | 6 registered agents (athena, monitor, analyst, coordinator, triage, executor) |
| `agent_tasks` | Task execution records (UUID primary key) |
| `agent_metrics` | Performance metrics (period_start/period_end) |
| `agent_logs` | Event logs (level, log_level both exist) |

### 6.3 RPC Functions

- `log_agent_event()` — Log event to agent_logs
- `record_agent_metric()` — Record metric to agent_metrics

### 6.4 Endpoint

```
GET /functions/v1/agent-orchestration
    ?endpoint=agents    → List all agents
    ?endpoint=tasks     → Recent tasks (limit param)
    ?endpoint=logs     → Recent logs (limit param)
    ?endpoint=metrics  → Aggregated metrics
    ?endpoint=dispatch → Create new task (POST body)
    (default)          → Full status (agents + tasks + logs + metrics)
```

---

## 7. Known Issues

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 1 | POS Simulator data corrupted | Dashboard shows bad data | ✅ Fixed: simulator stopped, data cleaned |
| 2 | agent-orchestration was all mock data | Agent status not real | ✅ Fixed: now reads from DB |
| 3 | Alerts table empty | "No alerts found" | ⚠️ Expected: no alert data in DB |
| 4 | Athena chat uses sample responses | Chat not always accurate | ⚠️ Known: needs real data context |
| 5 | Duplicate transactions Aug 4-5 | Data contamination | ✅ Fixed: duplicates deleted |
| 6 | Aug 10 simulator data | Still in DB | ⚠️ Pending: needs cleanup |
| 7 | Real POS not connected | L1 empty | ⏳ Planned |

---

## 8. Data Quality Status

```
sales_transactions table:
├── Aug 9:  411 txns, S$5,661, avg S$13.77/txn  ← REAL ✓
├── Aug 10: 589 txns (pending cleanup — simulator)
└── Aug 4-5: CLEANED ✓

Corruption pattern identified:
- outlet_id=1 with TXN- format = old test seed (deleted)
- Amounts > S$1,000 from simulator = corrupted (pending cleanup)
- Real POS: outlet_id 164-171 with XX-XXX-001-YYYYMMDD format
```

---

## 9. Open Decisions

1. **Which real POS vendor to integrate first?** (Moka, GoFood, Square, or custom)
2. **Hermes Agent architecture:** Separate service or absorb into Athena Chat?
3. **L6 workflow engine:** Build state machine or use external service?
4. **Feature store:** Build internal or use Supabase pg_vector extension?
