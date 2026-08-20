# AIFrCQ Team Analysis: Real POS Integration
## How POS Data Flows into CyberQuote AI Platform

**Date:** August 21, 2026
**Prepared by:** AIFrCQ Development Team
**Purpose:** Understand POS system like a real POS integrated with CyberQuote

---

## Executive Summary

The POS (Point of Sale) system is the **primary data source** for the CyberQuote AI Franchise Platform. Every sale generates data that flows into the platform for:

1. **Real-time monitoring** - AI watches sales as they happen
2. **Anomaly detection** - Spot unusual patterns
3. **Stockout prediction** - Forecast inventory needs
4. **Risk scoring** - Assess franchisee health
5. **Franchisee financing** - Enable loans based on performance

---

## 1. Fullstack Engineer Perspective (Stefanus)

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REAL POS SYSTEM                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Lightspeed │  │   Square    │  │   Vend      │           │
│  │   POS       │  │   POS       │  │   POS       │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                     Standard API / Webhook                        │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               CYBERQUOTE AI PLATFORM                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              POS WEBHOOK EDGE FUNCTION                    │   │
│  │                                                          │   │
│  │  1. Receive POS data (JSON)                             │   │
│  │  2. Validate schema                                     │   │
│  │  3. Transform to internal format                        │   │
│  │  4. Insert into sales_transactions table               │   │
│  │  5. Trigger ML anomaly detection                       │   │
│  │  6. Update inventory (if integrated)                    │   │
│  │  7. Return acknowledgment                              │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SUPABASE DATABASE                            │   │
│  │                                                          │   │
│  │  sales_transactions ──→ ML anomaly detection            │   │
│  │  inventory ───────────→ Stockout prediction             │   │
│  │  outlet_features ──────→ Risk scoring                   │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AI AGENT (Athena)                          │   │
│  │                                                          │   │
│  │  - Monitor real-time sales                             │   │
│  │  - Generate alerts on anomalies                         │   │
│  │  - Create cases for resolution                         │   │
│  │  - Chat interface for insights                         │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Sale to Platform

```
STEP 1: Customer pays at POS
┌────────────────────────────────────┐
│ POS Transaction                    │
│ {                                 │
│   "outlet_id": 200,              │
│   "transaction_id": "TXN-12345", │
│   "items": [                     │
│     {"sku": "MNL_ES_TEH", "qty": 2, "price": 8.50},
│     {"sku": "MBT_NASI_GORENG", "qty": 1, "price": 25.00}
│   ],                             │
│   "total": 42.00,               │
│   "payment": "qrcode",           │
│   "timestamp": "2026-08-21T10:30:00Z"
│ }                                 │
└────────────────────────────────────┘
         │
         ▼ HTTP POST
┌────────────────────────────────────┐
│ pos-webhook Edge Function         │
│                                    │
│ Validates → Transforms → Stores  │
└────────────────────────────────────┘
         │
         ▼ INSERT
┌────────────────────────────────────┐
│ sales_transactions table          │
│                                    │
│ Each item becomes a row:          │
│ - outlet_id: 200                 │
│ - sku: MNL_ES_TEH                │
│ - quantity: 2                    │
│ - amount: 17.00                   │
│ - timestamp: 2026-08-21 10:30:00 │
└────────────────────────────────────┘
         │
         ├──────────────────┐
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│ Anomaly Check   │  │ Inventory Update│
│                 │  │                 │
│ Is this normal? │  │ stock -= 2      │
│ vs historical?  │  │ Check min_stock │
└─────────────────┘  └─────────────────┘
         │                  │
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│ Alert?          │  │ Low Stock?     │
│ YES → Case      │  │ YES → Alert    │
└─────────────────┘  └─────────────────┘
```

### POS Webhook Requirements

| Requirement | Description |
|------------|-------------|
| **Authentication** | HMAC-SHA256 signature |
| **Schema** | Standard POS JSON format |
| **Retry** | 3 retries on failure |
| **Idempotency** | Same transaction_id = ignore |
| **Latency** | < 500ms response |

### Current Implementation

| File | Status |
|------|--------|
| `pos-webhook/index.ts` | ✅ Edge function exists |
| `pos-simulator.py` | ✅ Test data generator |
| HMAC validation | ✅ Implemented |
| Schema validation | ✅ Implemented |

---

## 2. AI/ML Engineer Perspective (Melvin)

### How AI Processes POS Data

```
RAW POS DATA
    │
    ├──────────────────────────────┐
    │                              │
    ▼                              ▼
┌──────────────┐          ┌──────────────┐
│ SALES DATA   │          │ INVENTORY   │
│              │          │ DATA         │
│ - Revenue    │          │ - Stock      │
│ - Ticket    │          │ - Movements  │
│ - Items     │          │ - Restocks   │
└──────┬───────┘          └──────┬───────┘
       │                         │
       ▼                         ▼
┌──────────────────────────────────────────────┐
│              FEATURE ENGINEERING              │
│                                               │
│ Sales Features:                               │
│ ├── hourly_revenue                           │
│ ├── daily_revenue                           │
│ ├── avg_ticket_size                         │
│ ├── transactions_per_hour                    │
│ ├── item_popularity                         │
│ └── weekend_vs_weekday_ratio                │
│                                               │
│ Inventory Features:                           │
│ ├── stock_level_ratio                       │
│ ├── days_until_stockout                     │
│ ├── restock_frequency                       │
│ └── item_velocity                           │
└──────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────┐
│              ML MODELS                        │
│                                               │
│ 1. Anomaly Detection (Z-score)             │
│    - Detect unusual sales patterns            │
│    - Flag drops/spikes                       │
│                                               │
│ 2. Stockout Prediction (LSTM)               │
│    - Forecast when item will run out         │
│    - 48-hour horizon                         │
│                                               │
│ 3. Franchise Distress (XGBoost)             │
│    - Score franchisee health                  │
│    - Predict default risk                     │
└──────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────┐
│              AI INSIGHTS                       │
│                                               │
│ "Sales at SG Marina Bay dropped 40% today"   │
│ "Es Teh Manis will run out in 6 hours"      │
│ "BDG-005 shows declining trend (risk: 72)"   │
└──────────────────────────────────────────────┘
```

### ML Pipeline: Real-Time

```python
# POS Webhook triggers ML pipeline
async function posWebhook(req):
    # 1. Store transaction
    await insertTransaction(req.body)
    
    # 2. Trigger async ML processing
    await supabase.functions.invoke('ml-anomaly-v2', {
        body: { outlet_id, recent_transactions }
    })
    
    # 3. Check stock levels
    await checkInventoryLevels(outlet_id, items)
    
    # 4. Update outlet features (aggregated metrics)
    await updateOutletFeatures(outlet_id)
    
    return { status: 'ok' }
```

### Anomaly Detection Logic

| Scenario | Detection | Alert Level |
|----------|-----------|-------------|
| Revenue drops > 30% vs avg | Z-score | 🔴 HIGH |
| No transactions for 2+ hours | Time gap | 🟡 MEDIUM |
| Ticket size spike > 50% | Z-score | 🟡 MEDIUM |
| Item sold out quickly | Velocity check | 🔴 HIGH |
| Unusual payment method | Pattern match | 🟢 LOW |

---

## 3. Finance Analyst Perspective

### POS Data for Risk Assessment

```
POS DATA ────────────────────────────────► RISK SCORE
    │                                          │
    │  Revenue trend ──────────────────────────┼──► Payment capacity
    │  Ticket size ─────────────────────────────┼──► Business health
    │  Transaction frequency ───────────────────┼──► Operational stability
    │  Hourly patterns ───────────────────────┼──► Seasonality
    │  Item mix ────────────────────────────────┼──► Business model
    │                                          │
    └──────────────────────────────────────────┘

WEIGHTING:
├── Revenue growth: 35% ─── Most important
├── Consistency: 25% ────── Stability matters
├── Ticket size: 20% ───── Profitability
├── Patterns: 20% ───────── Predictability
```

### Credit Assessment from POS

| Metric | What It Shows | Risk Impact |
|--------|--------------|-------------|
| **Avg daily revenue** | Sales volume | Higher = better |
| **Revenue trend** | Growth/decline | Upward = good |
| **Revenue volatility** | Consistency | Stable = lower risk |
| **Ticket size** | Transaction value | Higher = more profitable |
| **Peak hours** | Business model health | Consistent = stable |
| **Weekend lift** | Demand pattern | Predictable = manageable |

### Example: Marina Bay Risk Assessment

```
FRANCHISEE: SG Marina Bay (SG-001)

POS DATA (Last 30 days):
├── Daily Revenue: S$ 4,850 (avg)
├── Revenue Trend: +8% vs last month
├── Volatility: 12% (low = stable)
├── Ticket Size: S$ 28.50 (high)
├── Peak Hours: 12:00-14:00, 18:00-20:00
└── Weekend Lift: +35%

FINANCIAL RISK SCORE: 78/100 (LOW)

Recommendation: APPROVE
Max Loan Amount: S$ 50,000
Interest Rate: 7.5% p.a.
```

---

## 4. QA/Ops Perspective

### POS Data Quality

| Check | Validation | Error Handling |
|-------|------------|---------------|
| **Outlet ID** | Must exist in DB | Reject + log |
| **Transaction ID** | Unique, not duplicate | Idempotent (ignore) |
| **Amount** | Positive number | Reject + log |
| **Timestamp** | Not future, not > 24h old | Reject + log |
| **Items** | Valid SKU, qty > 0 | Partial accept |
| **HMAC** | Valid signature | Reject + 401 |

### Monitoring Requirements

| Metric | Target | Alert |
|--------|--------|-------|
| **Webhook latency** | < 500ms | > 1000ms |
| **Error rate** | < 1% | > 5% |
| **Data freshness** | Real-time | > 5 min delay |
| **Transaction count** | Expected range | Outlier detection |

### Testing Strategy

```
UNIT TESTS:
├── Schema validation
├── HMAC signature
├── Duplicate detection
└── Error handling

INTEGRATION TESTS:
├── POS → Webhook → DB
├── Webhook → ML pipeline
└── DB → Dashboard display

E2E TESTS:
├── Simulate full sale
├── Verify inventory deduction
├── Check alert generation
└── Verify risk score update
```

### Real POS vs Simulator

| Aspect | Real POS | Current Simulator |
|--------|----------|------------------|
| **Data format** | Vendor-specific JSON | Standardized JSON |
| **Authentication** | OAuth/API key | HMAC |
| **Frequency** | Real-time per transaction | Configurable |
| **Items sold** | Actual menu items | Random products |
| **Inventory** | Real deduction | No deduction |
| **Errors** | Network/API failures | Perfect conditions |

---

## 5. CTO Perspective (Decision Maker)

### Key Decisions Made

| Decision | Rationale |
|----------|----------|
| **Webhooks over polling** | Real-time is essential for alerts |
| **Standard JSON schema** | POS vendors differ, platform normalizes |
| **HMAC authentication** | Simple, secure, industry standard |
| **Edge function ingestion** | Scalable, low latency |
| **Inventory separate** | Allows POS without inventory (MVP) |
| **Unified later** | Phase 2: true POS + inventory sync |

### Why Not Integrate Inventory Now?

| Reason | Explanation |
|--------|-------------|
| **Complexity** | Real inventory needs SKU mapping, supplier orders |
| **Different POS** | Each POS handles inventory differently |
| **MVP focus** | Financing > Inventory for Phase 1 |
| **Future ready** | Schema supports inventory data when needed |

### Roadmap

```
PHASE 1 (Current - MVP)
├── POS webhook (sales only) ✅
├── Anomaly detection ✅
├── Stockout prediction (external data) ⚠️
└── Basic dashboard ✅

PHASE 2 (Next Sprint)
├── Inventory sync (optional)
├── Supplier order integration
├── Restock automation
└── Multi-POS support

PHASE 3 (Future)
├── Real-time inventory dashboard
├── Auto-reorder triggers
├── Waste tracking
└── Menu optimization
```

---

## 6. Gap Analysis: Current vs Real POS

### What We Have

| Component | Status | Notes |
|-----------|--------|-------|
| POS webhook endpoint | ✅ | Edge function ready |
| HMAC validation | ✅ | Secure |
| Schema validation | ✅ | Robust |
| Duplicate detection | ✅ | Idempotent |
| Sales storage | ✅ | Transactions table |
| ML anomaly detection | ✅ | Z-score model |
| ML stockout prediction | ✅ | LSTM model |
| Dashboard display | ✅ | React UI |
| Alert generation | ✅ | AI agent |

### What's Missing (For Real POS)

| Component | Priority | Notes |
|-----------|----------|-------|
| **Real POS vendors** | 🔴 HIGH | Lightspeed, Square, etc. |
| **OAuth integration** | 🟡 MED | Each POS differs |
| **SKU mapping** | 🔴 HIGH | Must map vendor SKU → internal |
| **Inventory deduction** | 🟡 MED | Phase 2 feature |
| **Payment reconciliation** | 🟡 MED | With payment provider |
| **Offline handling** | 🟢 LOW | POS offline mode |
| **Multi-currency** | 🟢 LOW | Not needed for SG |

### What's Working Well

| Component | Status | Why It Works |
|-----------|--------|--------------|
| Webhook architecture | ✅ | Standard, scalable |
| Data normalization | ✅ | Platform handles variety |
| ML models | ✅ | Based on transaction data |
| Alert system | ✅ | Catches anomalies |
| Dashboard | ✅ | Real-time updates |

---

## 7. Recommendations

### Immediate (This Sprint)

1. **Add inventory deduction** to simulator
   - Connect pos-simulator → inventory updates
   - Test stockout alerts

2. **Create realistic test scenarios**
   - Normal day at SG Marina Bay
   - Anomaly day (sales drop)
   - Stockout scenario

3. **Document POS webhook API**
   - For potential POS vendor integration
   - For franchisees with existing POS

### Short-term (Next Sprint)

1. **SKU mapping tool**
   - Allow franchisee to map their POS items
   - Store mapping in database

2. **Inventory dashboard**
   - Show stock levels per outlet
   - Visual low-stock warnings

3. **Real POS pilot**
   - Partner with one SG franchisee
   - Test real data flow

### Long-term (Future Phases)

1. **Multi-POS integration**
   - Lightspeed, Square, Vend, etc.
   - Unified webhook adapter

2. **Smart inventory**
   - Auto-reorder suggestions
   - Supplier integration

3. **Advanced analytics**
   - Menu performance
   - Customer behavior
   - Staff productivity

---

## 8. Conclusion

### Team Agreement

| Member | Role | Assessment |
|--------|------|------------|
| **Stefanus** | Fullstack | ✅ Architecture is solid, inventory should be unified |
| **Melvin** | AI/ML | ✅ ML pipeline ready, needs more training data |
| **Finance** | Analyst | ✅ POS data sufficient for basic risk scoring |
| **QA/Ops** | Testing | ⚠️ Need more test scenarios, especially edge cases |
| **CTO** | Decision | ✅ MVP is complete, Phase 2 should unify inventory |

### Key Takeaways

1. **POS webhook works** - Data flows correctly into platform
2. **ML is operational** - Anomaly and stockout detection active
3. **Inventory separation** - MVP choice, should merge in Phase 2
4. **Real POS integration** - Next major milestone
5. **Test coverage** - Needs expansion with realistic scenarios

### Next Steps

1. ✅ Unify POS + Inventory simulator
2. ⬜ Create test scenarios (normal, anomaly, stockout)
3. ⬜ Add inventory dashboard to UI
4. ⬜ Document POS webhook API
5. ⬜ Plan real POS vendor integration

---

**Document Ends**
*AIFrCQ Team Analysis - POS Integration*
