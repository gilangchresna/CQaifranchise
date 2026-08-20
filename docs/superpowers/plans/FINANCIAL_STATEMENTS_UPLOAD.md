# Financial Statements Upload - Implementation Plan

> **Goal:** Allow franchisees to upload and manage financial documents (ACRA filings, P&L statements, balance sheets) for credit assessment.

---

## Overview

| Aspect | Detail |
|--------|--------|
| **Effort** | 2 weeks (standalone) |
| **Components** | 4 frontend + 2 backend |
| **Database** | 2 new tables |
| **Integration** | Document Vault (reuse existing) |

---

## Current State

| Component | Status |
|-----------|--------|
| Document Vault | ✅ Implemented |
| Document Upload | ✅ Implemented |
| Document Types | ⚠️ Limited categories |
| Financial Docs | ❌ No specific handling |
| ACRA Parsing | ❌ Not implemented |
| P&L Extraction | ❌ Not implemented |

---

## Problem Statement

**Current Issue:**
- Documents uploaded but not categorized as financial statements
- No structured data extraction from ACRA/PDF
- Cannot feed into credit assessment automatically

**User Need:**
- Upload ACRA BizFile (annual filings)
- Upload management accounts (P&L, Balance Sheet)
- System extracts key metrics automatically
- Data flows into credit assessment

---

## Document Types

### 1. ACRA Annual Return
| Document | Data to Extract |
|----------|----------------|
| BizFile PDF | Company name, UEN, incorporation date |
| Annual Return | Revenue, expenses, assets, liabilities |
| Financial Statements | Net profit, shareholders equity |

### 2. Management Accounts
| Document | Data to Extract |
|----------|----------------|
| P&L Statement | Revenue, COGS, gross profit, net profit |
| Balance Sheet | Total assets, liabilities, equity |
| Cash Flow | Operating/Investing/Financing flows |

### 3. Tax Documents
| Document | Data to Extract |
|----------|----------------|
| IRAS Notice of Assessment | Taxable income, tax payable |
| GST Returns | Revenue, GST collected/paid |

---

## Database Design

### Table: financial_documents
```sql
CREATE TABLE financial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  document_type VARCHAR(50) NOT NULL, -- 'ACRA_ANNUAL', 'PNL', 'BALANCE_SHEET', 'CASH_FLOW', 'TAX_ASSESSMENT'
  document_subtype VARCHAR(50), -- 'MANAGEMENT', 'AUDITED', 'DRAFT'
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- File storage
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  
  -- Extracted data (JSONB for flexibility)
  extracted_data JSONB DEFAULT '{}',
  
  -- Key metrics for credit assessment
  fiscal_year VARCHAR(10),
  reporting_period_start DATE,
  reporting_period_end DATE,
  revenue DECIMAL(15,2),
  gross_profit DECIMAL(15,2),
  net_profit DECIMAL(15,2),
  total_assets DECIMAL(15,2),
  total_liabilities DECIMAL(15,2),
  shareholders_equity DECIMAL(15,2),
  current_ratio DECIMAL(5,2),
  debt_ratio DECIMAL(5,2),
  profit_margin DECIMAL(5,2),
  
  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_financial_docs_user ON financial_documents(user_id);
CREATE INDEX idx_financial_docs_type ON financial_documents(document_type);
CREATE INDEX idx_financial_docs_fiscal_year ON financial_documents(fiscal_year);
CREATE INDEX idx_financial_docs_revenue ON financial_documents(revenue);
```

### Table: financial_metrics_snapshot
```sql
CREATE TABLE financial_metrics_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  snapshot_date DATE NOT NULL,
  
  -- Period metrics
  period_type VARCHAR(20) NOT NULL, -- 'MONTHLY', 'QUARTERLY', 'ANNUAL'
  fiscal_year VARCHAR(10),
  
  -- Income Statement Metrics
  revenue DECIMAL(15,2),
  cost_of_goods_sold DECIMAL(15,2),
  gross_profit DECIMAL(15,2),
  operating_expenses DECIMAL(15,2),
  operating_profit DECIMAL(15,2),
  net_profit DECIMAL(15,2),
  
  -- Profitability Ratios
  gross_margin DECIMAL(5,2), -- (gross_profit / revenue) * 100
  net_margin DECIMAL(5,2), -- (net_profit / revenue) * 100
  roa DECIMAL(5,2), -- Return on Assets
  roe DECIMAL(5,2), -- Return on Equity
  
  -- Balance Sheet Metrics
  total_assets DECIMAL(15,2),
  current_assets DECIMAL(15,2),
  total_liabilities DECIMAL(15,2),
  current_liabilities DECIMAL(15,2),
  long_term_liabilities DECIMAL(15,2),
  shareholders_equity DECIMAL(15,2),
  
  -- Liquidity Ratios
  current_ratio DECIMAL(5,2), -- current_assets / current_liabilities
  quick_ratio DECIMAL(5,2), -- (current_assets - inventory) / current_liabilities
  
  -- Leverage Ratios
  debt_ratio DECIMAL(5,2), -- total_liabilities / total_assets
  debt_to_equity DECIMAL(5,2), -- total_liabilities / shareholders_equity
  
  -- Source document
  source_document_id UUID REFERENCES financial_documents(id),
  
  -- Confidence score (AI extraction quality)
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_type, fiscal_year)
);

CREATE INDEX idx_metrics_user ON financial_metrics_snapshot(user_id);
CREATE INDEX idx_metrics_date ON financial_metrics_snapshot(snapshot_date);
CREATE INDEX idx_metrics_fiscal_year ON financial_metrics_snapshot(fiscal_year);
```

---

## File Structure

```
src/components/
├── FinancialStatements/
│   ├── FinancialStatementUpload.tsx    # Upload component
│   ├── FinancialStatementList.tsx      # Document list
│   ├── FinancialMetricsDashboard.tsx    # Metrics display
│   └── StatementPreview.tsx            # PDF preview
├── Financing.tsx                        # Add tab

supabase/functions/
├── financial-statement-parse/           # Extract data from PDF
└── financial-metrics-calculate/         # Calculate ratios

docs/
└── FINANCIAL_STATEMENTS_TABLES.sql      # Migration
```

---

## Task Breakdown

### Week 1: Foundation

#### Task 1.1: Database Migration (4 hours)
- [ ] Create `financial_documents` table
- [ ] Create `financial_metrics_snapshot` table
- [ ] Add RLS policies
- [ ] Create indexes

#### Task 1.2: Upload Component (8 hours)
- [ ] Create `FinancialStatementUpload.tsx`
- [ ] Document type selector (ACRA, P&L, Balance Sheet, Tax)
- [ ] Fiscal year input
- [ ] File validation (PDF only)
- [ ] Upload progress indicator

#### Task 1.3: Document List Component (4 hours)
- [ ] Create `FinancialStatementList.tsx`
- [ ] Filter by document type
- [ ] Filter by fiscal year
- [ ] Sort by date uploaded
- [ ] Delete/Replace functionality

### Week 2: Intelligence

#### Task 2.1: PDF Parsing Function (16 hours)
- [ ] Create `financial-statement-parse` edge function
- [ ] ACRA BizFile text extraction
- [ ] P&L table detection
- [ ] Balance Sheet parsing
- [ ] Automatic metric calculation
- [ ] Confidence scoring

#### Task 2.2: Metrics Dashboard (8 hours)
- [ ] Create `FinancialMetricsDashboard.tsx`
- [ ] Revenue chart (trend)
- [ ] Profit margins
- [ ] Balance sheet summary
- [ ] Key ratios display

#### Task 2.3: Integration (4 hours)
- [ ] Add "Financial Statements" tab to Financing
- [ ] Connect to Risk Assessment
- [ ] Link metrics to credit scoring

---

## Component Specifications

### FinancialStatementUpload.tsx

```tsx
interface FinancialStatementUploadProps {
  userId: string;
  onUploadComplete?: (doc: FinancialDocument) => void;
}

interface DocumentType {
  id: string;
  label: string;
  description: string;
  icon: string;
  acceptedFormats: string[];
  fields: FormField[];
}

const DOCUMENT_TYPES: DocumentType[] = [
  {
    id: 'ACRA_ANNUAL',
    label: 'ACRA Annual Return',
    description: 'BizFile annual filing from ACRA',
    icon: 'building',
    acceptedFormats: ['.pdf'],
    fields: ['fiscal_year', 'company_name', 'uen']
  },
  {
    id: 'PNL',
    label: 'Profit & Loss Statement',
    description: 'Income and expense summary',
    icon: 'trending-up',
    acceptedFormats: ['.pdf', '.xlsx', '.csv'],
    fields: ['fiscal_year', 'period_start', 'period_end']
  },
  {
    id: 'BALANCE_SHEET',
    label: 'Balance Sheet',
    description: 'Assets and liabilities snapshot',
    icon: 'scale',
    acceptedFormats: ['.pdf', '.xlsx', '.csv'],
    fields: ['fiscal_year', 'period_end']
  },
  {
    id: 'TAX_ASSESSMENT',
    label: 'IRAS Tax Assessment',
    description: 'Notice of Assessment from IRAS',
    icon: 'receipt',
    acceptedFormats: ['.pdf'],
    fields: ['fiscal_year', 'tax_year']
  }
];
```

### FinancialMetricsDashboard.tsx

```tsx
interface MetricCard {
  id: string;
  label: string;
  value: number | string;
  format: 'currency' | 'percentage' | 'ratio' | 'number';
  trend?: 'up' | 'down' | 'stable';
  benchmark?: number;
}

const METRIC_CARDS: MetricCard[] = [
  { id: 'revenue', label: 'Revenue', format: 'currency' },
  { id: 'gross_profit', label: 'Gross Profit', format: 'currency' },
  { id: 'net_profit', label: 'Net Profit', format: 'currency' },
  { id: 'gross_margin', label: 'Gross Margin', format: 'percentage' },
  { id: 'net_margin', label: 'Net Margin', format: 'percentage' },
  { id: 'current_ratio', label: 'Current Ratio', format: 'ratio' },
  { id: 'debt_ratio', label: 'Debt Ratio', format: 'ratio' },
  { id: 'roa', label: 'Return on Assets', format: 'percentage' },
  { id: 'roe', label: 'Return on Equity', format: 'percentage' },
];
```

---

## Edge Function: financial-statement-parse

```typescript
// Actions
type ParseAction = 'parse_acra' | 'parse_pnl' | 'parse_balance_sheet' | 'parse_tax';

interface ParseResult {
  success: boolean;
  document_type: string;
  extracted_data: {
    company_info?: Record<string, any>;
    financial_data?: Record<string, any>;
    metrics?: Record<string, number>;
  };
  confidence_score: number;
  warnings: string[];
  suggested_fields: Record<string, any>;
}

// Supported patterns for P&L
const PNL_PATTERNS = {
  revenue: ['REVENUE', 'SALES', 'TOTAL INCOME', 'TURNOVER'],
  cogs: ['COST OF SALES', 'COST OF GOODS SOLD', 'DIRECT COSTS'],
  gross_profit: ['GROSS PROFIT', 'GROSS MARGIN'],
  operating_expenses: ['OPERATING EXPENSES', 'ADMIN EXPENSES', 'SELLING EXPENSES'],
  net_profit: ['NET PROFIT', 'PROFIT AFTER TAX', 'NET INCOME'],
};

// Supported patterns for Balance Sheet
const BS_PATTERNS = {
  current_assets: ['CURRENT ASSETS', 'TOTAL CURRENT ASSETS'],
  fixed_assets: ['FIXED ASSETS', 'PROPERTY PLANT EQUIPMENT'],
  total_assets: ['TOTAL ASSETS', 'TOTAL ASSETS EMPLOYED'],
  current_liabilities: ['CURRENT LIABILITIES', 'TOTAL CURRENT LIABILITIES'],
  long_term_liabilities: ['LONG TERM LIABILITIES', 'NON-CURRENT LIABILITIES'],
  total_liabilities: ['TOTAL LIABILITIES'],
  equity: ['SHAREHOLDERS EQUITY', 'TOTAL EQUITY', 'CAPITAL AND RESERVES'],
};
```

---

## Testing Checklist

### Week 1
- [ ] Upload ACRA BizFile PDF
- [ ] Upload P&L Excel
- [ ] Upload Balance Sheet PDF
- [ ] View document list
- [ ] Delete document

### Week 2
- [ ] Verify extracted metrics
- [ ] Check confidence scores
- [ ] View metrics dashboard
- [ ] Verify ratios calculation
- [ ] Check credit assessment integration

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Upload success rate | > 95% |
| Extraction accuracy | > 80% |
| Metrics dashboard load | < 2s |
| Integration with risk | Working |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PDF format variations | High | Multiple parser patterns, manual fallback |
| Excel parsing | Medium | Use CSV template as fallback |
| Metric accuracy | Medium | Show confidence score, allow manual edit |

---

## Summary

| Item | Details |
|------|---------|
| **Duration** | 2 weeks |
| **Tasks** | 6 major tasks |
| **Components** | 5 new components |
| **Tables** | 2 new tables |
| **Functions** | 2 edge functions |
| **Complexity** | Medium |
| **Dependencies** | Document Vault (existing) |

---

## Next Steps

1. ✅ Approve plan
2. Run database migration
3. Implement Week 1 tasks
4. Implement Week 2 tasks
5. Test and deploy
