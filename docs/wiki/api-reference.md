# API Reference — Supabase Edge Functions

99 edge functions. All hosted at `https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/<name>`.

**Auth**: Most require `Authorization: Bearer <jwt>` header. Admin functions use service role key internally.

## L1-L2: Ingestion

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `pos-webhook` | POST | anon + HMAC/bypass | POS transaction ingestion. Validates outlet, computes financials, inserts `sales_transactions`. Dev: `x-pos-dev-bypass: dev-mode-2026` |
| `ingestion-webhook` | POST | anon | Generic webhook receiver |
| `ingestion-csv` | POST | service | Batch CSV import |
| `pos-connector` | GET | user | POS connection status |
| `connector-test` | POST | service | Test POS connection |

## L3-L4: Dashboard & ML

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `dashboard-full` | GET | user | KPI stats + daily_breakdown. Query: `?period=7d`. Returns `{ totals, metrics, daily_breakdown, payment_breakdown }` |
| `dashboard-stats` | GET | user | Lightweight stats |
| `dashboard-api` | GET | user | Generic dashboard API |
| `db-stats` | GET | service | Database row counts |
| `coordinator-pipeline` | POST | service (cron) | ML pipeline: z-score anomaly + stockout + alert gen. Runs every 1 min |
| `ml-anomaly-v2` | GET | user | Anomaly scores per outlet |
| `ml-anomaly-batch` | GET | user | Batch anomaly scores |
| `ml-anomaly-score` | GET | user | Single outlet score |
| `ml-stockout-v2` | GET | user | Stockout risk scores |
| `ml-stockout-risk` | GET | user | Stockout risk details |
| `ml-batch-score` | GET | service | Nightly ML scoring |
| `ml-models-list` | GET | user | List ML model registry |
| `ml-scheduler` | POST | service | Nightly ML orchestrator |
| `peer-benchmark` | GET | user | Peer benchmarking data |
| `data-quality-monitor` | GET | service | Data quality metrics |

## L5: AI Agents

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `athena-chat` | POST | user | AI chat. Body: `{ message, history?, context? }`. Returns NL response from Claude/Bluepack |
| `athena-insights` | GET | user | AI-generated insights |
| `athena-case-triage` | POST | user | AI case triage |
| `hermes-query` | GET | user | Hermes query interface |
| `agent-coordinator` | POST | user | Task dispatch hub. Routes tasks to agents |
| `agent-orchestration` | GET | user | Agent status + tasks + logs from DB. `?endpoint=agents\|tasks\|logs\|metrics` |
| `agent-status` | GET | user | Agent health |
| `agents-list` | GET | user | List registered agents |

## L6: Workflow

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `alerts-list` | GET | user | Alert queue. Filters by role, status, severity |
| `alert-generator` | POST | service | Generate alerts from ML scores |
| `alert-update` | POST | user | Update alert status |
| `case-create` | POST | user | Create case from alert. Body: `{ alert_id, title, priority?, assigned_to_id? }` |
| `case-assigner` | POST | user | Assign case to user |
| `case-update` | POST | user | Update case status, priority, resolution |
| `cases-list` | GET | user | List cases with filters |
| `sla-escalator` | POST | service | Check SLA timers, escalate breached cases |
| `approvals` | GET | user | Approval requests list |
| `notification-send` | POST | service | Send notification (WhatsApp/Email) |
| `notification-trigger` | POST | service | Trigger notification from alert |

## L7: Entity APIs

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `franchises-list` | GET | user | Outlets + regions + peer data. `?role=HQ_ADMIN` |
| `outlets` | GET | user | Outlet management |
| `regions-list` | GET | user | Regions with currency |
| `staff-list` | GET | user | Staff by outlet |
| `inventory-api` | GET | user | Inventory levels + stockouts |
| `users-list` | GET | user | Users by role |
| `settings-get` | GET | user | User/tenant settings |
| `settings-save` | POST | user | Save settings |
| `knowledge-list` | GET | user | Knowledge base articles |
| `embeddings-search` | GET | user | Semantic KB search (pg_vector) |
| `embeddings-create` | POST | service | Create KB embedding |
| `stakeholder-report` | GET | user | Stakeholder report data |
| `pilot-dashboard` | GET | user | Pilot-specific KPIs |

## System

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `health-check` | GET | anon | Health check. Returns `{ status: "ok" }` |
| `cron-run` | POST | service | Manual cron trigger |
| `email` | POST | service | Send email |
| `setup-cron` | POST | service | Configure pg_cron schedules |
| `check-data` | GET | service | Data integrity check |
| `verify-historical-data` | GET | service | Historical data verification |
| `data-validator` | POST | service | Validate POS data quality |
| `cleanup-transactions` | POST | service | Clean bad transactions |
| `clear-data` | POST | service | Clear test data |
| `fix-inventory-rls` | POST | service | Fix inventory RLS policies |
| `fix-peer-productivity` | POST | service | Fix peer metrics |
| `fix-rls` | POST | service | Fix RLS policies |
| `fix-staff-rls` | POST | service | Fix staff RLS |
| `apply-currency-migration` | POST | service | Add currency to regions |
| `apply-migration` | POST | service | Run named migration |
| `apply-rls-fix` | POST | service | Apply RLS fixes |
| `migrate-outlet-features` | POST | service | Migrate outlet features |
| `patch-outlet-names` | POST | service | Update outlet names |
| `update-outlet-details` | POST | service | Bulk outlet update |
| `debug-db` | GET | service | Debug DB state |
| `qa-fix-final` | POST | service | Final QA fixes |

## Seed Functions (Development Only)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `seed-franchises` | service | Seed regions + outlets |
| `seed-sales` | service | Seed sales transactions |
| `seed-outlet-features` | service | Seed ML features |
| `seed-inventory` | service | Seed inventory |
| `seed-staff` | service | Seed staff |
| `seed-singapore` | service | Seed SG outlets |
| `seed-singapore-outlets` | service | Seed SG-specific outlets |
| `seed-data` | service | Full seed |
| `seed-all` | service | Complete seed (all entities) |
| `seed-all-region-sales` | service | Seed sales by region |
| `seed-historical-sales` | service | Historical sales |
| `seed-test-outlets` | service | Test outlets |
| `seed-user-outlets` | service | User-outlet assignments |
| `seed-workflow-data` | service | Workflow seed data |
| `seed-notification-logs` | service | Notification seed |
| `seed-alerts` | service | Alert seed |
| `seed-embeddings` | service | KB embeddings seed |
| `seed-ml-models` | service | ML model registry |
| `seed-stockout-risk` | service | Stockout risk seed |
| `seed-demo-complete` | service | Full demo dataset |

## Financing

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `lender-bridge` | GET | user | Lender info + webhooks |
| `repayment-alert-generator` | POST | service | Generate repayment alerts |
| `repayment-risk-scorer` | GET | user | Repayment risk scores |

## Request/Response Patterns

### Authenticated Request
```typescript
fetch("/functions/v1/<endpoint>", {
  headers: {
    "Authorization": `Bearer ${session.access_token}`,
    "Content-Type": "application/json"
  }
})
```

### Dev Bypass (pos-webhook only)
```typescript
headers["x-pos-dev-bypass"] = "dev-mode-2026"
```

### Pagination
Use Supabase `.range(start, end)` via query params:
```
?select=*&range=0-24
```

### Error Response
```json
{ "error": "message", "code": "ERROR_CODE" }
```

### Success (edge functions)
```json
{ "success": true, "data": {} }
```

## Rate Limits

No explicit rate limits documented. Edge Functions scale to ~1000 concurrent.
