# AIFrCQ Team - CyberQuote Franchise Financing Platform
## Comprehensive Business Analysis & Technical Assessment

**Date:** August 20, 2026
**Prepared by:** AIFrCQ Development Team
**Version:** 1.0

---

## Executive Summary

This document provides a comprehensive analysis of the CyberQuote AI Franchise Financing Platform, covering business understanding, technical architecture, and implementation roadmap. The platform enables franchisors to offer financing products to their franchisees by leveraging operational data for credit assessment.

---

## 1. Problem Statement

### Core Challenge
Franchisees (SMEs) face significant barriers to accessing traditional financing:
- **Limited credit history** - SMEs often lack established credit profiles
- **Collateral requirements** - Banks require physical assets as security
- **Documentation burden** - Extensive paperwork and long approval times
- **Information asymmetry** - Lenders cannot see real-time franchise performance

### Market Context
| Market | Challenge | Opportunity |
|--------|-----------|-------------|
| Singapore | S$5B+ SME financing gap | Strong franchise ecosystem |
| Indonesia | Rp 1.2T+ MSME credit gap | 3M+ registered franchises |
| Regional | Fragmented lending criteria | Unified platform |

### Pain Points
| Stakeholder | Pain Point |
|-------------|------------|
| **Franchisee** | Cannot get loan for expansion/upgrading |
| **Franchisor** | Cannot grow network without capital support |
| **Lender** | No visibility into franchise performance |
| **Platform** | No standardization across countries |

---

## 2. Scope Definition

### In Scope (Current Phase)

#### Features
| Module | Components |
|--------|------------|
| **Data Collection** | POS integration, cash flow upload, bank statements, debt obligations |
| **Document Management** | KYC, regulatory filings, financial statements |
| **Franchisor Operations** | Outlet management, royalty tracking, compliance |
| **Financing Application** | Loan applications, PDPA consent, document requirements |
| **Basic Risk Assessment** | Payment history, cash flow analysis, leverage metrics |

#### Countries
| Phase | Countries | Timeline |
|-------|-----------|----------|
| Phase 1 (Current) | 🇸🇬 Singapore | Done |
| Phase 2 | 🇮🇩 Indonesia | Q4 2026 |
| Phase 3 | 🇲🇾🇹🇭🇵🇭 | 2027 |

#### Users
| Role | Count (SG) | Capabilities |
|------|-----------|--------------|
| HQ/Franchisor | 5-10 | Full system access, franchisee management |
| Regional Manager | 20-50 | Outlet oversight, reporting |
| Franchisee Owner | 200-500 | Own outlet data, financing application |
| Franchisee Staff | 500-1000 | Limited operational data entry |

### Out of Scope (Future Phases)

| Feature | Reason | Priority |
|---------|--------|----------|
| Credit Bureau Integration | Requires regulatory approval | P1-Future |
| Compliance Audit System | Manual process for now | P2-Future |
| Live POS Integration | API complexity | P2-Future |
| Multi-lender Marketplace | Governance complexity | P3-Future |
| AI-powered underwriting | Requires historical data | P3-Future |

---

## 3. Objectives

### Primary Objectives

| # | Objective | Success Metric | Target |
|---|----------|----------------|--------|
| 1 | Enable financing for 50+ franchisees | Loan applications submitted | Q4 2026 |
| 2 | Reduce loan approval time from 6 weeks to 3 days | Average approval time | < 72 hours |
| 3 | Provide lenders with standardized franchise data | Lenders on platform | 3 lenders |
| 4 | Achieve 90% document compliance rate | Required docs uploaded | > 90% |
| 5 | Generate 20% platform fee from facilitated loans | Revenue target | Rp 100M/mo |

### Secondary Objectives

| # | Objective | Success Metric |
|---|----------|----------------|
| 6 | Zero regulatory violations | Compliance incidents |
| 7 | < 5% default rate on facilitated loans | Loan defaults |
| 8 | NPS score > 50 from franchisees | User satisfaction |

---

## 4. Deliverables

### Phase 1 (Singapore - Complete)
| Deliverable | Status | Notes |
|------------|--------|-------|
| POS Data Integration | ✅ Done | CSV upload, bank statement parsing |
| Cash Flow Dashboard | ✅ Done | Monthly aggregation, trends |
| Document Vault | ✅ Done | Upload, storage, delete |
| Regulatory Filings | ✅ Done | ACRA, AHU, LKPM, SPT links |
| Financing Application | ✅ Done | Apply, PDPA consent, gating |
| Risk Score (75%) | ✅ Done | Payment 35%, CashFlow 25%, Leverage 15% |

### Phase 2 (Indonesia - Q4 2026)
| Deliverable | Target Date | Dependencies |
|------------|-------------|--------------|
| LKPM Integration | Oct 2026 | BKPM API access |
| Multi-country Risk Formula | Nov 2026 | SG learnings |
| Currency Handling (IDR) | Oct 2026 | Currency module |
| Indonesian Documents | Oct 2026 | AHU, DJP |
| Bahasa Interface | Nov 2026 | i18n module |

### Phase 3 (Regional - 2027)
| Deliverable | Target Date | Countries |
|-------------|-------------|-----------|
| Malaysia | Q1 2027 | MY |
| Thailand | Q2 2027 | TH |
| Philippines | Q3 2027 | PH |
| Vietnam | Q4 2027 | VN |

---

## 5. Milestones

### Timeline Overview

```
2026
├── Q1 (Done)
│   └── Core platform launched
├── Q2 (Done)
│   └── Cash flow system, bank parsing
├── Q3 (Current)
│   ├── Aug: Regulatory docs enforcement
│   ├── Sep: Risk score calculation
│   └── Oct: Risk score + Dashboard
│
└── Q4 (Planned)
    ├── Nov: Indonesia pilot
    ├── Dec: 3 lenders onboarded
    └── Dec: 50 franchisees financed

2027
├── Q1: Malaysia launch
├── Q2: Thailand launch
├── Q3: Philippines launch
└── Q4: Vietnam launch
```

### Detailed Milestones

| Milestone | Target | Criteria | Owner |
|-----------|--------|----------|-------|
| Regulatory Docs Enforcement | Aug 2026 | HQ can upload, franchisee blocked | Stefanus |
| Risk Score Calculation | Sep 2026 | Configurable weights per lender | Stefanus |
| Lender Dashboard | Oct 2026 | Lender can view franchisee data | Stefanus |
| Indonesia Pilot | Nov 2026 | 10 Indonesian franchisees | Team |
| 3 Lenders Onboarded | Dec 2026 | Signed agreements | Finance |
| 50 Financed | Dec 2026 | Loans facilitated | Business |

---

## 6. Risks & Mitigations

### High Priority Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Regulatory changes (PDPA/OJK) | 🔴 High | Medium | Quarterly compliance audit |
| Lender adoption low | 🔴 High | Medium | Pilot with 3 committed lenders |
| Data quality issues | 🟡 Med | High | Validation at upload, alerts |
| Franchisee drop-off | 🟡 Med | Medium | Automated reminders, support |

### Medium Priority Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API reliability (Gov portals) | 🟡 Med | Low | Fallback to manual verification |
| Currency volatility (IDR) | 🟡 Med | Medium | Locked exchange rates |
| Key person dependency | 🟡 Med | High | Documentation, backups |
| Security breach | 🔴 High | Low | Pentest, SOC 2, encryption |

### Low Priority Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Competitor launch | 🟢 Low | Medium | Differentiate on data quality |
| Economic downturn | 🟡 Med | Medium | Stress test models |

---

## 7. Governance Guidelines

### Data Governance

| Principle | Implementation |
|-----------|---------------|
| **Purpose limitation** | Data only used for agreed financing purposes |
| **Consent required** | PDPA/OJK consent before data sharing |
| **Retention limits** | Data kept max 7 years, then purged |
| **Access control** | Role-based, audited access logs |

### Operational Governance

| Process | Frequency | Owner |
|---------|-----------|-------|
| Document compliance review | Monthly | Compliance |
| Risk model validation | Quarterly | Data Science |
| Lender SLA monitoring | Weekly | Operations |
| Security audit | Annually | IT |

### Regulatory Compliance

| Regulation | Jurisdiction | Status |
|-----------|--------------|--------|
| PDPA | Singapore | ✅ Compliant |
| MAS TRM | Singapore | ✅ Compliant |
| UU PDP | Indonesia | ✅ Compliant (Oct 2026) |
| OJK POJK | Indonesia | ✅ Planned (Q4 2026) |

---

## 8. Evaluation Metrics

### Platform Metrics

| Metric | Baseline | Target | Frequency |
|--------|----------|--------|----------|
| Active franchisees | 0 | 200 | Monthly |
| Documents uploaded | 0 | 500 | Monthly |
| Financing applications | 0 | 50 | Monthly |
| Approval rate | N/A | 70% | Monthly |
| Average approval time | 42 days | 3 days | Monthly |

### Technical Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| System uptime | 99.9% | < 99.5% |
| API response time | < 200ms | > 500ms |
| Document upload success | 99% | < 95% |
| Error rate | < 0.1% | > 1% |
| Security incidents | 0 | > 0 |

### Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Platform revenue | Rp 100M/mo | Monthly recurring |
| Lender satisfaction | NPS > 50 | Quarterly survey |
| Franchisee satisfaction | NPS > 40 | Quarterly survey |
| Default rate | < 5% | Quarterly |

---

## 9. Technical Details

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Dashboard│ │ Outlets │ │Financing│ │Documents│ │ Reports │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
└───────┼───────────┼───────────┼───────────┼───────────┼──────────┘
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Backend)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    PostgREST API                         │   │
│  │  ├── user_profiles      ├── outlets                      │   │
│  │  ├── royalty_payments   ├── cash_flow_transactions       │   │
│  │  ├── debt_obligations   ├── documents                    │   │
│  │  └── financing_applications                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Edge Functions (Deno)                    │   │
│  │  ├── cashflow-import      ├── bank-statement-parse       │   │
│  │  ├── financial-statement  ├── check-required-docs          │   │
│  │  └── risk-score-calc                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Storage Buckets                         │   │
│  │  ├── franchise-documents  (encrypted)                     │   │
│  │  └── public-templates                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Gov APIs  │ │  Banks   │ │  Lender  │ │   POS    │         │
│  │(BizFile) │ │ (DBS/OC) │ │ Systems  │ │ Systems  │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Key Modules

| Module | Responsibility | Files | Complexity |
|--------|---------------|-------|------------|
| **Authentication** | User auth, roles, permissions | Login.tsx, App.tsx | Medium |
| **Outlet Management** | CRUD outlets, assignments | Outlets.tsx | Low |
| **Data Collection** | POS, cash flow, debt upload | CashFlowUpload, BankStatementUpload | Medium |
| **Document Vault** | Storage, retrieval, delete | DocumentVault, DocumentUpload | Low |
| **Financing Application** | Apply, consent, gating | Financing.tsx, ConsentDialog | High |
| **Risk Calculation** | Weighted scoring | risk-score-calc (edge) | High |
| **Reporting** | Aggregations, trends | Dashboard.tsx, PeerBenchmark | Medium |

### Data Models

```
┌─────────────────┐     ┌─────────────────┐
│   user_profiles │     │     outlets     │
├─────────────────┤     ├─────────────────┤
│ id (UUID)       │────<│ id (UUID)        │
│ role            │     │ owner_id (FK)   │
│ region_id       │     │ name            │
│ filing_links    │     │ region_id       │
└─────────────────┘     └─────────────────┘
        │
        │
┌───────┴───────────────────────────────────────────┐
│                  DATA TABLES                       │
├───────────────────────────────────────────────────┤
│ royalty_payments                                  │
│ - id, outlet_id, amount, payment_date, status   │
│                                                   │
│ cash_flow_transactions                            │
│ - id, outlet_id, date, type, amount, category    │
│                                                   │
│ debt_obligations                                  │
│ - id, outlet_id, creditor, outstanding_balance  │
│                                                   │
│ documents                                         │
│ - id, user_id, file_name, document_type          │
│                                                   │
│ financing_applications                            │
│ - id, applicant_id, amount, purpose, status     │
└───────────────────────────────────────────────────┘
```

---

## 10. Testing Strategy

### Unit Tests (Current)

| Category | Test Count | Coverage |
|----------|------------|----------|
| Edge Functions | 188 | ML, alerts, cases, docs |
| Validation Logic | 100% | Core business rules |
| UI Components | Manual | Key flows |

### Integration Tests (Planned)

| Test | Trigger | Owner |
|------|---------|-------|
| Document upload → storage | Every PR | CI/CD |
| Financing gate → approval | Weekly | QA |
| Risk score → lender API | Monthly | Stefanus |

### E2E Tests (Future)

| Scenario | Frequency | Tool |
|----------|-----------|------|
| Full financing flow | Bi-weekly | Playwright |
| Multi-lender scenario | Monthly | Playwright |
| Stress test (100 users) | Quarterly | k6 |

### Testing Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Development | localhost:5173 | Local dev |
| Staging | cqaifrc.cqit.sg | Testing |
| Production | tbd | Live data |

---

## 11. Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| Vite | 5.x | Build tool |
| Lucide React | latest | Icons |
| Recharts | latest | Charts |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Supabase | Cloud | Database, Auth, Storage |
| Edge Functions | Deno | Serverless logic |
| PostgREST | - | Auto REST API |
| Row Level Security | - | Data access control |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| Vercel | Frontend hosting |
| Supabase Cloud | Database & storage |
| Cloudflare | CDN, DDoS protection |
| GitHub | Version control, CI/CD |

### Monitoring & Observability

| Tool | Purpose |
|------|---------|
| Vercel Analytics | Frontend performance |
| Supabase Logs | Backend errors |
| Sentry | Error tracking |

---

## 12. Timeline (Detailed)

### Q3 2026 (Remaining)

| Month | Deliverable | Owner | Dependencies |
|-------|-------------|-------|--------------|
| Aug | Regulatory docs enforcement | Stefanus | ✅ |
| Aug | Filing links UI | Stefanus | ✅ |
| Sep | Risk score calculation (configurable) | Stefanus | Aug |
| Sep | Lender dashboard | Stefanus | Sep |
| Oct | Dashboard summary | Stefanus | Sep |
| Oct | Email notifications | Stefanus | Aug |

### Q4 2026

| Month | Deliverable | Owner | Dependencies |
|-------|-------------|-------|--------------|
| Nov | Indonesia pilot setup | Team | Q3 complete |
| Nov | Indonesia documents | Stefanus | Nov |
| Dec | 3 lenders onboarded | Finance | Nov |
| Dec | 50 financed | Business | Dec |

### 2027

| Quarter | Focus | Deliverable |
|---------|-------|-------------|
| Q1 | Malaysia | MY franchisees, lenders |
| Q2 | Thailand | TH franchisees, lenders |
| Q3 | Philippines | PH franchisees, lenders |
| Q4 | Vietnam | VN franchisees, lenders |

---

## 13. Revenue Model

### Platform Fees

| Type | Rate | Trigger |
|------|------|---------|
| Origination fee | 1-2% of loan | Loan disbursed |
| Monthly subscription | Rp 500K-3M | Per lender |
| Data API access | Rp 1M/mo | Per lender |

### Revenue Projection

| Year | Loans Facilitated | Avg Size | Fee | Revenue |
|------|-------------------|----------|-----|---------|
| 2026 | Rp 5B | Rp 50M | 1.5% | Rp 75M |
| 2027 | Rp 50B | Rp 50M | 1.5% | Rp 750M |

---

## 14. Key Decisions Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Risk formula ownership | Lender config vs Platform standard | **Lender config** |
| Lender onboarding | Manual vs API | **Manual first** |
| Indonesia expansion | Build vs Partner | **Build** |
| Credit bureau | Integrate now vs Later | **Later** |

---

## 15. Recommendations

### Immediate Actions (Next 30 Days)

1. ✅ Complete regulatory docs enforcement
2. 🔲 Deploy configurable risk formula
3. 🔲 Build lender dashboard
4. 🔲 Onboard first pilot lender

### Short-term (Q4 2026)

1. Launch Indonesia pilot
2. Achieve 50 financed franchisees
3. Establish SLA with 3 lenders

### Medium-term (2027)

1. Expand to Malaysia, Thailand
2. Integrate credit bureau (if viable)
3. Develop AI underwriting (if data sufficient)

---

## 16. Conclusion

The CyberQuote Franchise Financing Platform addresses a real market gap by enabling data-driven financing for franchisees. With 75% of risk scoring implemented and clear path to 100%, the platform is well-positioned to facilitate meaningful financing volumes.

**Key Success Factors:**
- Lender adoption and engagement
- Data quality and completeness
- Regulatory compliance in Indonesia
- Operational excellence in onboarding

**Next Step:** Secure commitments from 3 pilot lenders and execute Indonesia pilot in Q4 2026.

---

**Document Ends**

*Prepared by AIFrCQ Development Team*
*For internal use and stakeholder alignment*
