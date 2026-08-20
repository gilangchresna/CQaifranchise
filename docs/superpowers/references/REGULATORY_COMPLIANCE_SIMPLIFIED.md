# CQaiFranchise - Regulatory Compliance Reference

> Captured: 2026-08-26 from Jarrod Chua clarification

## Critical Clarification: Government Filing Compliance

### What We Need

**URL links only** - the platform just needs to store links to official government platforms.

**NOT:** Full document replication or complex workflow

### Required Fields per Profile

```typescript
interface RegulatoryFilingLinks {
  // Singapore
  acra_bizfile_url?: string;      // https://bizfile.gov.sg
  
  // Indonesia  
  ahu_annual_report_url?: string; // https://ahu.go.id
  oss_lkpm_url?: string;          // https://oss.go.id
  djp_spt_url?: string;           // https://pajak.go.id
  
  // Metadata
  last_verified_date?: string;
  filing_status?: 'FILED' | 'PENDING' | 'OVERDUE';
}
```

### Singapore Filing Requirements

| Source | Platform | What to Link |
|--------|----------|--------------|
| ACRA Annual Return | BizFile+ | Link to filed return |
| XBRL Financial Statements | BizFile+ | Yes/No flag + link |

**Deadline:** 7 months after FYE (private); 5 months (public)
**Late penalty:** S$300-600 + court prosecution

### Indonesia Filing Requirements

| Source | Platform | Frequency | Deadline |
|--------|----------|-----------|----------|
| AHU Annual Report | ahu.go.id | Annual | June 2026 cycle |
| LKPM (Investment) | oss.go.id | Quarterly | Q+15 days |
| SPT Tahunan (Tax) | pajak.go.id | Annual | 4 months after FYE |

**Deadline:** LKPM Q2 window closed 15 July 2026

### Implementation Effort

| Task | Effort |
|------|--------|
| Add fields to profile schema | 1 hour |
| Display in UI | 1 hour |
| Link verification | 1 hour |
| **Total** | **3 hours** |

### User Flow

```
Franchisee Profile
        ↓
┌─────────────────────────────────────┐
│ 🇸🇬 Singapore                        │
│   □ ACRA BizFile: [link] ✅        │
│                                     │
│ 🇮🇩 Indonesia                       │
│   □ AHU Annual: [link] ✅          │
│   □ OSS LKPM: [link] ✅ Q2 2026  │
│   □ DJP SPT: [link] ✅            │
└─────────────────────────────────────┘
        ↓
Lender clicks link → verifies on official government site
```

## Two Types of Compliance

| Type | Purpose | Implementation |
|------|---------|----------------|
| **Regulatory Compliance** | Legal requirement (PDPA, MAS TRM, UU PDP, OJK) | URL links in profile |
| **Franchise Compliance** | Loan assessment | Audit scores, brand standards |

**Key insight:** Do NOT conflate these. Regulatory compliance = URL links only.

## PDPA Compliance Status (Already Done)

- ✅ Consent Dialog implemented
- ✅ Encrypted storage
- ✅ Audit trail (partial)

## What Still Needed

| Requirement | Status | Notes |
|------------|--------|-------|
| DPO appointment record | ❌ | Manual - not in system |
| Cross-border transfer flags | ❌ | Future feature |
| VAPT evidence | ❌ | External audit |
| Incident response workflow | ❌ | Future feature |
