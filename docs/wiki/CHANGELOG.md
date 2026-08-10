# Changelog

All notable changes to the CQaiFranchise platform.

---

## [2026-08-11] Sprint Fixes — Bug Fixes + Missing Items

### Layer 2 — Integration

| Item | Status | Notes |
|------|--------|-------|
| pos-webhook CORS `*` | ✅ Fixed | Narrowed to `https://cqaifranchise.vercel.app` |

### Layer 4 — Business Logic

| Item | Status | Notes |
|------|--------|-------|
| coordinator-pipeline cron | ✅ Registered | pg_cron: every 15 min |
| outlet_features ETL | ✅ Rewritten | Now computes from `sales_transactions` (33K+ txns → 20 outlets) |

### Layer 5 — Agent System

| Item | Status | Notes |
|------|--------|-------|
| agent-coordinator ANON_KEY | ✅ Fixed | Now uses `SERVICE_ROLE_KEY` |

### Layer 6 — API

| Item | Status | Notes |
|------|--------|-------|
| alerts-list role filter | ✅ Fixed | Now applies actual role scoping + `!= RESOLVED` |
| dashboard-full active_alerts | ✅ Fixed | Counts `!= RESOLVED` (was `= NEW` only) |
| assigned_to_id type mismatch | ✅ Fixed | `number` → `string` in case-create |
| sla-escalator region_id null | ✅ Fixed | Derives from `outlets` JOIN |
| sla-escalator cron | ✅ Registered | pg_cron: every 15 min |
| cases-list edge function | ✅ New | Role-based scoping, FK joins |
| case-update edge function | ✅ New | Status/assignee/priority updates |
| ml-accuracy-tracker | ✅ New | TP/FP/FN logging + precision/recall/F1 metrics |

### Layer 7 — UI

| Item | Status | Notes |
|------|--------|-------|
| Case Management UI | ✅ New | `CasesList.tsx` component + nav routing |
| Cases nav item | ✅ Added | HQ + Regional sidebar menus |

### Layer 1 — Data

| Item | Status | Notes |
|------|--------|-------|
| Sample alerts | ✅ Seeded | 5 NEW alerts (ids 126-130) |

---

### Security Fixes
- **CORS** narrowed from `*` to Vercel origin on 4 edge functions
- **ANON_KEY** → `SERVICE_ROLE_KEY` in agent-coordinator
- **Replay protection** in pos-webhook: rejects transactions older than yesterday

### Data Fixes
- **alerts**: 30 non-RESOLVED (5 NEW, 25 ACKNOWLEDGED)
- **outlet_features**: computed from real `sales_transactions` data
- **dashboard chart**: transforms `daily_breakdown` → chart format
- **alerts-list**: missing `)` in PostgREST FK join — fixed

---

## [2026-08-10] Dashboard + Alerts Fixes

- Chart now uses real `daily_breakdown` data
- Dashboard shows real revenue from DB
- POS simulator active (S$8-23 per txn, 8-12s interval)

---

## [Earlier] MVP Core

- POS webhook ingestion
- ML anomaly detection
- Alert → Case workflow
- Athena chat integration
- Realtime transaction feed
