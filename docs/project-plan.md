# CyberQuote MVP — Project Plan
**AI Franchise Monitoring Platform for 30 Indonesian Outlets**
**Created:** July 13, 2026
**Status:** Sprint 0 — Blockers Being Cleared

---

## 📊 Project Overview

| Item | Value |
|------|-------|
| **Scope** | 30 pilot outlets, 2 core use cases |
| **Duration** | 12 weeks (3 months) |
| **Stack** | Vercel + **Supabase** (Full) + Hermes Agent |
| **Core Features** | Sales Anomaly Detection + Stockout Risk Prediction |

## 🏗️ Architecture (Full Supabase)

```
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND (Vercel + React)                     │
│  React 18 + TypeScript + TanStack Query + Tailwind        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Edge Functions (TypeScript/Deno):                   │  │
│  │  - ingestion-webhook (POS webhook intake)           │  │
│  │  - ingestion-csv (bulk CSV upload)                  │  │
│  │  - ml-anomaly-score (z-score anomaly)               │  │
│  │  - ml-stockout-risk (linear regression)             │  │
│  │  - athena-chat (GPT-4o explanations)                │  │
│  │  - notification-send (WhatsApp/Email)               │  │
│  │  - case-create, alert-update                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  PostgreSQL + RLS:                                 │  │
│  │  - Multi-tenant isolation                          │  │
│  │  - Realtime subscriptions                          │  │
│  │  - pg_vector for RAG                              │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Built-in:                                         │  │
│  │  - Auth (JWT + OAuth)                             │  │
│  │  - Storage (S3-compatible)                        │  │
│  │  - Realtime (WebSocket)                           │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  HERMES AGENT (AI Brain - Layer 5)                         │
│  Reasoning + Orchestration ONLY (NOT compute, NOT storage)  │
│  MCP Tools: get_outlet_status, list_active_alerts,          │
│            create_case, send_whatsapp_notification,         │
│            audit_action, explain_anomaly                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚨 TOP 10 BLOCKERS (from Team Review)

| # | Blocker | Owner | Priority | Status |
|---|---------|-------|----------|--------|
| 1 | ~~No ingestion pipeline~~ | **DONE** | ~~P0~~ | ~~🔴~~ |
| 2 | ~~CI/CD wrong stack~~ | **Bayu** | P0 | 🟡 In Progress |
| 3 | ~~Missing API routers~~ | **DONE** | ~~P0~~ | ~~🟡~~ |
| 4 | No Alembic migrations | **Supabase Migration** | P1 | 🔴 In Progress |
| 5 | No RLS policies | **In Schema** | P1 | 🔴 In Progress |
| 6 | Athena needs grounding | **Fajar** | P1 | 🔴 In Progress |
| 7 | ML hosting (Edge Functions) | **Bayu** | P1 | 🔴 In Progress |
| 8 | WhatsApp API approval | **Sari** | P0 | 🔴 TODO |
| 9 | Synthetic data generator | **Fajar** | P1 | 🔴 In Progress |
| 10 | Hermes MCP tools defined | **Priya** | P1 | ✅ DONE |

> ⚠️ **FastAPI Backend DISCONTINUED** — replaced by Supabase Edge Functions

---

## 📅 Sprint Breakdown

### Sprint 0 (Week 0) — Foundation & Blockers
**Goal:** Clear blockers, set up Supabase infrastructure

| Task | Owner | Deliverable | Status |
|------|-------|-------------|--------|
| ~~Implement webhook ingestion endpoint~~ | ~~Dimas~~ | ~~FastAPI ingestion~~ | ❌ REPLACED |
| **Create Supabase Edge Functions (Ingestion)** | Team | `supabase/functions/ingestion-*` | 🔴 In Progress |
| **Create Supabase Edge Functions (ML/AI)** | Team | `supabase/functions/ml-*` | 🔴 In Progress |
| **Create Supabase Edge Functions (Notifications)** | Team | `supabase/functions/notification-*` | 🔴 In Progress |
| **Create Database Schema + RLS** | Team | `supabase/migrations/001_*.sql` | 🔴 In Progress |
| Start WhatsApp API application | Sari | Submitted application | 🔴 TODO |
| Build synthetic data generator | Fajar | `scripts/generate_synthetic_data.py` | 🔴 In Progress |
| Define Hermes MCP tool contracts | Priya | `docs/hermes-mcp-tools.md` | ✅ DONE |
| Add Supabase client to frontend | Ayu | `src/lib/supabase.ts` + hooks | 🔴 In Progress |
| Update CI/CD for Supabase | Bayu | `.github/workflows/` | 🟡 In Progress |

### Sprint 1 (Week 1-2) — Core Platform
**Goal:** End-to-end data pipeline, dashboard functional

| Module | Tasks | Owner | Definition of Done |
|--------|-------|-------|-------------------|
| **Ingestion** | Webhook + CSV + validation + dedup | Team | POS data flows to Supabase |
| **Data Layer** | Schema + RLS + indexes | Team | Multi-tenant isolation verified |
| **Frontend** | Dashboard layout + KPI cards | Ayu | Dashboard shows real data |
| **Auth** | Supabase Auth + JWT | Supabase | Login/logout works |
| **Testing** | P0 test cases | Ratna | Auth, RLS, Alert workflow pass |

### Sprint 2 (Week 3-4) — ML Integration
**Goal:** ML models deployed, alerts generated

| Module | Tasks | Owner | Definition of Done |
|--------|-------|-------|-------------------|
| **ML Anomaly** | Z-score in Edge Function | Fajar | Scores anomaly per outlet |
| **ML Stockout** | Linear regression in Edge Function | Fajar | Predicts stockout risk |
| **Alert Generator** | Threshold-based alert creation | Team | Alerts appear in dashboard |
| **Frontend Integration** | Alert queue component | Ayu | Alerts visible with severity |
| **Synthetic Data** | 30 days test data | Fajar | ML can train on it |

### Sprint 3 (Week 5-6) — AI & Notifications
**Goal:** Athena AI works, notifications sent

| Module | Tasks | Owner | Definition of Done |
|--------|-------|-------|-------------------|
| **Athena AI** | LLM explanations + RAG | Fajar | Grounded explanations generated |
| **Hermes Integration** | MCP tools + orchestration | Priya | Hermes can trigger workflows |
| **WhatsApp Notifications** | Twilio integration | Dimas | Alerts sent via WhatsApp |
| **Email Notifications** | SendGrid integration | Dimas | Email alerts sent |
| **Case Management** | Create case from alert | Dimas | Cases appear in UI |
| **Audit Logging** | All actions logged | Dimas | Audit trail available |

### Sprint 4 (Week 7-8) — Polish & Pilot Prep
**Goal:** Ready for 30 outlet pilot

| Module | Tasks | Owner | Definition of Done |
|--------|-------|-------|-------------------|
| **Performance** | Optimize slow queries | Dimas | Dashboard loads < 2s |
| **ML Monitoring** | Drift detection + alerts | Fajar | PSI monitoring active |
| **A/B Testing** | Shadow mode for ML | Fajar | Can compare model versions |
| **UAT Testing** | Pilot outlet testing | Ratna | 30 outlets data flowing |
| **Documentation** | API docs + runbooks | Bayu | Docs complete |
| **Pilot Launch** | Go-live | Sari | 30 outlets active |

### Sprint 5-6 (Week 9-12) — Scale Preparation
**Goal:** Platform stable, ready for expansion

| Module | Tasks | Owner |
|--------|-------|-------|
| **Scale Testing** | Load test 100 outlets | Bayu |
| **Caching** | Redis cache for Athena | Bayu |
| **Advanced Analytics** | Trend analysis | Ayu |
| **Mobile App** | React Native (optional) | Ayu |
| **Model Improvements** | GBDT refinement | Fajar |

---

## ✅ DEFINITION OF DONE — MVP

| # | Criterion | Metric | Owner |
|---|-----------|--------|-------|
| 1 | **Alert Generation** | Anomaly → Alert in < 4 hours | Dimas/Fajar |
| 2 | **Alert Precision** | > 70% actionable alerts | Fajar |
| 3 | **Notification Delivery** | WhatsApp/Email delivered | Dimas |
| 4 | **Multi-tenant Security** | Zero cross-tenant data leaks | Dimas |
| 5 | **Dashboard Usability** | < 2s load time, all views work | Ayu |
| 6 | **Athena Accuracy** | Grounded explanations, no hallucinations | Fajar |
| 7 | **Uptime** | 99% during pilot | Bayu |
| 8 | **Pilot Acceptance** | 30 outlets actively using | Sari |

---

## 📈 SUCCESS METRICS

| Metric | Target | How Measured |
|--------|--------|--------------|
| **Alert Precision** | > 70% actionable | User feedback survey |
| **MTTD (Mean Time to Detect)** | < 4 hours | Alert timestamps |
| **MTTR (Mean Time to Resolve)** | < 24 hours | Case resolution tracking |
| **User Adoption** | > 80% daily active users | Supabase analytics |
| **System Uptime** | > 99% | Uptime monitoring |
| **Alert Volume** | 1-5% of transactions | Alert count / transaction count |
| **False Positive Rate** | < 15% | User dismiss rate |

---

## 💰 BUDGET (MVP)

| Category | Monthly | 3-Month Total |
|----------|---------|---------------|
| **Team Salaries** | ~Rp 116-168jt | ~Rp 348-504jt |
| **AWS/Vercel** | ~$2-5k | ~$6-15k |
| **OpenAI API** | ~$500-1k | ~$1.5-3k |
| **Twilio** | ~$50-100 | ~$150-300 |
| **Tools (Linear, Notion)** | ~$200 | ~$600 |
| **Total** | | **~$12-20k + team** |

---

## 🔑 KEY DEPENDENCIES

```
Sprint 0:
├── Sari: WhatsApp API application (unblocks Sprint 2 notifications)
├── Team: Supabase schema + RLS (unblocks all data work)
└── Fajar: Synthetic data (unblocks ML training)

Sprint 1:
├── Team: Edge Functions ready (unblocks frontend integration)
├── Bayu: Supabase project + CLI configured (unblocks deployment)
└── Ayu: TanStack Query hooks ready (unblocks dashboard)

Sprint 2:
└── Fajar: ML Edge Functions ready (unblocks alerts)

Sprint 3:
├── Fajar: Athena AI ready (unblocks explanations)
└── Priya: Hermes tools integrated (unblocks orchestration)
```

---

## ⚠️ RISKS & MITIGATIONS

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ML model quality issues | MEDIUM | HIGH | Ground truth dataset + A/B testing |
| RLS bypass | LOW | CRITICAL | Database-level tests in CI |
| AI hallucinations | HIGH | MEDIUM | RAG grounding + citations |
| WhatsApp API delay | HIGH | MEDIUM | Start application Day 1 |
| POS API instability | HIGH | HIGH | CSV fallback from day 1 |
| Alert fatigue | MEDIUM | MEDIUM | Threshold tuning in pilot |
| Model drift | MEDIUM | MEDIUM | Retrain weekly, monitor PSI |

---

## 📁 DOCUMENTATION STRUCTURE

```
docs/
├── architecture.md          # System architecture
├── api/
│   ├── openapi.yaml        # API specification
│   └── endpoints.md        # Endpoint documentation
├── hermes/
│   └── mcp-tools.md        # Hermes MCP tool contracts
├── ml/
│   ├── anomaly-model.md    # Anomaly detection design
│   ├── stockout-model.md   # Stockout prediction design
│   └── model-cards/        # Per-model documentation
├── runbooks/
│   ├── deployment.md       # Deployment procedures
│   ├── rollback.md         # Rollback procedures
│   └── incident-response.md
└── user-guides/
    ├── dashboard.md        # Dashboard user guide
    ├── alerts.md           # Alert management
    └── athena.md           # Using Athena AI
```

---

## 👥 TEAM RESPONSIBILITIES (Full Supabase)

| Role | Name | Sprint 0 Tasks |
|------|------|---------------|
| **Tech Lead** | Priya (me) | Hermes tools, architecture decisions |
| **Full-Stack Lead** | Dimas | Supabase Edge Functions, schema |
| **Full-Stack Eng** | Rendy | Edge Functions, integration |
| **Frontend** | Ayu | Dashboard, Supabase hooks |
| **ML Engineer** | Fajar | ML Edge Functions, synthetic data |
| **DevOps** | Bayu | Supabase deployment, CI/CD |
| **PM** | Sari | WhatsApp approval, pilot coordination |
| **QA** | Ratna | Test plan, P0 test cases |

> ⚠️ **Note:** With Full Supabase, Dimas and Rendy focus on Edge Functions (TypeScript/Deno) instead of Python/FastAPI.

---

## ✅ CHECKLIST — SPRINT 0 COMPLETE

- [ ] Webhook ingestion endpoint working
- [ ] Alembic migrations generated
- [ ] Missing routers stubbed
- [ ] RLS policies applied to all tables
- [ ] CI/CD pipeline rewritten
- [ ] ML hosting decision made
- [ ] WhatsApp API application submitted
- [ ] Synthetic data generator built
- [ ] Hermes MCP tools documented
- [ ] Supabase client added to frontend
- [ ] P0 test cases written
- [ ] Project plan reviewed and approved

---

**Last Updated:** July 13, 2026
**Next Review:** End of Sprint 0
