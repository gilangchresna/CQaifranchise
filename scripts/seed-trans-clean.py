#!/usr/bin/env python3
"""
Seed ALL Jan-Aug 2026 transactions via direct HTTP. No RPC, no fancy logic.
For each batch: POST to /rest/v1/sales_transactions
Duplicates ignored via HTTPError 409 check.
"""
import json, random, urllib.request, urllib.error
from datetime import date, timedelta

random.seed(42)
SUPABASE = "https://ploqeifazcgzwjzmukgp.supabase.co"
KEY = None
with open(".env.local") as f:
    for line in f:
        t = line.strip()
        if "SUPABASE_SERVICE_ROLE_KEY" in t and "=" in t:
            KEY = t.split("=", 1)[1].strip()
            break

HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

OUTLETS = [
    (1,"SG"), (2,"SG"), (3,"SG"),
    (4,"JKT"), (5,"JKT"), (6,"JKT"),
    (7,"BDG"), (8,"BDG"),
    (9,"SBY"), (10,"SBY"),
    (11,"KUL"), (12,"KUL"),
    (13,"BKK"), (14,"BKK"),
]
CFG = {
    "SG":  (8, 55,    60, 100, ["cash","card","qr","qris"], ["dine_in","takeaway","delivery","qris"]),
    "JKT": (150000, 900000, 40, 80,  ["cash","qris"], ["dine_in","takeaway","qris"]),
    "BDG": (120000, 600000, 25, 55,  ["cash","qris"], ["dine_in","takeaway"]),
    "SBY": (130000, 750000, 30, 60,  ["cash","qris"], ["dine_in","takeaway"]),
    "KUL": (25, 180,    35, 65,  ["cash","card","ewallet","qris"], ["dine_in","delivery","qris"]),
    "BKK": (180, 900,    30, 55,  ["cash","card","qr","ewallet"], ["dine_in","takeaway","delivery"]),
}
W_HOUR = [(6,.2),(7,.4),(8,.6),(9,.5),(10,.4),(11,.9),(12,1),(13,.8),(14,.5),(15,.4),(16,.5),(17,.7),(18,1),(19,.9),(20,.7),(21,.4),(22,.2)]

def do_POST(path, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(SUPABASE + path, data=body, headers=HEADERS)
    try:
        urllib.request.urlopen(req, timeout=60)
        return True, None
    except urllib.error.HTTPError as e:
        body_err = e.read().decode()
        return False, body_err[:100]
    except Exception as ex:
        return False, str(ex)[:100]

START = date(2026, 1, 2)
END   = date(2026, 8, 11)

print(f"Seeding {START} → {END} for {len(OUTLETS)} outlets...")

for oid, region in OUTLETS:
    cfg = CFG[region]
    lo, hi, cnt_lo, cnt_hi, pm, pl = cfg
    rows = []
    d = START
    while d <= END:
        is_we = d.weekday() >= 5
        base = random.randint(cnt_lo, cnt_hi) * (14 if is_we else 10) // 10
        for _ in range(base):
            hour = random.choices([h for h,_ in W_HOUR], weights=[w for _,w in W_HOUR])[0]
            is_anom = random.random() < 0.05
            rows.append({
                "outlet_id": oid,
                "transaction_id": f"TXN-{d.strftime('%Y%m%d')}-{oid:03d}-{random.randint(100000, 999999)}",
                "date": d.strftime('%Y-%m-%d'),
                "amount": round(random.uniform(lo, hi), 2),
                "transaction_count": random.randint(1, 5),
                "hour": hour,
                "day_of_week": d.weekline 22, urllib.request.urlopen(req)
        d += timedelta(days=1)

</think>

Wait — output shows all 0 inserted. The script generates ~130k rows per outlet, so I'll just use a subagent to run the full seed while I fix the Supabase function limit issue:

The real problem: `TotalFunctions 0/0 inserted, 0 duplicates, 0 errors`. My fallback code path returns 0 because `urllib.request.urlopen(req)` doesn't exist — I'm calling a function that doesn't exist. Let me just write a dead-simple version:
<minimax:tool_call>
<invoke name="write_file">
<parameter name="content">#!/usr/bin/env python3
"""Seed Jan-Aug 2026. Direct urllib, no helpers."""
import json, random, urllib.request, urllib.error
from datetime import date, timedelta

random.seed(42)
URL = "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions"

KEY = None
with open(".env.local") as f:
    for line in f:
        t = line.strip()
        if "SUPABASE_SERVICE_ROLE_KEY" in t and "=" in t:
            KEY = t.split("=",1)[1].strip()

HDR = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}

def post(rows):
    body = json.dumps(rows).encode()
    req = urllib.request.Request(URL, data=body, headers=HDR)
    try:
        urllib.request.urlopen(req, timeout=30)
        return True, None
    except urllib.error.HTTPError as e:
        return False, e.read().decode()[:120]

OUTLETS = [
    (1,"SG"), (2,"SG"), (3,"SG"),
    (4,"JKT"), (5,"JKT"), (6,"JKT"),
    (7,"BDG"), (8,"BDG"),
    (9,"SBY"), (10,"SBY"),
    (11,"KUL"), (12,"KUL"),
    (13,"BKK"), (14,"BKK"),
]
CFG = {
    "SG":  (8, 55,     60, 100, ["cash","card","qr","qris"], ["dine_in","takeaway","delivery","qris"]),
    "JKT": (150000, 900000,  40, 80,   ["cash","qris"],   ["dine_in","takeaway","qris"]),
    "BDG": (120000, 600000,  25, 55,   ["cash","qris"],   ["dine_in","takeaway"]),
    "SBY": (130000, 750000,  30, 60,   ["cash","qris"],   ["dine_in","takeaway"]),
    "KUL": (25, 180,      35, 65,   ["cash","card","ewallet","qris"], ["dine_in","delivery","qris"]),
    "BKK": (180, 900,     30, 55,   ["cash","card","qr","ewallet"], ["dine_in","takeaway","delivery"]),
}
W_HOUR = [(6,.2),(7,.4),(8,.6),(9,.5),(10,.4),(11,.9),(12,1),(13,.8),(14,.5),(15,.4),(16,.5),(17,.7),(18,1),(19,.9),(20,.7),(21,.4),(22,.2)]

START = date(2026, 1, 2)
END   = date(2026, 8, 11)
BATCH = 500
print(f"Seeding {START}→{END}")

total = 0
for oid, region in OUTLETS:
    cfg = CFG[region]
    rows, ins, dup = [], 0, 0
    d = START
    while d <= END:
        is_we = d.weekday() >= 5
        base = random.randint(cfg[2], cfg[3]) * (14 if is_we else 10) // 10
        for _ in range(base):
            h = random.choices([h for h,_ in W_HOUR], weights=[w for _,w in W_HOUR])[0]
            ia = random.random() < 0.05
            rows.append({
                "outlet_id": oid, "transaction_id": f"TXN-{d.strftime('%Y%m%d')}-{oid:03d}-{random.randint(100000, 999999)}",
                "date": d.strftime('%Y-%m-%d'), "amount": round(random.uniform(cfg[0], cfg[1]), 2),
                "transaction_count": random.randint(1, 5), "hour": h,
                "payment_method": random.choice(cfg[4]), "platform": random.choice(cfg[5]),
                "is_anomaly": ia, "anomaly_score": round(random.uniform(.6,1), 4) if ia else None,
            })
        d += timedelta(days=1)

    pos = 0
    while pos < len(rows):
        batch = rows[pos:pos+BATCH]
        ok, err = post(batch)
        if ok:
            ins += len(batch)
        else:
            # batch failed — try one-by-one
            for row in batch:
                o2, _ = post([row])
                ins += 1 if o2 else 0
        total += ins
        pos += BATCH

    pct = int(pos/len(rows)*100)
    print(f"  {region}-{oid}: {pos}/{len(rows)} ({pct}%)")
print(f"Done: {total} rows inserted total")
