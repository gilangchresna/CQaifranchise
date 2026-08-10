# CQaiFranchise Wiki

Technical documentation for the CyberQuote AI Franchise Operations Platform.

## Quick Links

| Topic | Doc |
|--------|-----|
| Architecture | [architecture.md](architecture.md) |
| Database Schema | [database-schema.md](database-schema.md) |
| API Reference | [api-reference.md](api-reference.md) |
| Getting Started | [getting-started.md](getting-started.md) |

## Module Reference

### Edge Functions

| Module | File | Description |
|---------|------|-------------|
| **POS Ingestion** | | |
| pos-webhook | `pos-webhook/index.ts` | POS transaction ingestion with HMAC auth + replay protection |
| pos-simulator | `pos-simulator/index.ts` | Live transaction simulation (demo/testing) |
| **ML Pipelines** | | |
| coordinator-pipeline | `coordinator-pipeline/index.ts` | ML pipeline: anomaly + stockout + alert creation (cron: 15min) |
| ml-anomaly-v2 | `ml-anomaly-v2/index.ts` | Isolation Forest anomaly scoring per outlet |
| ml-accuracy-tracker | `ml-accuracy-tracker/index.ts` | TP/FP/FN logging + precision/recall/F1 metrics |
| seed-outlet-features | `seed-outlet-features/index.ts` | ETL: aggregate sales_transactions → outlet_features |
| **Cases & Alerts** | | |
| alerts-list | `alerts-list/index.ts` | List alerts with role-based filtering |
| case-create | `case-create/index.ts` | Create case from alert |
| cases-list | `cases-list/index.ts` | List cases with role-based filtering |
| case-update | `case-update/index.ts` | Update case status/assignee/priority |
| **SLA & Escalation** | | |
| sla-escalator | `sla-escalator/index.ts` | SLA monitoring + escalation chain (cron: 15min) |
| **AI & Agents** | | |
| athena-chat | `athena-chat/index.ts` | Claude-powered chat interface |
| agent-coordinator | `agent-coordinator/index.ts` | Task routing to ML agents |
| **BI & Dashboard** | | |
| dashboard-full | `dashboard-full/index.ts` | Real-time KPIs + daily breakdown |
| **Utilities** | | |
| case-create | `case-create/index.ts` | Case creation from alerts |
| notification-send | `notification-send/index.ts` | Email/notification dispatch |

### Sequences

- [Alert → Case workflow](sequences.md)
- [POS → webhook → alert flow](sequences.md)
- [SLA escalation chain](sequences.md)

## Architecture

```
L1: POS Systems + ERP + HR Vendors
L2: Integration Adapters (pos-webhook)
L3: Data Pipeline (coordinator-pipeline, batch-import)
L4: Core Business Ops (cases, alerts, inventory)
L5: BI + ML (dashboard, ml-accuracy-tracker)
L6: AI Agents (athena-chat, agent-coordinator)
L7: User Interface (React SPA)
```

## Cron Jobs

| Job | Schedule | Function |
|-----|---------|----------|
| coordinator-pipeline | `*/15 * * * *` | ML anomaly + stockout + alerts |
| sla-escalator | `*/15 * * * *` | SLA check + escalation |

## Database Tables

| Table | Purpose |
|-------|---------|
| `outlets` | Franchise outlet registry |
| `regions` | Region definitions (SG, JKT, BDG, etc.) |
| `sales_transactions` | All POS transactions |
| `inventory` | Per-outlet stock levels |
| `alerts` | Triggered alerts (NEW/ACKNOWLEDGED/RESOLVED) |
| `cases` | Cases from alerts (NEW/IN_PROGRESS/RESOLVED/CLOSED) |
| `outlet_features` | Computed ML features per outlet |
| `ml_anomaly_scores` | Anomaly Z-scores per outlet |
| `ml_accuracy_logs` | TP/FP/FN for model evaluation |
| `sla_escalation_runs` | Escalation run history |

## Security

- CORS narrowed to `https://cqaifranchise.vercel.app` on all edge functions
- HMAC-SHA256 required for pos-webhook
- JWT auth required for all user-facing endpoints
- SERVICE_ROLE_KEY used only in internal edge functions
- Replay protection: pos-webhook rejects dates older than yesterday
