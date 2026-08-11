#!/usr/bin/env python3
"""Seed Jan-Aug 2026 all transactions. Batches 500. Handles duplicates."""
import json, random, urllib.request, urllib.error
from datetime import date, timedelta

random.seed(42)

SUPABASE = "https://ploqeifazcgzwjzmukgp.supabase.co"
ENV_FILE = "/Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise/.env.local"
KEY = None
with open(ENV_FILE) as f:
    for line in f:
        t = line.strip()
        if t.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            KEY = t.split("=", 1)[1].strip()
            break

HDR = {
    "apikey": KEY,
    "Authorization": "Bearer " + KEY,
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

OUTLETS = [
    (1,"SG"),(2,"SG"),(3,"SG"),
    (4,"JKT"),(5,"JKT"),(6,"JKT"),
    (7,"BDG"),(8,"BDG"),
    (9,"SBY"),(10,"SBY"),
    (11,"KUL"),(12,"KUL"),
    (13,"BKK"),(14,"BKK"),
]
CFG = {
    "SG":  {"lo": 8,     "hi": 55,     "cnt": (60,100),  "pm": ["cash","card","qr","qris"], "pl": ["dine_in","takeaway","delivery","qris"]},
    "JKT": {"lo": 150000,  "hi": 900000,  "cnt": (40,80),   "pm": ["cash","qris"],    "pl": ["dine_in","takeaway","qris"]},
    "BDG": {"lo": 120000,  "hi": 600000,  "cnt": (25,55),   "pm": ["cash","qris"],    "pl": ["dine_in","takeaway"]},
    "SBY": {"lo": 130000,  "hi": 750000,  "cnt": (30,60),   "pm": ["cash","qris"],    "pl": ["dine_in","takeaway"]},
    "KUL": {"lo": 25,       "hi": 180,     "cnt": (35,65),   "pm": ["cash","card","ewallet","qris"], "pl": ["dine_in","delivery","qris"]},
    "BKK": {"lo": 180,     "hi": 900,     "cnt": (30,55),   "pm": ["cash","card","qr","ewallet"], "pl": ["dine_in","takeaway","delivery"],
}
}
W_HOUR = [(6,.2),(7,.4),(8,.6),(9,.5),(10,.4),(11,.9),(12,1),(13,.8),(14,.5),(15,.4),(16,.5),(17,.7),(18,1),(19,.9),(20,.7),(21,.4),(22,.2)]
START = date(2026, 1, 2)
END   = date(2026, 8, 11)
BATCH = 500

def insert_one(row):
    body = json.dumps(row).encode()
    req = urllib.request.Request(SUPABASE + "/rest/v1/sales_transactions", data=body, headers=HDR, method="POST")
    try:
        urllib.request.urlopen(req, timeout=15)
        return True
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        if "23505" in err: return False  # duplicate
        raise

def insert_batch(rows):
    body = json.dumps(rows).encode()
    req = urllib.request.Request(SUPABASE + "/rest/v1/sales_transactions", data=body, headers=HDR, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return len(rows)
    except urllib.error.HTTPError as e:
        body_err = e.read().decode()
        if "23505" in body_err:
            # duplicate key — insert one-by-one, skip dups
            inserted = 0
            for r in rows:
                try:
                    insert_one(r)
                    inserted += 1
                except Exception:
                    pass
            return inserted
        # real error — raise
        raise Exception(body_err[:100])

total = 0
for oid, region in OUTLETS:
    cfg = CFG[region]
    rows = []
    d = START
    while d <= END:
        is_we = d.weekday() >= 5
        base = random.randint(*cfg["cnt"]) * (14 if is_we else 10) // 10
        hour = random.choices([h for h,_ in W_HOUR], weights=[w for _,w in W_HOUR])[0]
        is_anom = random.random() < 0.05
        txn_id = f"TXN-{d.strftime('%Y%m%d')}-{oid:03d}-{random.randint(100000,999999)}"
        rows.append({
            "outlet_id": oid,
            "transaction_id": txn_id,
            "date": d.strftime('%Y-%m-%d'),
            "amount": round(random.uniform(cfg["lo"], cfg["hi"]), 2),
            "transaction_count": random.randint(1, 5),
            "hour": hour,
            "payment_method": random.choice(cfg["pm"]),
            "platform": random.choice(cfg["pl"]),
            "is_anomaly": is_anom,
            "anomaly_score": round(random.uniform(.6,1.0), 4) if is_anom else None,
        })
        d += timedelta(days=1)

    pos = 0
    while pos < len(rows):
        batch = rows[pos:pos+BATCH]
        pos += BATCH
        try:
            inserted = insert_batch(batch)
            total += inserted
        except Exception as ex:
            print(f"  FATAL: {ex}")
            break

    print(f"  {region}-{oid}: {pos}/{len(rows)} rows, total so far: {total}")

print(f"Done: {total} rows total")
