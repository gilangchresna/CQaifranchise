# Multi-Country Financial Documents Plan

> **Goal:** Support financial document standards for all ASEAN franchise countries.

---

## Overview

| Aspect | Detail |
|--------|--------|
| **Duration** | 4 weeks |
| **Countries** | 6 ASEAN countries |
| **Documents** | 15+ document types |
| **Parsers** | 6 country-specific parsers |

---

## Countries & Documents

### 🇸🇬 Singapore
| Document | Authority | Key Data |
|----------|-----------|----------|
| ACRA Annual Return | ACRA | Revenue, profit, company info |
| IRAS Notice of Assessment | IRAS | Taxable income, tax paid |
| GST Return (F5) | IRAS | GST collected/paid |

### 🇲🇾 Malaysia
| Document | Authority | Key Data |
|----------|-----------|----------|
| SSM Annual Return | SSM | Company info, financial summary |
| LHDN Form C (EA) | LHDN | Employment income |
| CP500/CP600 | LHDN | Corporate tax |

### 🇮🇩 Indonesia
| Document | Authority | Key Data |
|----------|-----------|----------|
| SPT Tahunan (1770) | DJP | Annual tax return |
| LKPM (Quarterly) | BKPM | Business performance |
| Neraca (Balance Sheet) | DJP | Assets, liabilities |
| Laporan Laba Rugi (P&L) | DJP | Revenue, expenses |

### 🇵🇭 Philippines
| Document | Authority | Key Data |
|----------|-----------|----------|
| SEC Form 17-A | SEC | Annual financial statements |
| BIR Form 1702 | BIR | Annual income tax |
| BIR Form 2550M | BIR | Quarterly percentage tax |

### 🇹🇭 Thailand
| Document | Authority | Key Data |
|----------|-----------|----------|
| DBD Annual Report | DBD | Company registration |
| PDMO Tax Forms | RD | Corporate income tax |

### 🇻🇳 Vietnam
| Document | Authority | Key Data |
|----------|-----------|----------|
| ERC (Enterprise Registration) | DPI | Company info |
| Annual Tax Declaration | Tax Dept | Revenue, profit, tax |

---

## Implementation Plan

### Week 1: Foundation + Singapore
| Day | Task |
|-----|------|
| 1 | Add country selector UI |
| 2 | Create country config system |
| 3-5 | **Singapore parser** (ACRA, IRAS) |

### Week 2: Malaysia + Indonesia
| Day | Task |
|-----|------|
| 1-3 | **Malaysia parser** (SSM, LHDN) |
| 4-5 | **Indonesia parser** (SPT, LKPM, Neraca) |

### Week 3: Philippines + Thailand + Vietnam
| Day | Task |
|-----|------|
| 1-2 | **Philippines parser** (SEC, BIR) |
| 3-4 | **Thailand parser** (DBD, RD) |
| 5 | **Vietnam parser** (ERC, Tax) |

### Week 4: Integration + Testing
| Day | Task |
|-----|------|
| 1-2 | Connect all parsers to UI |
| 3-4 | Testing across countries |
| 5 | Documentation + deployment |

---

## Database Schema Changes

```sql
-- Add country field to financial_documents
ALTER TABLE financial_documents ADD COLUMN country_code VARCHAR(3);

-- Supported countries
CREATE TYPE country_code AS ENUM (
  'SGP',  -- Singapore
  'MYS',  -- Malaysia
  'IDN',  -- Indonesia
  'PHL',  -- Philippines
  'THA',  -- Thailand
  'VNM'   -- Vietnam
);
```

---

## Country Configuration

```typescript
interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  documentTypes: DocumentType[];
  parser: string; // Edge function name
}

const COUNTRIES: CountryConfig[] = [
  {
    code: 'SGP',
    name: 'Singapore',
    currency: 'SGD',
    documentTypes: ['ACRA_ANNUAL', 'IRAS_NOA', 'GST_RETURN'],
    parser: 'singapore-parser'
  },
  {
    code: 'MYS',
    name: 'Malaysia',
    currency: 'MYR',
    documentTypes: ['SSM_ANNUAL', 'LHDN_FORM_C', 'CP500'],
    parser: 'malaysia-parser'
  },
  // ... etc
];
```

---

## Edge Functions Architecture

```
supabase/functions/
├── financial-parser/           # Main dispatcher
│   └── index.ts               # Routes to country parsers
├── parsers/
│   ├── singapore-parser.ts    # ACRA, IRAS
│   ├── malaysia-parser.ts      # SSM, LHDN
│   ├── indonesia-parser.ts     # SPT, LKPM
│   ├── philippines-parser.ts   # SEC, BIR
│   ├── thailand-parser.ts      # DBD, RD
│   └── vietnam-parser.ts       # ERC, Tax
```

---

## Effort Breakdown

| Component | Hours | Notes |
|-----------|-------|-------|
| Country selector UI | 8 | Dropdown + validation |
| Country config system | 8 | Centralized config |
| Singapore parser | 16 | ACRA, IRAS patterns |
| Malaysia parser | 20 | SSM, LHDN formats |
| Indonesia parser | 24 | Local language support |
| Philippines parser | 20 | SEC, BIR forms |
| Thailand parser | 16 | DBD format |
| Vietnam parser | 16 | Vietnamese text |
| Testing | 24 | All countries |
| Documentation | 8 | User guides |
| **Total** | **~160 hours** | **4 weeks** |

---

## Key Challenges

| Challenge | Impact | Solution |
|-----------|--------|----------|
| Language differences | High | Unicode support, local fonts |
| PDF format variety | Medium | Multiple parser patterns |
| Data field naming | Medium | Standardized internal schema |
| Document verification | High | Confidence scoring |
| Currency conversion | Low | Use stored currency, convert on display |

---

## Standardized Output Schema

All parsers output same format:

```typescript
interface FinancialMetrics {
  // Company Info
  company_name: string;
  registration_number: string;
  country: string;
  
  // Income Statement
  revenue: number;
  currency: string;
  fiscal_year: string;
  gross_profit?: number;
  net_profit?: number;
  
  // Balance Sheet
  total_assets?: number;
  total_liabilities?: number;
  shareholders_equity?: number;
  
  // Ratios (calculated)
  gross_margin?: number;
  net_margin?: number;
  roa?: number;
  roe?: number;
  debt_ratio?: number;
  
  // Metadata
  confidence_score: number;
  source_document: string;
  extraction_date: string;
}
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Supported countries | 6 |
| Document types | 15+ |
| Parser accuracy | > 80% |
| Coverage per country | > 90% |

---

## Rollout Strategy

| Phase | Countries | Documents |
|-------|-----------|-----------|
| Phase 1 | Singapore | 3 types |
| Phase 2 | Malaysia, Indonesia | 6 types |
| Phase 3 | Philippines, Thailand, Vietnam | 9 types |

---

## Summary

| Item | Value |
|------|-------|
| **Duration** | 4 weeks |
| **Effort** | ~160 hours |
| **Countries** | 6 |
| **Document Types** | 15+ |
| **Parsers** | 6 country-specific |

---

## Decision

| Option | Timeline | Coverage |
|--------|----------|----------|
| A. Singapore Only | 1 week | 1 country |
| B. Singapore + MY + ID | 2 weeks | 3 countries |
| **C. All 6 Countries** | 4 weeks | 6 countries |

---

**Ready to proceed with Option C (All 6 Countries)?**

**A.** Yes, implement all 6 countries

**B.** Start with Phase 1+2 (3 countries)

**C.** Modify scope
