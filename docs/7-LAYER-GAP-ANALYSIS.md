# CQaiFranchise — 7-Layer Gap Analysis vs Blueprint

## Summary

| Layer | Functions | % Done | Key Gap |
|---|---|---|---|
| L1 Source Systems | 5 | 40% | No live POS/ERP |
| L2 Ingestion | 4 | 60% | CDC Realtime unverified |
| L3 Data Platform | 35+ | 85% | Feature Store seeded static |
| L4 AI/ML | 8 | 70% | No time-series forecast |
| L5 Hermes Agent | 9 | 70% | Agent executor not wired |
| L6 Workflow | 6 | 70% | State in-memory only |
| L7 Presentation | 19 components | 85% | Bell not built |
| **TOTAL** | **~101 functions** | **~75%** | |

## Layer 1 — Source Systems (POS/ERP/HR)

### Plan: POS (Square, Moka, Custom), ERP modules, HR systems
### Implemented: 5 items
- `pos-webhook` — webhook receiver (deployed)
- `ingestion-csv` — batch CSV import
- `ingestion-webhook` — general webhook endpoint
- `connector-test` — POS connector testing
- `seed-staff` / `seed-workflow-data` — seeded test data

### Gaps:
1. No live POS connection — demo uses seeded synthetic data
2. No ERP (Finance/Inventory) integration
3. No HR attendance/payroll integration
4. POS connector not wired to real POS provider

## Layer 2 — Ingestion

### Plan: Webhooks, Batch CSV, CDC, API polling
### Implemented: 4 items
- `ingestion-webhook` — webhook receiver
- `ingestion-csv` — CSV batch import
- `pos-webhook` — POS-specific ingestion
- `cron-run` + `ml-scheduler` — scheduled jobs

### Gaps:
1. **CDC Realtime not verified** — `REPLICA IDENTITY` not confirmed on tables
2. No Debezium pipeline for CDC
3. No API polling for pull-based POS systems
4. No ingestion monitoring/deduplication

## Layer 3 — Data Platform

### Plan: PostgreSQL, Feature Store, Storage, Multi-tenant RLS
### Implemented: 35+ migrations + edge functions
- PostgreSQL + RLS enforced (fix-rls applied)
- Multi-tenant via tenant_id/user_outlets
- Feature store tables (outlet_features, peer_metrics) — seeded
- apply-currency-migration — deployed

### Gaps:
1. Feature Store seeded static — no streaming updates
2. Object Storage (files/uploads) not verified
3. Currency migration applied but edge cases remain (THB/IDR rounding)

## Layer 4 — AI/ML

### Plan: Anomaly Detection (Z-score, Isolation Forest), Stockout Prediction, Demand Forecast
### Implemented: 8 functions
- ml-anomaly-score, ml-anomaly-v2
- ml-stockout-risk, ml-stockout-v2
- ml-batch-score, ml-scheduler
- ml-models-list, seed-ml-models

### Gaps:
1. No Isolation Forest model — heuristic z-score only
2. No time-series demand forecasting (ARIMA/Prophet)
3. No XGBoost/LightGBM trained models
4. Embeddings not wired to athena-chat (RAG not used)
5. ml_model_versions table exists but model registry not wired

## Layer 5 — Hermes Agent (AI Brain)

### Plan: Alert Triage, Case Routing, Explanation, Notification, SLA Monitoring
### Implemented: 9 functions
- athena-chat (NL → SQL/API)
- athena-case-triage, athena-insights
- hermes-query, notification-send, notification-trigger
- agent-orchestrator, agent-coordinator, agent-status
- agent-executor/scheduler (infrastructure)

### Gaps:
1. Agent executor not wired to frontend UI
2. Email/SMS/WhatsApp credentials not verified live
3. RAG not integrated into athena-chat (embeddings not queried)
4. Notification preferences not persisted per user

## Layer 6 — Workflow Automation

### Plan: Alert → Case → Approval → Resolution state machine, SLA enforcement
### Implemented: 6 functions
- case-create, case-assigner, case-update
- sla-escalator, alert-generator
- approvals

### Gaps:
1. Workflow state in React in-memory only — not persisted to workflow_instances table
2. case-from-alert edge function exists but not tested end-to-end
3. No workflow audit log persistence
4. No workflow canvas/drag-drop UI — hardcoded state machine

## Layer 7 — Presentation

### Plan: Vercel Dashboard, Alert Queue, Case View, Athena Copilot, Role Views
### Implemented: 19 React components
Dashboard, Outlets, Workforce, Workflows, Integrations, Models, Settings, ChatPanel, FloatingChat, RiskDashboard, AccessManagement, PeerBenchmark, ApprovalWorkflows, KnowledgeBaseAdmin, Financing, LiveTransactionFeed, LanguageSwitcher, UserMenu, etc.

### Gaps:
1. Notification bell — plan saved, not built
2. No mobile/PWA
3. Login uses window.location.href hard redirect (bad practice)
4. Settings — Email/WhatsApp toggles exist but not wired to notification-send
5. .env.example not committed (local dev onboarding friction)

## Top 3 Production Blockers

| # | Blocker | Layer | Fix |
|---|---|---|---|
| 1 | CDC Realtime (REPLICA IDENTITY) | L2 | Migration + verify publication |
| 2 | Workflow state not persisted | L6 | Wire to workflow_instances table |
| 3 | Agent executor not wired | L5 | Frontend → edge function integration |
