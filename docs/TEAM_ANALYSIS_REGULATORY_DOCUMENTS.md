# Team Analysis: Regulatory Document Flow

## 📋 Analysis Date
**August 20, 2026**
**Prepared by:** AIFrCQ Team

---

## 🎯 Request Summary

From Jarrod (CTO/Owner):
1. Franchisor uploads regulatory documents (ACRA, AHU, LKPM, SPT)
2. Without documents, franchisee cannot obtain financing
3. Franchisee pays for documents (not platform)

---

## 🔍 Current System Analysis

### 1. Existing Roles

| Role | DB Role | Purpose | Status |
|------|---------|---------|--------|
| HQ | HQ_ADMIN | Franchisor | ✅ Built |
| Regional | REGIONAL_MANAGER | Franchisor's manager | ✅ Built |
| Franchisee | FRANCHISEE_OWNER | Outlet owner | ✅ Built |

### 2. Current Document System

| Component | Status |
|-----------|--------|
| `documents` table | ✅ Exists |
| Document upload UI | ✅ Built |
| Storage bucket | ✅ Exists |
| Document types | KYC, BANK, FINANCIAL, LEGAL |

### 3. Gap Analysis

| Required | Current Status | Gap |
|----------|---------------|-----|
| Regulatory doc types | Generic types only | ❌ Need ACRA, AHU, LKPM, SPT |
| Franchisor uploads | User uploads own docs | ❌ Need HQ can upload for franchisee |
| Document requirements | Not defined per country | ❌ Need requirement matrix |
| Financing gate | Not blocked | ❌ Need blocking logic |

---

## 📊 Document Requirements by Country

### 🇸🇬 Singapore

| Document | Source | Filed Via | Deadline | Required |
|----------|--------|-----------|----------|----------|
| ACRA Annual Return | ACRA | BizFile+ | 7 months after FYE | ✅ Yes |
| XBRL Financials | ACRA | BizFile+ | With Annual Return | ✅ Yes |

### 🇮🇩 Indonesia

| Document | Source | Filed Via | Deadline | Required |
|----------|--------|-----------|----------|----------|
| Annual Report (Laporan Tahunan) | AHU | AHU Online/SABH | June 30 yearly | ✅ Yes |
| LKPM (Quarterly) | BKPM | OSS (oss.go.id) | 15th after quarter | ✅ Yes |
| SPT Tahunan (Tax) | DJP | DJP (pajak.go.id) | 4 months after FYE | ✅ Yes |

---

## 🔄 Proposed Flow Analysis

### Flow 1: Document Upload by Franchisor

```
HQ Admin (Franchisor)
    │
    ├── Views list of franchisees
    │
    ├── Selects franchisee to upload docs
    │
    ├── Uploads required regulatory documents:
    │   ├── Singapore: ACRA, XBRL
    │   └── Indonesia: AHU, LKPM, SPT
    │
    └── System stores docs linked to franchisee
```

### Flow 2: Franchisee Financing Block

```
Franchisee
    │
    ├── Attempts to apply for financing
    │
    ├── System checks required documents:
    │   ├── Country-specific docs uploaded?
    │   └── All required docs present?
    │
    ├── If YES → Proceed with financing
    └── If NO → Block + Show missing docs
```

---

## ⚠️ Technical Challenges

### Challenge 1: Document Ownership
**Issue:** Current documents table links to uploader's user_id
**Solution:** Add `entity_id` (franchisee) separate from `uploaded_by_id` (HQ)

### Challenge 2: Country-Specific Requirements
**Issue:** Different docs for SG vs ID
**Solution:** Document requirements matrix by country

### Challenge 3: Financing Gate Logic
**Issue:** No blocking mechanism in financing flow
**Solution:** Add pre-check in financing application

---

## 📋 Required Changes

### 1. Database Changes

```sql
-- New table: regulatory_documents
CREATE TABLE regulatory_documents (
  id UUID PRIMARY KEY,
  entity_id UUID NOT NULL, -- franchisee user_id
  uploaded_by_id UUID NOT NULL, -- HQ admin user_id
  
  country VARCHAR(3) NOT NULL, -- 'SGP' or 'IDN'
  document_type VARCHAR(50) NOT NULL,
  -- 'SGP_ACRA_ANNUAL', 'SGP_XBRL', 
  -- 'IDN_AHU_ANNUAL', 'IDN_LKPM_Q1', 'IDN_LKPM_Q2', etc.
  
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  fiscal_year VARCHAR(10),
  period VARCHAR(10), -- 'Q1_2026', 'Q2_2026'
  
  uploaded_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID,
  verified_at TIMESTAMPTZ
);

-- Add to documents table (alternative)
ALTER TABLE documents ADD COLUMN entity_id UUID;
ALTER TABLE documents ADD COLUMN country VARCHAR(3);
ALTER TABLE documents ADD COLUMN fiscal_year VARCHAR(10);
```

### 2. UI Changes

| Component | Changes |
|-----------|---------|
| HQ Dashboard | Add "Manage Franchisee Documents" |
| HQ Document Upload | Entity selector (franchisee) + doc type |
| Franchisee Profile | Show required docs status |
| Financing Application | Add pre-check for required docs |

### 3. Logic Changes

| Logic | Implementation |
|-------|----------------|
| Check required docs | Function to verify all country docs present |
| Block financing | Return error if docs missing |
| Show missing docs | List all required but not uploaded |

---

## 📊 Effort Estimation

| Task | Hours | Complexity |
|------|-------|------------|
| DB migration (regulatory_docs) | 1 | Low |
| HQ document upload UI | 2 | Medium |
| Link docs to franchisee | 1 | Low |
| Document requirements matrix | 1 | Low |
| Financing gate logic | 2 | Medium |
| Test + deploy | 1 | Low |
| **TOTAL** | **8 hours** | **1 day** |

---

## 👥 Team Assignments

| Role | Tasks | Hours |
|------|-------|-------|
| **Stefanus** | DB + Backend + Gate Logic | 4 |
| **Frontend** | HQ Upload UI + Profile UI | 3 |
| **QA** | Test upload + blocking | 1 |

---

## ✅ Recommendations

### Priority 1 (P0): Core Flow
1. Create `regulatory_documents` table
2. HQ can upload docs for franchisee
3. Financing blocked if docs missing

### Priority 2 (P1): UX Improvements
4. Document requirements display
5. Filing deadline reminders
6. Document verification workflow

### Priority 3 (P2): Advanced
7. Link verification to official sites
8. Auto-reminders for renewals
9. Document expiration tracking

---

## 📝 Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Who verifies uploaded docs are authentic? | CTO | Pending |
| 2 | What happens if doc expires? | CTO | Pending |
| 3 | Should we integrate with official APIs? | CTO | Future |

---

## 📎 Appendices

### A. Document Type Codes

```
SGP_ACRA_ANNUAL      - ACRA Annual Return
SGP_ACRA_XBRL        - XBRL Financial Statements
IDN_AHU_ANNUAL       - AHU Annual Report
IDN_LKPM_Q1          - LKPM Q1
IDN_LKPM_Q2          - LKPM Q2
IDN_LKPM_Q3          - LKPM Q3
IDN_LKPM_Q4          - LKPM Q4
IDN_DJP_SPT          - DJP SPT Tahunan
```

### B. Required Docs by Country

| Country | Required Docs | Count |
|---------|---------------|-------|
| Singapore | SGP_ACRA_ANNUAL, SGP_ACRA_XBRL | 2 |
| Indonesia | IDN_AHU_ANNUAL, IDN_LKPM_Q1-Q4, IDN_DJP_SPT | 6 |

---

## ✅ Team Acknowledgment

| Role | Name | Acknowledge | Date |
|------|------|-------------|------|
| CTO | Gilang | ✅ | Aug 20, 2026 |
| Fullstack | Stefanus | ? | |
| Finance | Analyst | ? | |
| QA | Ops | ? | |

---

**End of Analysis**
