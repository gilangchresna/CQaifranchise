# Seed More SOPs & Incidents — Detail Plan

**Date:** Aug 15, 2026
**Purpose:** Expand Knowledge Base for demo richness

---

## Current State

| Table | Count | Sample Content |
|-------|-------|----------------|
| `knowledge_sops` | 5 | Opening, Reorder, Complaint, Scheduling, Cash Handling |
| `knowledge_incidents` | 5 | Staff Shortage, Stockout, Equipment Failure |
| `knowledge_policies` | 5 | HR, Inventory, Finance, Halal, Food Safety |
| `knowledge_embeddings` | 9 | Vector embeddings via Gemini |

---

## Proposed New SOPs (10 items)

### Operations (5)
| # | Title | Category | Content Summary |
|---|-------|----------|----------------|
| 1 | Daily Closing Procedures | operations | Cash count, POS reconciliation, stock check, security lockup |
| 2 | Food Safety & Hygiene Checklist | operations | Temperature logs, expiry check, pest control, sanitization |
| 3 | Staff Onboarding SOP | hr | First day checklist, uniform, system access, training schedule |
| 4 | Customer Refund Policy | operations | Refund conditions, approval workflow, documentation |
| 5 | Equipment Maintenance Schedule | operations | Fridge cleaning, exhaust fan, griller service intervals |

### Compliance (3)
| # | Title | Category | Content Summary |
|---|-------|----------|----------------|
| 6 | Halal Certification Renewal | compliance | Timeline, JAINJ procedures, audit checklist |
| 7 | PDPA Data Handling | compliance | Customer data retention, consent management, breach reporting |
| 8 | Fire Safety & Evacuation | compliance | Extinguisher check, evacuation route, emergency contacts |

### Finance (2)
| # | Title | Category | Content Summary |
|---|-------|----------|----------------|
| 9 | Petty Cash Management | finance | Float replenishment, receipting, monthly audit |
| 10 | Franchise Royalty Reporting | finance | Monthly sales report template, calculation formula, deadline |

---

## Proposed New Incidents (10 items)

| # | Type | Description | Root Cause | Resolution |
|---|------|-------------|------------|-------------|
| 1 | SALES_ANOMALY | SG-Central revenue drop -45% for 3 days | Public holiday + school nearby under renovation | Monitored, no action needed |
| 2 | STOCKOUT | KUL-001 ran out of chicken 6pm peak hour | Supplier delayed, 1-day notice | Emergency restock from warehouse |
| 3 | EQUIPMENT_FAILURE | BKK-007 griller malfunction, 2hr downtime | Electrical fault, technician called | Repaired same day |
| 4 | STAFF_ABSENCE | SBY-002: 4/6 staff no-show due to flood | Weather event | HR notified, temp agency engaged |
| 5 | COMPLIANCE_ISSUE | JKT-004 halal cert expired 3 days | Lapsed renewal reminder | Renewal submitted, pending audit |
| 6 | CUSTOMER_COMPLAINT | NL-AMK-001 foreign object in food | SOP breach: cover food prep area | Staff retraining + inspection |
| 7 | INVENTORY_SHORTAGE | KT-TMP-001 daily supply 60% below target | Supplier capacity issue | Supplier escalation, backup vendor identified |
| 8 | REVENUE_SPIKE | BDG-001 revenue +80% unusual | Weather促销 promo event | Verified legitimate |
| 9 | SYSTEM_ALERT | POS system downtime 11-12pm | Network provider outage | Fallback manual POS used |
| 10 | QUALITY_ISSUE | SAP-003 food poisoning case 3 customers | Suspected expiry product | Investigation ongoing |

---

## Implementation

### Files to Modify

```
supabase/migrations/
  20260713204300_knowledge_base.sql  ← add INSERT statements
```

### Run Order
1. INSERT new SOPs into `knowledge_sops`
2. INSERT new Incidents into `knowledge_incidents`
3. Run `seed-embeddings` edge function to regenerate vectors
4. Deploy to production

### Verification
```sql
SELECT COUNT(*) FROM knowledge_sops;    -- target: 15 rows
SELECT COUNT(*) FROM knowledge_incidents; -- target: 15 rows
SELECT COUNT(*) FROM knowledge_embeddings; -- target: 19+ rows
```

---

## Priority

**Medium** — demo enhancement only. Production content comes from franchisor.
