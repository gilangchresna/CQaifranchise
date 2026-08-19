# 🎓 Tutorial: POS Data Population for Demo

**Purpose:** Populate realistic POS data for demo presentation
**Target:** 10 Singapore outlets with real-time transactions
**Time Required:** ~15 minutes

---

## 📋 Prerequisites

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Supabase Dashboard access | ⬜ |
| 2 | Terminal access | ⬜ |
| 3 | POS simulator script | ✅ Exists |

---

## 🚀 Step-by-Step Guide

### Step 1: Seed Regions + Outlets (SQL Editor)

**Open:** Supabase Dashboard → SQL Editor

**Run this SQL:**

```sql
-- 1. Create Singapore Region
INSERT INTO regions (id, code, name, country, currency_code, is_active) 
VALUES (114, 'SG', 'Singapore', 'Singapore', 'SGD', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create 10 Singapore Outlets
INSERT INTO outlets (id, code, name, region_id, status, daily_target) VALUES
(1,   'SG-001', 'Marina Bay Sands',  114, 'ACTIVE', 500000),
(2,   'SG-002', 'Orchard Road',      114, 'ACTIVE', 450000),
(3,   'SG-003', 'Bugis Junction',    114, 'ACTIVE', 400000),
(164, 'SG-004', 'Tampines Mall',     114, 'ACTIVE', 350000),
(165, 'SG-005', 'Jurong Point',      114, 'ACTIVE', 380000),
(166, 'SG-006', 'Causeway Point',    114, 'ACTIVE', 320000),
(167, 'SG-007', 'Vivo City',         114, 'ACTIVE', 420000),
(168, 'SG-008', 'Suntec City',       114, 'ACTIVE', 480000),
(169, 'SG-009', 'Raffles City',      114, 'ACTIVE', 520000),
(170, 'SG-010', 'Compass One',       114, 'ACTIVE', 280000)
ON CONFLICT (id) DO NOTHING;

-- 3. Verify
SELECT id, code, name, region_id, status FROM outlets WHERE region_id = 114 ORDER BY id;
```

**Expected Result:** 10 rows returned

---

### Step 2: Start POS Simulator (Terminal)

**Open:** Terminal

**Navigate to project:**
```bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
```

**Option A: Run All 10 Outlets (Recommended)**

```bash
# Start 10 outlets in background
for outlet in 1 2 3 164 165 166 167 168 169 170; do
  python3 scripts/pos-simulator.py --dev --outlet $outlet --interval 5 --count 0 &
done

echo "✅ All 10 Singapore outlets started!"
echo "Press Ctrl+C to stop all"
```

**Option B: Run One Outlet at a Time**

```bash
# Outlet 1: Marina Bay Sands
python3 scripts/pos-simulator.py --dev --outlet 1 --interval 5 --count 0

# Outlet 2: Orchard Road (new terminal)
python3 scripts/pos-simulator.py --dev --outlet 2 --interval 5 --count 0

# ... continue for each outlet
```

**Option C: Batch Mode (有限 transactions)**

```bash
# Send 50 transactions per outlet
for outlet in 1 2 3 164 165 166 167 168 169 170; do
  python3 scripts/pos-simulator.py --dev --outlet $outlet --count 50
done
```

---

### Step 3: Verify Data is Flowing

**Check Terminal Output:**
```
[14:30:05] #1 [SG] ✅ 200  OK=1  FAIL=0
[14:30:10] #2 [SG] ✅ 200  OK=1  FAIL=0
[14:30:15] #3 [SG] ✅ 200  OK=1  FAIL=0
...
```

**Check Dashboard:**
1. Open `https://cqaifrc.cqit.sg`
2. Login as `steve.gilang@gmail.com`
3. Select **Singapore** in country filter
4. Watch revenue chart update in real-time

**Check Database (SQL Editor):**
```sql
-- Verify transactions
SELECT 
  outlet_id,
  COUNT(*) as txn_count,
  SUM(amount) as total_revenue,
  currency_code
FROM sales_transactions 
WHERE currency_code = 'SGD'
GROUP BY outlet_id, currency_code
ORDER BY outlet_id;
```

---

## 📊 What You'll See

### Terminal Output
```
[14:30:05] #1   [SG] ✅ 200  OK=1   FAIL=0
[14:30:06] #2   [SG] ✅ 200  OK=1   FAIL=0
[14:30:07] #3   [SG] ✅ 200  OK=1   FAIL=0
[14:30:08] #164 [SG] ✅ 200  OK=1   FAIL=0
[14:30:09] #165 [SG] ✅ 200  OK=1   FAIL=0
...
```

### Dashboard
- **KPI Card:** Revenue updates every 10-13 seconds
- **Revenue Chart:** New data points appear
- **Live Indicator:** Shows real-time refresh

### Database
| Outlet | Transactions | Revenue (SGD) |
|--------|--------------|---------------|
| 1 | 50+ | S$ 15,000+ |
| 2 | 50+ | S$ 12,000+ |
| 3 | 50+ | S$ 10,000+ |
| ... | ... | ... |

---

## 🍜 Realistic Data Characteristics

### Menu Items (Singapore)
| Item | Price (SGD) |
|------|-------------|
| Nasi Goreng | S$ 18 |
| Ayam Geprek Matah | S$ 15 |
| Mie Goreng Jawa | S$ 14 |
| Kopi O / Teh O | S$ 5 |
| Ayam Rice | S$ 22 |
| Soto Ayam | S$ 16 |
| Laksa | S$ 15 |
| Roti Prata + Curry | S$ 12 |
| Kopi C Siew Dai | S$ 6 |
| Bakso | S$ 15 |

### Transaction Details
- **Tax:** PPN 11% (auto-calculated)
- **Discount:** 30% chance of 5-10% off
- **Payment:** QR Code (35%), Cash (30%), Card (20%), E-Wallet (15%)
- **Platform:** Dine-in (50%), GoFood (20%), GrabFood (15%), ShopeeFood (10%)

### Time Patterns
| Hours | Activity | Transactions/Hour |
|-------|----------|-------------------|
| 7-10 AM | Breakfast | 2-6 |
| 11 AM-2 PM | **Lunch Peak** | 8-14 |
| 3-5 PM | Afternoon | 2-6 |
| 6-9 PM | **Dinner Peak** | 8-14 |

---

## 🛑 How to Stop

### Stop All Simulators
```bash
pkill -f pos-simulator
```

### Stop Specific Outlet
```bash
# Find process ID
ps aux | grep pos-simulator

# Kill specific PID
kill <PID>
```

### Stop Background Jobs
```bash
# List background jobs
jobs

# Kill all background jobs
kill %1 %2 %3 ...
```

---

## ⚠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| `No outlets found` | Run Step 1 SQL first |
| `Connection refused` | Check internet connection |
| `401 Unauthorized` | Use `--dev` flag |
| `404 Not Found` | Check SUPABASE_URL in .env.local |
| Dashboard not updating | Refresh page, check country filter |
| Too many transactions | Increase interval: `--interval 10` |

---

## 🎯 Demo Checklist

| # | Task | Status | Time |
|---|------|--------|------|
| 1 | Seed regions + outlets | ⬜ | 2 min |
| 2 | Start POS simulator | ⬜ | 1 min |
| 3 | Verify dashboard shows data | ⬜ | 2 min |
| 4 | Test country filter | ⬜ | 1 min |
| 5 | Test Athena chat | ⬜ | 1 min |

---

## 📋 Quick Reference Commands

### Seed Data (SQL)
```sql
-- Regions
INSERT INTO regions (id, code, name, country, currency_code, is_active) 
VALUES (114, 'SG', 'Singapore', 'Singapore', 'SGD', true)
ON CONFLICT (id) DO NOTHING;

-- Outlets (10 Singapore)
INSERT INTO outlets (id, code, name, region_id, status, daily_target) VALUES
(1, 'SG-001', 'Marina Bay Sands', 114, 'ACTIVE', 500000),
(2, 'SG-002', 'Orchard Road', 114, 'ACTIVE', 450000),
(3, 'SG-003', 'Bugis Junction', 114, 'ACTIVE', 400000),
(164, 'SG-004', 'Tampines Mall', 114, 'ACTIVE', 350000),
(165, 'SG-005', 'Jurong Point', 114, 'ACTIVE', 380000),
(166, 'SG-006', 'Causeway Point', 114, 'ACTIVE', 320000),
(167, 'SG-007', 'Vivo City', 114, 'ACTIVE', 420000),
(168, 'SG-008', 'Suntec City', 114, 'ACTIVE', 480000),
(169, 'SG-009', 'Raffles City', 114, 'ACTIVE', 520000),
(170, 'SG-010', 'Compass One', 114, 'ACTIVE', 280000)
ON CONFLICT (id) DO NOTHING;
```

### POS Simulator (Terminal)
```bash
# Navigate to project
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise

# Start all 10 Singapore outlets
for outlet in 1 2 3 164 165 166 167 168 169 170; do
  python3 scripts/pos-simulator.py --dev --outlet $outlet --interval 5 --count 0 &
done

# Verify (check terminal output)
# Press Ctrl+C to stop
```

### Verify Data (SQL)
```sql
-- Check transactions
SELECT outlet_id, COUNT(*), SUM(amount), currency_code
FROM sales_transactions 
WHERE currency_code = 'SGD'
GROUP BY outlet_id, currency_code;
```

---

**Document Version:** 1.0
**Last Updated:** Aug 18, 2026
**Prepared For:** Demo Team
