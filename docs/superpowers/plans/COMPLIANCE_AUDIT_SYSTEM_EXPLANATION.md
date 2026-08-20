# Compliance Audit System - Explanation

> **For:** CQaiFranchise Financing Platform

---

## What is Compliance Audit?

**Definition:** Systematic assessment of franchisee adherence to brand standards, operational requirements, and contractual obligations.

---

## Why Does It Matter for Financing?

| Aspect | Impact |
|--------|--------|
| **Risk Assessment** | Poor compliance = higher loan risk |
| **Credit Scoring** | Compliance score factors into loan approval |
| **Interest Rates** | Better compliance = lower rates |
| **Monitoring** | Early warning for loan default |

---

## What Gets Audited?

### 1. Brand Standards
| Item | What We Check |
|------|---------------|
| Store Appearance | Cleanliness, signage, layout |
| Uniforms | Staff dress code compliance |
| Operating Hours | Adherence to franchise hours |
| Menu/Products | Only approved items sold |

### 2. Financial Compliance
| Item | What We Check |
|------|---------------|
| Royalty Payments | On-time, correct amount |
| Sales Reporting | Accurate POS data submitted |
| Bank Reconciliation | Monthly statements |
| Tax Compliance | Filed on time |

### 3. Operational Compliance
| Item | What We Check |
|------|---------------|
| Training | Staff certifications current |
| Equipment | Maintenance logs |
| Food Safety | Hygiene certifications |
| Insurance | Coverage up to date |

---

## How It Works in System

### Flow
```
1. Franchisor creates audit checklist
        ↓
2. System schedules audits (quarterly)
        ↓
3. Auditor visits / Self-assessment
        ↓
4. Score assigned (0-100)
        ↓
5. Results feed into credit assessment
        ↓
6. Alerts for low scores
```

---

## Database Schema

```sql
-- Audit Templates
CREATE TABLE compliance_audit_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  category VARCHAR(50), -- 'BRAND', 'FINANCIAL', 'OPERATIONAL'
  items JSONB, -- Checklist items
  max_score INTEGER,
  created_by UUID
);

-- Audit Sessions
CREATE TABLE compliance_audits (
  id UUID PRIMARY KEY,
  franchise_id UUID,
  template_id UUID,
  auditor_id UUID,
  audit_date DATE,
  status VARCHAR(20), -- 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'
  overall_score DECIMAL(5,2),
  findings JSONB,
  created_at TIMESTAMPTZ
);

-- Audit Items (per audit)
CREATE TABLE compliance_audit_items (
  id UUID PRIMARY KEY,
  audit_id UUID,
  template_item_id UUID,
  score DECIMAL(5,2),
  comments TEXT,
  evidence_url TEXT
);

-- Compliance Scores (aggregated)
CREATE TABLE compliance_scores (
  id UUID PRIMARY KEY,
  franchise_id UUID,
  period VARCHAR(10), -- 'Q1_2026', 'Q2_2026'
  brand_score DECIMAL(5,2),
  financial_score DECIMAL(5,2),
  operational_score DECIMAL(5,2),
  overall_score DECIMAL(5,2),
  trend VARCHAR(10), -- 'IMPROVING', 'STABLE', 'DECLINING'
  created_at TIMESTAMPTZ
);
```

---

## Scoring System

| Score Range | Rating | Impact on Loan |
|-------------|--------|----------------|
| 90-100 | Excellent | ✅ Qualify for best rates |
| 75-89 | Good | ✅ Standard rates |
| 60-74 | Fair | ⚠️ Higher rates |
| 40-59 | Poor | ⚠️ Manual review required |
| 0-39 | Critical | ❌ Loan declined |

---

## Credit Assessment Integration

```
Compliance Score (15% weight)
           ↓
    ┌──────┴──────┐
    ↓             ↓
Brand (5%)   Financial (5%)   Operational (5%)
    ↓             ↓              ↓
    └─────────────┴──────────────┘
                  ↓
         Combined Compliance Score
                  ↓
         Credit Assessment Score
```

---

## UI Screens Needed

| Screen | Users | Features |
|--------|-------|----------|
| **Audit Dashboard** | Franchisor | All audits, scores |
| **Audit Form** | Auditor | Checklist, scoring |
| **Self-Assessment** | Franchisee | Self-check |
| **Score History** | All | Trend charts |
| **Alerts** | Franchisor | Low scores |

---

## Effort Breakdown

| Component | Weeks | Tasks |
|-----------|-------|-------|
| **Database** | 1 | Tables, RLS, functions |
| **Audit Templates** | 1 | CRUD, checklist builder |
| **Audit Forms** | 1 | Scoring, evidence upload |
| **Dashboard** | 1 | Charts, reports |
| **Integration** | 1 | Connect to credit scoring |
| **Testing** | 1 | UAT, bug fixes |

---

## Example Audit Checklist

### Brand Standards (100 points)
| Item | Max Score | Pass Criteria |
|------|-----------|---------------|
| Store Cleanliness | 20 | No violations |
| Signage Compliance | 15 | All approved signage |
| Staff Uniforms | 15 | 100% compliance |
| Operating Hours | 10 | As per contract |
| Menu Compliance | 20 | Only approved items |
| Customer Service | 20 | Mystery shopper score |

### Financial Compliance (100 points)
| Item | Max Score | Pass Criteria |
|------|-----------|---------------|
| Royalty On-Time | 30 | 100% on-time |
| Royalty Accuracy | 20 | Within 2% variance |
| Sales Reporting | 25 | Daily submissions |
| Bank Statements | 25 | Monthly submission |

### Operational (100 points)
| Item | Max Score | Pass Criteria |
|------|-----------|---------------|
| Staff Training | 25 | All certified |
| Equipment Maintenance | 25 | Log up-to-date |
| Food Safety | 30 | Valid certifications |
| Insurance | 20 | Current coverage |

---

## Benefits

| For Franchisor | For Franchisee |
|---------------|----------------|
| Monitor compliance | Know where to improve |
| Early risk detection | Fair assessment |
| Quality consistency | Better loan rates |
| Data-driven decisions | Clear expectations |

---

## Timeline

| Month | Milestone |
|-------|-----------|
| Month 1 | Database + Templates |
| Month 2 | Audit Forms + Dashboard |
| Month 3 | Integration + Testing |
| Month 4 | Launch |

---

## Summary

| Aspect | Detail |
|--------|--------|
| **Duration** | 6 weeks (3 months) |
| **Complexity** | Medium-High |
| **Benefit** | Better risk assessment |
| **Integration** | Credit scoring (15%) |

---

## Questions?

| # | Question |
|---|----------|
| 1 | Want to implement this? |
| 2 | Modify scope? |
| 3 | Different priority? |
