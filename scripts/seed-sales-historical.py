#!/usr/bin/env python3
"""
Seed sales_transactions for Jan-Aug 2026
Uses hardcoded outlet IDs — run seed-regions-outlets-api first
"""
import json, os, random, urllib.request, urllib.error
from datetime import date, timedelta

source = open(".env.local")
for line in source:
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        os.environ[k] = v
source.close()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {
    "apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json", "Prefer": "return=minimal",
}
BATCH_SIZE = 500
START_DATE = date(2026, 1, 1)
END_DATE   = date(2026, 8, 11)

REGION_PROFILES = {
    "SG":  {"count_range": (60, 100),  "amount_range": (8, 55),    "currency": "SGD"},
    "JKT": {"count_range": (40, 80),   "amount_range": (150000, 900000), "currency": "IDR"},
    "BDG": {"count_range": (25, 55),   "amount_range": (120000, 600000), "currency": "IDR"},
    "SBY": {"count_range": (30, 60),   "amount_range": (130000, 750000), "currency": "IDR"},
    "KUL": {"count_range": (35, 65),   "amount_range": (25, 180),      "currency": "MYR"},
    "BKK": {"count_range": (30, 55),   "amount_range": (180, 900),     "currency": "THB"},
}
OUTLET_IDS = {
    "SG-001":  1, "SG-002":  2, "SG-003":  3,
    "JKT-001": 4, "JKT-002": 5, "JKT-003": 6,
    "BDG-001": 7, "BDG-002": 8,
    "SBY-001": 9, "SBY-002": 10,
    "KUL-001": 11, "KUL-002": 12,
    "BKK-001": 13, "BKK-002": 14,
}
PLATFORMS   = ["dine_in", "takeaway", "delivery", "qris"]
PAYMENT_METHODS = ["cash", "card", "qr_code", "ewallet"]
HOUR_WEIGHTS = [(6,.2),(7,.4),(8,.6),(9,.5),(10,.4),(11,.9),(12,1),(13,.8),(14,.5),
                (15,.4),(16,.5),(17,.7),(18,1),(19,.9),(20,.7),(21,.4),(22,.2)]

def weighted_hour():
    hrs = [h for h,_ in HOUR_WEIGHTS]
    wts = [w for _,w in HOUR_WEIGHTS]
    return random.choices(hrs, weights=wts, k=1)[0]

def api_post(path, payload):
    url = f"{SUPABASE_URL}{path}"
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:200]}")
        return None

print(f"Generating: {START_DATE} → {END_DATE}, {len(OUTLET_IDS)} outlets")
total = 0

for code, oid in OUTLET_IDS.items():
    region = code.split("-")[0]
    profile = REGION_PROFILES.get(region, REGION_PROFILES["SG"])
    outlet_total = 0
    d = START_DATE
    while d <= END_DATE:
        is_weekend = d.weekday() >= 5
        base = int(random.randint(*profile["count_range"]) * (1.4 if is_weekend else 1.0))
        rows = []
        for _ in range(base):
            txn_id = f"TXN-{d.strftime('%Y%m%d')}-{oid:03d}-{random.randint(100000,999999)}"
            rows.append({
                "outlet_id": oid,
                "transaction_id": txn_id,
                "date": d.isoformat(),
                "amount": round(random.uniform(*profile["amount_range"]), 2),
                "transaction_count": random.randint(1, 5),
                "hour": weighted_hour(),
                "day_of_week": d.weekday(),
                "anomaly_score": round(random.uniform(0.6, 1.0), 4) if random.random() < 0.05 else None,
                "is_anomaly": random.random() < 0.05,
                "payment_method": random.choice(PAYMENT_METHODS),
                "platform": random.choice(PLATFORMS),
            })
        # flush batches
        while len(rows) >= BATCH_SIZE:
            batch, rows = rows[:BATCH_SIZE], rows[BATCH_SIZE:]
            api_post("/rest/v1/sales_transactions", batch)
            total += len(batch)
        if rows:
            api_post("/rest/v1/sales_transactions", rows)
            total += len(rows)
            outlet_total += len(rows)
        d += timedelta(days=1)
    print(f"  {code} ({region}): ~{outlet_total} txns")
    if total >= 50000:
        print("  (cap at 50k)")
        break

print(f"\nDone — {total} transactions seeded")
