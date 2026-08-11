# Architecture — Production Target

**Project:** CQaiFranchise **Target:** Multi-franchise, multi-tenant, production
scale **Horizon:** 12-16 weeks after MVP

---

## Production Vision

Full 7-layer blueprint realized:

- Multi-tenant: 10+ franchise groups, 100+ outlets
- Real POS integrations: Moka, GoFood, GrabFood, Square
- Full AI orchestration: Hermes Agent as independent brain
- Production ML: retraining pipelines, model drift detection
- Workflow engine: state machine, SLA enforcement, audit log
- Reporting: PDF exports, scheduled reports, mobile app

---

## Production Architecture

```
╔═══════════════════════════════════════════════════════════════════╗
║  L1: SOURCE SYSTEMS                                               ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           ║
║  │  Moka    │  │ GoFood   │  │ GrabFood │  │  Square  │           ║
║  │  (ID)    │  │ (ID)     │  │  (SG/MY) │  │  (SG)    │           ║
║  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           ║
║       │ webhooks        │         │              │                  ║
║       └─────────────────┴─────────┴──────────────┘                  ║
║                              │                                       ║
║  ┌──────────────────────────┴────────────────────────────────┐     ║
║  │  ERP Systems (future)                                      │     ║
║  │    ERP ────► HR System ────► Banking API          │     ║
║  └────────────────────────────────────────────────────────────┘     ║
║                                                                    ║
╚════════════════════════════════╬═══════════════════════════════════╝
                                  │
╔══════════════════════════════════╪═══════════════════════════════════╗
║  L2: INGESTION                                                   ║
╠═════════════════════════════════╪═══════════════════════════════════╣
║                                                                    ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  SUPABASE EDGE FUNCTIONS (Deno)                             │  ║
║  │                                                              │  ║
║  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │  ║
║  │  │ pos-webhook  │  │pos-moka/     │  │ingestion-   │      │  ║
║  │  │(generic)    │  │pos-gofood    │  │csv          │      │  ║
║  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │  ║
║  │         │                  │                 │               │  ║
║  │         └──────────────────┴─────────────────┘               │  ║
║  │                        │                                    │  ║
║  │                   Normalizer                                 │  ║
║  │              (currency, ID mapping)                          │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            ║
║  │ CDC (future) │  │ API Polling  │  │  Batch CSV   │            ║
║  │ Supabase     │  │ Scheduled    │  │  Import UI   │            ║
║  │ Replicate    │  │ sync         │  │              │            ║
║  └──────────────┘  └──────────────┘  └──────────────┘            ║
║                                                                    ║
╚════════════════════════════════╬═══════════════════════════════════╝
                                  │
╔══════════════════════════════════╪═══════════════════════════════════╗
║  L3: DATA PLATFORM                                             ║
╠═════════════════════════════════╪═══════════════════════════════════╣
║                                                                    ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │  SUPABASE POSTGRESQL                                        │   ║
║  │                                                           │   ║
║  │  ┌────────────────┐  ┌────────────────┐                   │   ║
║  │  │ Multi-tenant  │  │  Row-Level    │                   │   ║
║  │  │ (tenant_id)   │  │  Security      │                   │   ║
║  │  └────────────────┘  └────────────────┘                   │   ║
║  │                                                           │   ║
║  │  Core Tables:                                              │   ║
║  │  ├── outlets, regions, franchise_groups                  │   ║
║  │  ├── sales_transactions, inventory, staff                 │   ║
║  │  ├── alerts, cases, approvals, sla_timers                 │   ║
║  │  ├── loan_applications, repayment_schedule                │   ║
║  │  ├── agents, agent_tasks, agent_metrics, agent_logs       │   ║
║  │  └── knowledge_base, embeddings                           │   ║
║  │                                                           │   ║
║  │  ┌────────────────┐  ┌────────────────────────────────┐  │   ║
║  │  │ Feature Store  │  │  Object Storage                │  │   ║
║  │  │ (outlet_       │  │  (invoices, reports, exports) │  │   ║
║  │  │  features)     │  │                                │  │   ║
║  │  └────────────────┘  └────────────────────────────────┘  │   ║
║  │                                                           │   ║
║  │  ┌────────────────────────────────────────────────────┐  │   ║
║  │  │ pg_vector — Semantic search, similarity            │  │   ║
║  │  └────────────────────────────────────────────────────┘  │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                                                                    ║
╚════════════════════════════════╬═══════════════════════════════════╝
                                  │
              ┌───────────────────┴───────────────────┐
              │                                           │
╔═════════════╪═════════════╗           ╔═════════════╪═════════════╗
║  L4: AI/ML                    ║           ║  L5: HERMES AGENT         ║
╠═════════════╪═════════════╣           ╠═════════════╪═════════════╣
║                            ║           ║                            ║
║  ┌──────────────────────┐  ║           ║  ┌────────────────────────┐  ║
║  │ ML Pipeline (cron)   │  ║           ║  │ Hermes Agent Orchestrator│  ║
║  │                      │  ║           ║  │                         │  ║
║  │ ┌────────────────┐  │  ║           ║  │  • Alert Triage (NLP)  │  ║
║  │ │Z-Score Anomaly│  │  ║           ║  │  • Case Routing (rule)  │  ║
║  │ └────────────────┘  │  ║           ║  │  • Explanation Gen (LLM)│  ║
║  │                      │  ║           ║  │  • Notification Orch  │  ║
║  │ ┌────────────────┐  │  ║           ║  │  • SLA Monitoring      │  ║
║  │ │ Stockout Pred  │  │  ║           ║  │                         │  ║
║  │ │ (Regression)   │  │  ║           ║  │  Separate service or   │  ║
║  │ └────────────────┘  │  ║           ║  │  absorb into Athena?  │  ║
║  │                      │  ║           ║  └───────────┬────────────┘  ║
║  │ ┌────────────────┐  │  ║           ║                │                ║
║  │ │Demand Forecast │  │  ║           ║     ┌─────────┴─────────┐       ║
║  │ │(Time Series)  │  │  ║           ║     │                  │       ║
║  │ └────────────────┘  │  ║           ║     ▼                  ▼       ║
║  │                      │  ║           ║  ┌──────────┐  ┌──────────┐    ║
║  │ ┌────────────────┐  │  ║           ║  │Claude via │  │ Slack/   │    ║
║  │ │Model Drift    │  │  ║           ║  │Bluepack   │  │ WhatsApp │    ║
║  │ │Monitoring     │  │  ║           ║  │           │  │ Email    │    ║
║  │ └────────────────┘  │  ║           ║  └──────────┘  └──────────┘    ║
║  │                      │  ║           ║                            ║
║  │ ┌────────────────┐  │  ║           ║  ┌────────────────────────┐  ║
║  │ │Model Registry │  │  ║           ║  │ agent-tasks table     │  ║
║  │ │(ML Models)    │  │  ║           ║  │ agent-metrics table    │  ║
║  │ └────────────────┘  │  ║           ║  │ agent-logs table      │  ║
║  └──────────────────────┘  ║           ║  └────────────────────────┘  ║
║                            ║           ║                            ║
╚════════════════════════════╩═══════════╩════════════════════════════╝
                                  │
╔═════════════════════════════════╪═══════════════════════════════════╗
║  L6: WORKFLOW AUTOMATION                                         ║
╠═════════════════════════════════╪═══════════════════════════════════╣
║                                                                    ║
║  ┌──────────────────────────────────────────────────────────────┐  ║
║  │  STATE MACHINE: Alert → Case → Approval → Resolution        │  ║
║  │                                                              │  ║
║  │     ┌───────┐    ┌───────┐    ┌─────────┐    ┌────────┐  │  ║
║  │     │ ALERT │───►│ CASE  │───►│ APPROVAL│───►│RESOLVED│  │  ║
║  │     │  NEW  │    │ OPEN  │    │ PENDING │    │ CLOSED │  │  ║
║  │     └───────┘    └───────┘    └─────────┘    └────────┘  │  ║
║  │         │           │              │                       │  ║
║  │         │           ▼              ▼                       │  ║
║  │         │      ┌────────┐    ┌──────────┐                 │  ║
║  │         │      │ ESCALATE│    │ APPROVED │                 │  ║
║  │         │      │ (SLA)  │    │ /REJECTED │                 │  ║
║  │         │      └────────┘    └──────────┘                 │  ║
║  │         │                                               │  ║
║  │         ▼                                               │  ║
║  │    ┌────────┐                                         │  ║
║  │    │DISMISS│                                         │  ║
║  │    │(false+)                                        │  ║
║  │    └────────┘                                         │  ║
║  │                                                              │  ║
║  │  SLA Enforcement:                                           │  ║
║  │  ├── Timer starts on alert creation                       │  ║
║  │  ├── Auto-escalate if SLA breached                       │  ║
║  │  └── Audit log on every transition                      │  ║
║  │                                                              │  ║
║  │  sla_escalator edge function (cron)                        │  ║
║  └──────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
╚════════════════════════════════╬═══════════════════════════════════╝
                                  │
╔═════════════════════════════════╪═══════════════════════════════════╗
║  L7: PRESENTATION                                               ║
╠═════════════════════════════════╪═══════════════════════════════════╣
║                                                                    ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │  Web (Vercel)                                               │  ║
║  │  ├── Dashboard (real-time KPIs)                             │  ║
║  │  ├── Alert Queue (priority sorted)                          │  ║
║  │  ├── Case Management (timeline + actions)                   │  ║
║  │  ├── Athena Chat Copilot                                   │  ║
║  │  ├── Reports (PDF/Excel export)                             │  ║
║  │  ├── Peer Benchmarking                                      │  ║
║  │  └── Role-based views (HQ, RM, Franchise, Staff)           │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │  Mobile (Future — PWA or Native)                            │  ║
║  │  ├── Push notifications (alert SLA)                        │  ║
║  │  ├── Case action from phone                                │  ║
║  │  └── Quick approve/reject                                   │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │  Notifications                                               │  ║
║  │  ├── WhatsApp (franchise owner)                             │  ║
║  │  ├── Email (regional manager)                              │  ║
║  │  └── Slack (HQ admin) — optional                           │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## Production Tech Stack

| Layer               | Technology                               | Notes                |
| ------------------- | ---------------------------------------- | -------------------- |
| **Frontend**        | React 19 + Vite + Tailwind               | Current stack        |
| **Backend**         | Supabase Edge Functions (Deno)           | Current stack        |
| **Database**        | Supabase PostgreSQL                      | Current stack        |
| **Feature Store**   | pg_vector + outlet_features              | Add semantic search  |
| **Object Storage**  | Supabase Storage                         | Invoices, exports    |
| **AI**              | Claude via Bluepack                      | Current stack        |
| **Workflow Engine** | Supabase + Edge Functions                | State machine, cron  |
| **Notifications**   | WhatsApp (vonage), Email (SMTP/SendGrid) | Add WhatsApp API     |
| **ML Pipeline**     | Supabase Edge + Python (Modal/Vertex AI) | Model training       |
| **Monitoring**      | Vercel Analytics + Sentry                | Errors + performance |
| **CDN**             | Vercel Edge                              | Static + API caching |

---

## Multi-Tenant Architecture

```
Franchise Group A
├── HQ Admin → sees all regions
├── Regional Manager SG → SG outlets
├── Regional Manager JKT → Jakarta outlets
└── Outlet Staff → own outlet only

Franchise Group B (separate tenant_id)
├── Same structure
└── Cannot see Group A data (RLS enforced)
```

### Row-Level Security

```sql
-- User sees only their outlets
CREATE POLICY user_outlets ON sales_transactions
  FOR ALL USING (
    auth.jwt() -> 'tenant_id' = tenant_id
    AND outlet_id IN (
      SELECT outlet_id FROM user_outlets WHERE user_id = auth.uid()
    )
  );
```

---

## Production Data Flow

```
1. POS (Moka/GoFood) emits webhook
        │
2. L2: POS-specific edge function normalizes
        │  - Moka payload → standard schema
        │  - Currency: IDR → SGD (FX rate)
        │  - Outlet mapping: external_id → internal_id
        │
3. L3: INSERT sales_transactions (multi-tenant, RLS enforced)
        │
4. L4: ML pipeline (cron 1 min)
        │  - Z-score: today vs 30-day baseline
        │  - Stockout: 7-day risk score
        │  - Demand forecast: 30-day projection
        │
5. L5: Hermes Agent
        │  - Alert triage: categorize + prioritize
        │  - Route to correct owner (rule-based)
        │  - Generate NL explanation (Claude)
        │
6. L6: Workflow
        │  - Alert → Case (auto or manual)
        │  - SLA timer starts
        │  - Notification sent (WhatsApp)
        │
7. L7: Dashboard + Mobile
        │  - Real-time KPIs
        │  - Push notification
        │
8. User resolves case
        │  - Audit log recorded
        │  - Case closed
        │
9. L4: Model update
        │  - Outcome fed back to ML model
        │  - Drift monitoring
```

---

## Production Checklist

### L1: Source Systems

- [ ] Moka POS webhook integration
- [ ] GoFood webhook integration
- [ ] POS connector config UI
- [ ] ERP integration (future)
- [ ] HR integration (future)

### L2: Ingestion

- [ ] CDC setup (Supabase Replicate)
- [ ] API polling fallback
- [ ] Batch CSV import UI
- [ ] Data quality monitoring

### L3: Data Platform

- [ ] Feature store (pg_vector)
- [ ] Supabase Storage for exports
- [ ] Full RLS audit
- [ ] Data retention policies

### L4: AI/ML

- [ ] Demand forecasting model
- [ ] Model retraining pipeline
- [ ] Model drift detection
- [ ] A/B testing framework

### L5: Hermes Agent

- [ ] Independent Hermes Agent service
- [ ] Alert triage (NLP classification)
- [ ] Case routing (rule + ML hybrid)
- [ ] Notification orchestration (WhatsApp)
- [ ] SLA monitoring + escalation

### L6: Workflow

- [ ] State machine (Alert→Case→Approval→Resolution)
- [ ] SLA enforcement + auto-escalation
- [ ] Multi-level approval UI
- [ ] Audit log + compliance export

### L7: Presentation

- [ ] PDF report export
- [ ] Scheduled report emails
- [ ] Mobile app (PWA)
- [ ] Role-based mobile views

---

## Production Infrastructure

```
GitHub Repo
    │
    ▼ (PR merge to main)
Vercel Deploy
    │
    ▼
Supabase
├── Production DB
├── Staging DB
└── Edge Functions
    │
    ▼
Monitoring
├── Vercel Analytics
├── Sentry (errors)
├── Supabase PMM (DB perf)
└── PagerDuty (alerts)
```

---

## Open Decisions (Production)

| # | Decision              | Options                           | Recommendation                 |
| - | --------------------- | --------------------------------- | ------------------------------ |
| 1 | Hermes Agent build    | Separate service vs Athena Chat   | Separate if complexity grows   |
| 2 | ML training infra     | Modal vs Vertex AI vs self-hosted | Modal for cost-effective GPU   |
| 3 | Notification platform | Vonage vs Twilio vs MessageBird   | Vonage (WhatsApp official)     |
| 4 | Feature store         | pg_vector vs Pinecone vs Weaviate | pg_vector first (cheap)        |
| 5 | Workflow engine       | Build vs Temporal vs Convey       | Build (MVP) → Temporal (scale) |
