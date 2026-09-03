# CQaiFranchise — Comprehensive Audit Report

> **Document Version:** 2.0
> **Last Updated:** August 31, 2026
> **Status:** MVP 55% Complete

---

## Executive Summary

**Project:** CyberQuote AI Franchise Platform
**Phase:** MVP Development
**Database:** `ploqeifazcgzwjzmukgp`
**Staging:** https://cqaifrc.cqit.sg
**Codebase:** `/Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise`

---

## 📊 Project Overview

| Metric | Value |
|--------|-------|
| **Components** | 42 |
| **Edge Functions** | 126 |
| **DB Tables** | 71 |
| **MVP Progress** | **55%** |
| **Sprint Status** | Should be Sprint 5, at Sprint 4 |
| **Team Capacity** | ~3.2 FTE |

---

## ✅ COMPLETED Modules

### L1-L7 Architecture Status

| Layer | Feature | Status | Notes |
|-------|---------|--------|-------|
| **L1** | POS Webhook / Simulator | ✅ Complete | CSV ingestion works |
| **L1** | CSV Ingestion | ✅ Complete | Bank statement parser |
| **L1** | Bank Statement Parser | ✅ Complete | PDF/CSV support |
| **L2** | 6 AI Agents | ✅ Complete | Athena, Monitor, Analyst, Triage, Coordinator, Executor |
| **L2** | Coordinator Pipeline | ✅ Complete | Agent orchestration |
| **L3** | Sales Transactions | ✅ Complete | Outlet features |
| **L3** | Inventory Features | ✅ Complete | Stock tracking |
| **L4** | ML Anomaly Detection | ✅ Complete | `ml-anomaly-v2` |
| **L4** | ML Stockout Prediction | ✅ Complete | `ml-stockout-v2` |
| **L5** | Repayment Risk Scorer | ⚠️ Basic | Needs lender partner |
| **L5** | Lender Bridge | ⚠️ Basic | Not integrated |
| **L6** | Alert → Case Workflow | ✅ Complete | Aug 21, 2026 |
| **L6** | Royalty Module | ✅ Complete | Aug 31, 2026 |
| **L6** | SLA Escalator | ⚠️ **Partial** | Backend complete, frontend missing |
| **L6** | Stakeholder Reports | ⚠️ Basic | Basic implementation |
| **L7** | Singapore Pack | ⚠️ Partial | POS/API research done |
| **L7** | Indonesia Pack | ❌ Not built | Phase 2 |

---

## 🔌 Singapore POS Integration — Research Complete

### Market Analysis

| POS | API | Users | Status |
|-----|-----|-------|--------|
| **MEGAPOS/iMakan** | ✅ Public API | 1,000+ | **RECOMMENDED** |
| **Edgeworks** | ⚠️ Partnership | 3,000+ | Level 3 custom dev |
| **Raptor POS** | ⚠️ InterConnect | 7,000+ | Via Deliverect |
| **Qashier** | ❌ Limited | 25,000+ | Enterprise only |

### ❌ INCORRECT in Architecture Doc

| POS | Issue |
|-----|-------|
| **Square** | NOT available in SG |
| **Fave** | Consumer rewards app, NOT a POS |
| **Shopify POS** | Retail focus, not F&B native |

### ✅ MEGAPOS/iMakan API — Found

**Base URL:** `https://api.imakan.app`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/Order` | GET | Get orders by branch/station |
| `/api/onlineorder/{status}` | GET | Online orders |
| `/api/Member` | GET | Customer members |
| `/api/MemberItemHistory/{id}` | GET | Purchase history |
| `/api/order/save/{companycode}` | POST | Create order |

**API Docs:** https://api.imakan.app/Help

### Recommended Integration Priority

| # | POS | API | Effort | Notes |
|---|-----|-----|--------|-------|
| 1 | **MEGAPOS** | ✅ REST | 45-75h | Public API exists |
| 2 | **Edgeworks** | ⚠️ Partnership | 80-120h | Multi-outlet ready |
| 3 | **Raptor POS** | ⚠️ InterConnect | 60-100h | Via Deliverect |

### Integration Effort Summary

| POS | Development | Testing | Total |
|-----|-------------|---------|-------|
| MEGAPOS | 30-60h | 15h | **45-75h** |
| Edgeworks | 40-80h | 20h | **60-100h** |
| Raptor POS | 40-80h | 20h | **60-100h** |

---

## 📊 Open Banking / Bank GL — Singapore

### ✅ CORRECTED Approach

| Approach | Effort | Reality |
|----------|--------|---------|
| **SGFinDex** | 120h+ | MAS partnership required |
| **Bank Direct API** | 80h+ | DBS, OCBC, UOB different APIs |
| **CSV/PDF Upload** | 16h | ✅ **MVP Approach** |

**Recommendation:** Use existing bank statement parser with CSV/PDF upload.
- SGFinDex and Bank APIs are Phase 2 (post-MVP)
- Current parser can extract transactions for anomaly detection

---

## 📚 Xero Accounting Integration

### ✅ Xero API — Developer Friendly

| Feature | Status |
|---------|--------|
| **REST API** | ✅ Complete |
| **Webhooks** | ✅ Full |
| **OAuth 2.0** | ✅ Standard |
| **SDKs** | ✅ Node, Python, PHP, .NET, Go, Java |
| **Sandbox** | ✅ Free demo company |
| **Rate Limit** | 5,000 calls/day |
| **POS Guide** | ✅ Specific guide exists |

### Resources

| Resource | URL |
|----------|-----|
| **Developer Portal** | `developer.xero.com` |
| **API Docs** | `developer.xero.com/documentation` |
| **Webhooks** | `developer.xero.com/documentation/guides/webhooks/overview` |
| **POS Integration Guide** | `developer.xero.com/documentation/guides/how-to-guides/how-to-integrate-my-pos-system-with-xero` |

### Integration Pattern

```
┌─────────────────────────────────────────────────────────────┐
│  CQaiFranchise Data Sources                                │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │  MEGAPOS    │    │  Xero API    │    │  Bank      │  │
│  │  (iMakan)  │    │  (Accounting)│    │  CSV Upload│  │
│  └──────┬───────┘    └──────┬───────┘    └─────┬──────┘  │
│         │                    │                   │         │
│         ▼                    ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  AI Agents: Anomaly Detection, Risk Scoring, etc.   │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Xero Integration Effort

| Phase | Task | Effort |
|-------|------|--------|
| 1 | OAuth Setup | 4h |
| 2 | Pull Invoices/Payments | 8h |
| 3 | Push Royalty Invoices | 8h |
| 4 | Webhook Handler | 8h |
| 5 | Connect to AI Agents | 8h |
| **Total** | | **36h** |

---

## ⚠️ SLA Escalator — Partial

### What EXISTS (Backend)

| Component | Status | File |
|-----------|--------|------|
| **Edge Function** | ✅ Complete | `sla-escalator/index.ts` (515 lines) |
| **Table** | ✅ Created | `sla_escalation_runs` |
| **Escalation Logic** | ✅ Complete | Role-based chain |
| **Warning System** | ✅ Complete | 50%/75% thresholds |
| **Notification Trigger** | ✅ Complete | Calls `notification-trigger` |

### What is MISSING

| Component | Status | Notes |
|-----------|--------|-------|
| **Cron Config** | ❌ Not verified | Not in cron jobs list |
| **UI Dashboard** | ❌ Not found | No SLA status page |
| **Case SLA Display** | ❌ Not found | No SLA deadline on cases |
| **Escalation History UI** | ❌ Not found | Can't see escalation log |
| **Settings UI** | ❌ Not found | Can't configure thresholds |

### Escalation Chain

```
OUTLET_STAFF → FRANCHISEE_OWNER → AREA_LEAD → REGIONAL_MANAGER → HQ_ADMIN
     ↓              ↓                    ↓              ↓              ↓
   P3/Low       P3/Low             P2/Med         P2/Med         P1/P0
```

### Effort to Complete

| Task | Effort | Priority |
|------|--------|----------|
| Cron Setup | 1h | High |
| Case UI - Show SLA | 4h | High |
| Escalation History Page | 4h | Medium |
| SLA Settings UI | 4h | Medium |
| Email Template | 2h | High |
| **Total** | **15h** | |

---

## ❌ Architecture Doc Corrections Needed

### Singapore Pack - POS Connectors

```diff
# Current (INCORRECT):
POS Connectors: StoreHub, Shopify POS, Square, Oddle, Fave

# Corrected:
POS Connectors: MEGAPOS, Edgeworks, Raptor POS, Qashier, StoreHub
- Square ❌ (NOT available in SG)
- Fave ❌ (Consumer rewards app, NOT POS)
- Shopify ⚠️ (Retail focus, not F&B native)
```

### Singapore Pack - Open Banking

```diff
# Current (INCORRECT):
Open Banking / Bank GL: SGFinDex-aligned API or participating bank direct API

# Corrected:
Open Banking / Bank GL: Manual CSV/PDF upload
- Bank statement parser (existing)
- SGFinDex/Bank API: Phase 2 (post-MVP)
```

---

## 🎯 Immediate Next Steps

### Priority 1: Demo-Ready MVP

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1 | Verify Royalty Module in browser | 1h | ⬜ |
| 2 | Setup SLA Escalator cron | 1h | ⬜ |
| 3 | Test Alert → Case workflow | 2h | ⬜ |
| 4 | Complete SLA UI | 15h | ⬜ |
| 5 | Update Architecture Doc | 2h | ⬜ |

### Priority 2: Technical Debt

| # | Task | Effort |
|---|------|--------|
| 1 | Create unit test suite | 40h |
| 2 | Remove temp fix-* scripts | 16h |
| 3 | Add error handling to edge functions | 24h |

### Priority 3: Integration (Phase 2)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 1 | MEGAPOS integration | 45-75h | Has public API |
| 2 | Xero integration | 36h | Developer-friendly |
| 3 | SGFinDex/Bank API | 120h+ | Phase 3 |

---

## 📁 Documentation Files

| Location | File | Status |
|----------|------|--------|
| Obsidian | `02-Technical-Specs/POS-Integration.md` | ✅ Updated Aug 31 |
| Obsidian | `02-Technical-Specs/Royalty/*` | ✅ Complete |
| Codebase | `docs/wiki/POS-Integration-SG.md` | ✅ Updated |
| Codebase | `docs/wiki/SLA-Escalator-Audit.md` | ⬜ To create |

---

## 🧪 Testing Status

| Area | Coverage | Notes |
|------|----------|-------|
| Edge Functions | 0% unit tests | No test suite |
| React Components | Manual only | No Playwright/Cypress |
| Integration | Demo walkthrough | Not automated |
| UAT | Part-time | Finance Analyst 30% |

---

## 📅 Project Timeline

```
PHASE 1: MVP Polish (Aug 1 - Aug 31) ← WE ARE HERE
├── ✅ L6 Workflow (Aug 21)
├── ✅ Royalty Module (Aug 31)
├── 🔄 SLA Escalator completion
├── 🔄 Architecture Doc corrections
└── 🔄 Demo walkthrough

PHASE 2: Real Integration (Sep - Oct)
├── MEGAPOS POS Integration
├── Xero Accounting Integration
├── SLA UI Completion
└── Risk Dashboard Enhancement

PHASE 3: Scale (Oct - Dec)
├── SGFinDex/Bank API
├── Additional franchise modules
└── Quarterly ML recalibration
```

---

## 📊 Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| MVP Progress | 55% | 100% |
| Components | 42 | ~50 |
| Edge Functions | 126 | ~140 |
| Team Capacity | 3.2 FTE | 4.0 FTE |
| Sprint | 4 | 5 |

---

**Document Status:** Complete
**Next Review:** September 7, 2026
**Owner:** CTO
