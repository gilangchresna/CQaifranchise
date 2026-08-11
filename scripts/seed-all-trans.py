#!/usr/bin/env python3
"""
Seed Jan-Aug 2026 sales_transactions (service role, bypasses RLS).
Handles duplicates via transaction_id UNIQUE constraint.
"""
import json, random, urllib.request
from datetime import date, timedelta

random.seed(42)
URL = "https://ploqeifazcgzwjzmukgp.supabase.co"

# Source SERVICE_ROLE_KEY from .env.local
KEY = None
with open("/Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise/.env.local") as f:
    for line in f:
        line = line.strip()
        if "SUPABASE_SERVICE_ROLE_KEY" in line and "=" in line:
            KEY = line.split("=", 1)[1].strip()
            break

HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}
HEADERS_ONE = {**HEADERS, "Prefer": "return=minimal"}

OUTLETS = [
    (1,"SG"), (2,"SG"), (3,"SG"),
    (4,"JKT"), (5,"JKT"), (6,"JKT"),
    (7,"BDG"), (8,"BDG"),
    (9,"SBY"), (10,"SBY"),
    (11,"KUL"), (12,"KUL"),
    (13,"BKK"), (14,"BKK"),
]
CFG = {
    "SG":  {"lo": 8,     "hi": 55,     "cnt": (60,100), "pm": ["cash","card","qr","ewallet"], "pl": ["dine_in","takeaway","delivery","qris"]},
    "JKT": {"lo": 150000, "hi": 900000, "cnt": (40,80), "pm": ["cash","qr","ewallet"], "pl": ["dine_in","takeaway","qris"]},
    "BDG": {"lo": 120000, "hi": 600000, "cnt": (25,55), "pm": ["cash","qr","ewallet"], "pl": ["dine_in","takeaway"]},
    "SBY": {"lo": 130000, "hi": 750000, "cnt": (30,60), "pm": ["cash","qr"], "pl": ["dine_in","takeaway"]},
    "KUL": {"lo": 25,     "hi": 180,    "cnt": (35,65), "pm": ["cash","card","ewallet","qr"], "pl": ["dine_in","delivery","qris"]},
    "BKK": {"lo": 180,   "hi": 900,    "cnt": (30,55), "pm": ["cash","card","qr","ewallet"], "pl": ["dine_in","takeaway","delivery"]},
}
W = [(6,.2),(7,.4),(8,.6),(9,.5),(10,.4),(11,.9),(12,1),(13,.8),(14,.5),(15,.4),(16,.5),(17,.7),(18,1),(19,.9),(20,.7),(21,.4),(22,.2)]

def whour():
    hrs = [h for h,_ in W]
    wts = [w for _,w in W]
    total = sum(wts)
    r = random.random() * total
    acc = 0
    for h, w in W:
        acc += w
        if r <= acc:
            return h
    return hrs[0]

def insert_one(row):
    req = urllib.request.Request(
        f"{URL}/rest/v1/sales_transactions",
        data=json.dumps(row).encode(),
        headers=HEADERS_ONE,
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=15)
        return 1, 0
    except urllib.request.HTTPError as e:
        body = e.read().decode()
        if "23505" in body:
            return 0, 1
        return 0, 0

def batch_insert(rows):
    req = urllib.request.Request(
        f"{URL}/rest/v1/rpc/bulk_sales_insert",
        data=json.dumps({"rows": rows}).encode(),
        headers={**HEADERS, "Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=60)
        return len(rows), 0
    except urllib.request.HTTPError as e:
        body = e.read().decode()
        if "23505" in body:
            # batch duplicate — fall back to one-by-one
            ins = dup = 0
            for r in rows:
                i, d = insert_one(r)
                ins += i
                dup += d
            return ins, dup
        # RPC not found or other error
        return 0, 0

START = date(2026, 1, 2)   # Jan 2 (skip New Year)
END   = date(2026, 8, 11)

total_ins = 0
total_dup = 0
total_err = 0

for oid, region in OUTLETS:
    cfg = CFG[region]
    rows = []
    d = START
    while d <= END:
        is_we = d.weekday() >= 5
        cnt = random.randint(*cfg["cnt"]) * (14 if is_we else 10) // 10
        amt_lo, amt_hi = cfg["lo"], cfg["hi"]
        for _ in range(cnt):
            txn_id = f"TXN-{d.strftime('%Y%m%d')}-{oid:03d}-{random.randint(100000, 999999)}"
            is_anom = random.random() < 0.05
            rows.append({
                "outlet_id": oid,
                "transaction_id": txn_id,
                "date": d.strftime('%Y-%m-%d'),
                "amount": round(random.uniform(amt_lo, amt_hi), 2),
                "transaction_count": random.randint(1, 5),
                "hour": whour(),
                "day_of_week": d.weekday(),
                "payment_method": random.choice(cfg["pm"]),
                "platform": random.choice(cfg["pl"]),
                "is_anomaly": is_anom,
                "anomaly_score": round(random.uniform(0.6, 1.0), 4) if is_anom else None,
            })
        d += timedelta(days=1)

    print(f"Outlet {oid} ({region}): {len(rows)} rows generated, flushing...", end=" ")

    i = 0
    while i < len(rows):
        batch = rows[i:i+500]
        ins, dup = batch_insert(batch)
        total_ins += ins
        total_dup += dup
        i += 500
    print(f"→ {total_ins} ins / {total_dup} dups")

print(f"\nTOTAL: {total_ins} inserted, {total_dup} duplicates, {total_err} errors")
print(f"Range: {START} to {END}")
