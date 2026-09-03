# POS Simulation Scripts — Comprehensive Analysis & Improvement Plan

> **Document Version:** 1.0
> **Last Updated:** August 31, 2026
> **Project:** CQaiFranchise

---

## 📊 Current State Analysis

### Scripts Inventory

| Script | Lines | Purpose | Status |
|--------|-------|--------|--------|
| `pos-simulator.py` | 643 | Main simulator with all modes | ✅ Most complete |
| `pos-realistic.py` | 431 | Realistic patterns | ✅ Good |
| `pos-backfill.py` | 298 | Historical data backfill | ✅ Good |
| `pos-sim-real.py` | 261 | Combined realistic | ⚠️ Needs review |
| `pos-simulator.cjs` | 238 | CommonJS version | ⚠️ Duplicate |
| `pos-simulator-fixed.py` | 370 | Fixed version | ⚠️ Duplicate? |
| `pos-real.py` | 176 | Simple real | ⚠️ Basic |
| `pos-real-day.py` | 166 | Full day sim | ⚠️ Limited |
| `pos-sim.py` | 431 | Alternative | ⚠️ Duplicate |

**Total:** 3,014 lines across 9 scripts
**Duplicates:** ~3-4 redundant files

---

## ❌ Problems Identified

### 1. **Duplication Crisis**
```
pos-simulator.py     (643 lines)
pos-realistic.py     (431 lines) ← Similar to pos-simulator.py
pos-simulator-fixed.py (370 lines) ← What was "fixed"?
pos-simulator.cjs    (238 lines) ← CommonJS duplicate
pos-sim.py           (431 lines) ← Another duplicate?
```

### 2. **Inconsistent Outlet IDs**
```
pos-real-day.py:  SG = list(range(156, 164)) + [1, 2, 3]
pos-simulator.py:  SG_OUTLETS = [164, 165, 167, 168, 169, 170, 171, 200, 201, 202]
pos-real.py:       SG = list(range(156, 164)) + [1, 2, 3]
```

**Reality:** Outlet IDs not consistent across scripts!

### 3. **Missing Features**

| Feature | pos-simulator.py | pos-realistic.py | pos-real-day.py |
|---------|------------------|------------------|------------------|
| Anomaly injection | ✅ | ❌ | ❌ |
| Stockout simulation | ❌ | ❌ | ❌ |
| Royalty calculation | ❌ | ❌ | ❌ |
| Multi-region loop | ❌ | ❌ | ✅ |
| Error test suite | ✅ | ❌ | ❌ |
| CSV export | ❌ | ❌ | ❌ |
| Webhook monitoring | ❌ | ❌ | ❌ |
| Transaction validation | ❌ | ❌ | ❌ |

### 4. **Code Quality Issues**

| Issue | Example |
|-------|---------|
| Hardcoded tax rates | `tax = round(sub * 0.11)` (SG only) |
| No config file | Every script hardcodes URLs |
| No logging | Only print statements |
| No error handling | Bare `except Exception` |
| No unit tests | Scripts tested manually |

### 5. **Missing Business Logic**

```python
# Current: Just random transactions
txn = {
    "amount": random.randint(100, 500),
    ...
}

# Missing: Real business scenarios
- Anomaly: sudden sales drop (Z-Score)
- Stockout: low inventory warning
- Royalty: calculate franchise fee
- Compliance: GST, service charge
- Regional: different currencies/taxes
```

---

## 🎯 Recommended Improvements

### Priority 1: CONSOLIDATE Scripts

**Action:** Merge duplicates into ONE master script

```
BEFORE (9 scripts):
├── pos-simulator.py      (643 lines)
├── pos-realistic.py      (431 lines)
├── pos-sim-real.py       (261 lines)
├── pos-simulator-fixed.py (370 lines)
├── pos-simulator.cjs     (238 lines)
├── pos-sim.py            (431 lines)
├── pos-real.py           (176 lines)
└── pos-real-day.py       (166 lines)

AFTER (2 scripts):
├── pos-sim.py            (master simulator)
└── pos-backfill.py      (historical data only)
```

### Priority 2: Add Configuration File

**Create `config/pos-simulation.yaml`:**
```yaml
supabase:
  url: https://ploqeifazcgzwjzmukgp.supabase.co
  webhook: /functions/v1/pos-webhook

regions:
  sg:
    outlets: [164, 165, 167, 168, 169, 170, 171, 200, 201, 202]
    currency: SGD
    tax_rate: 0.09
    timezone: Asia/Singapore
  jkt:
    outlets: [4, 1, 2, 3, 5]
    currency: IDR
    tax_rate: 0.11
    timezone: Asia/Jakarta

simulation:
  peak_hours: [11, 12, 13, 14, 18, 19, 20, 21]
  quiet_hours: [7, 8, 9, 10, 15, 16, 17]
  anomaly_probability: 0.05
  stockout_probability: 0.03
```

### Priority 3: Add Missing Features

#### Feature A: Anomaly Injection
```python
def inject_anomaly(txn: dict, probability: float = 0.05) -> dict:
    """Inject realistic anomalies for ML testing"""
    if random.random() > probability:
        return txn

    anomaly_types = [
        ("sales_drop", 0.7),      # 70% of anomalies
        ("sales_spike", 0.2),     # 20%
        ("refund_fraud", 0.1),    # 10%
    ]

    anomaly_type = random.choices(
        [a[0] for a in anomaly_types],
        weights=[a[1] for a in anomaly_types]
    )[0]

    if anomaly_type == "sales_drop":
        txn["amount"] *= random.uniform(0.1, 0.4)  # 60-90% drop
        txn["anomaly_flag"] = True
    elif anomaly_type == "sales_spike":
        txn["amount"] *= random.uniform(2.0, 3.0)   # 2-3x spike
        txn["anomaly_flag"] = True

    return txn
```

#### Feature B: Stockout Simulation
```python
def simulate_stockout(outlet_id: int, item: str) -> dict:
    """Generate stockout scenario"""
    return {
        "outlet_id": outlet_id,
        "item": item,
        "current_stock": random.randint(0, 10),
        "daily_usage": random.randint(20, 50),
        "days_until_stockout": round(random.uniform(0.1, 3.0), 1),
        "risk_level": "CRITICAL" if random.random() < 0.3 else "HIGH",
        "timestamp": datetime.now().isoformat()
    }
```

#### Feature C: Royalty Calculation
```python
def calculate_royalty(txn: dict, agreement: dict) -> dict:
    """Calculate royalty based on franchise agreement"""
    base_rate = agreement.get("base_rate", 0.06)  # 6%
    monthly_revenue = txn.get("amount", 0)

    if agreement["formula"] == "SIMPLE":
        royalty = monthly_revenue * base_rate
    elif agreement["formula"] == "PERFORMANCE":
        score = txn.get("performance_score", 80)
        multiplier = get_score_multiplier(score)
        royalty = monthly_revenue * base_rate * multiplier
    else:  # HYBRID or COMBINED
        royalty = monthly_revenue * base_rate

    return {
        **txn,
        "royalty_amount": round(royalty, 2),
        "royalty_rate": base_rate,
        "royalty_formula": agreement.get("formula")
    }
```

### Priority 4: Add Business Scenarios

```python
SCENARIOS = {
    "weekday_lunch_rush": {
        "hours": [11, 12, 13],
        "outlets": ["sg_marina_bay", "sg_orchard"],
        "transactions_per_hour": 30,
        "platform_distribution": {"dine_in": 0.6, "grabfood": 0.3, "qcode": 0.1}
    },
    "weekend_dinner": {
        "hours": [18, 19, 20, 21],
        "outlets": ["sg_changi", "sg_orchard"],
        "transactions_per_hour": 40,
        "platform_distribution": {"dine_in": 0.4, "grabfood": 0.4, "card": 0.2}
    },
    "public_holiday": {
        "multiplier": 1.5,
        "note": "50% more transactions"
    }
}
```

### Priority 5: Add Monitoring & Reporting

```python
class SimulationMonitor:
    def __init__(self):
        self.transactions_sent = 0
        self.transactions_failed = 0
        self.anomalies_injected = 0
        self.alerts_triggered = 0
        self.start_time = datetime.now()

    def report(self):
        duration = (datetime.now() - self.start_time).seconds
        return {
            "duration_seconds": duration,
            "tx_per_second": self.transactions_sent / duration if duration > 0 else 0,
            "success_rate": self.transactions_sent / (self.transactions_sent + self.transactions_failed),
            "anomaly_rate": self.anomalies_injected / self.transactions_sent,
            "alert_rate": self.alerts_triggered / self.transactions_sent
        }
```

### Priority 6: Add CSV/JSON Export

```python
def export_transactions(transactions: list, format: str = "csv"):
    """Export transactions for analysis"""
    if format == "csv":
        import csv
        with open(f"transactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv", "w") as f:
            writer = csv.DictWriter(f, fieldnames=transactions[0].keys())
            writer.writeheader()
            writer.writerows(transactions)
    elif format == "json":
        with open(f"transactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(transactions, f, indent=2)
```

---

## 📋 Implementation Roadmap

### Phase 1: Cleanup (Week 1)
| Task | Effort | Output |
|------|--------|--------|
| Delete duplicate scripts | 1h | 2 scripts remain |
| Create config.yaml | 2h | Unified config |
| Fix outlet ID consistency | 2h | All scripts use same IDs |
| Add error handling | 4h | Robust scripts |

### Phase 2: Features (Week 2)
| Task | Effort | Output |
|------|--------|--------|
| Add anomaly injection | 4h | Realistic test data |
| Add stockout simulation | 4h | Inventory alerts |
| Add royalty calculation | 4h | Franchise fees |
| Add scenario presets | 2h | One-command scenarios |

### Phase 3: Monitoring (Week 3)
| Task | Effort | Output |
|------|--------|--------|
| Add simulation monitor | 2h | Real-time stats |
| Add CSV/JSON export | 2h | Analysis files |
| Add webhook health check | 1h | Uptime monitoring |
| Add integration tests | 4h | CI/CD ready |

### Phase 4: Documentation (Week 4)
| Task | Effort | Output |
|------|--------|--------|
| Create README.md | 2h | User documentation |
| Add inline comments | 2h | Code clarity |
| Create examples | 2h | Tutorial docs |
| Add architecture diagram | 1h | Visual overview |

---

## 🎯 Summary: Improvements Needed

| Priority | Improvement | Impact |
|----------|-------------|--------|
| 🔴 HIGH | Consolidate 9 scripts → 2 | Maintainability |
| 🔴 HIGH | Fix outlet ID inconsistency | Data accuracy |
| 🟡 MED | Add anomaly injection | ML testing |
| 🟡 MED | Add stockout simulation | Inventory alerts |
| 🟡 MED | Add config.yaml | Config management |
| 🟢 LOW | Add CSV export | Analysis ready |
| 🟢 LOW | Add monitoring dashboard | Real-time visibility |

---

## 📁 Recommended Final Structure

```
scripts/
├── pos-sim.py              # Master simulator (consolidated)
├── pos-backfill.py         # Historical data
├── config/
│   └── pos-simulation.yaml # Configuration
└── README.md               # Documentation
```

**Total:** 1 master script + 1 backfill script + 1 config + docs

---

**Document Status:** Complete
**Next Review:** September 7, 2026
