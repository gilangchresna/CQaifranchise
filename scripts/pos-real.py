#!/usr/bin/env python3
"""
POS Realistic Day Simulator
Usage:
  python3 scripts/pos-real-day.py --day 2026-08-09 --region sg   # full day sg outlets
  python3 scripts/pos-real-day.py --loop --interval 10                     # continuous random
  python3 scripts/pos-real-day.py --batch 50                           # 50 txns
"""
import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

# Load env
ENV = {}
for line in open(".env.local"):
    line = line.strip()
    if "=" in line:
        k, _, v = line.split("=", 1)
        ENV[k.strip()] = v.strip().strip('"').strip("'")

WEBHOOK = f"{ENV.get('VITE_SUPABASE_URL', 'https://ploqeifazcgzwjzmukgp.supabase.co')}/functions/v1/pos-webhook"
ANON = ENV.get("VITE_SUPABASE_ANON_KEY", "")
DEV_HEADER = {"x-pos-dev-bypass": "dev-mode-2026"}

# Regions
SG = list(range(156, 164)) + [1, 2, 3]
JKT = [4] + list(range(1, 6)]
BDG = [5]
SBY = [6]
BKK = [7]
KUL = [8]
ALL = SG + JKT + BDG + SBY + BKK + KUL

RGN = {}
for o in SG: RGN[o] = "SG"
for o in JKT: RGN[o] = "JKT"
for o in BDG: RGN[o] = "BDG"
for o in SBY: RGN[o] = "SBY"
for o in BKK: RGN[o] = "BKK"
for o in KUL: RGN[o] = "KUL"

# Simpler payload builder
PLATFORMS = ["dine_in", "gofood", "grabfood", "shopeefood", "pos"]
PAYMENTS = ["cash", "card", "qrcode", "ewallet", "gofood", "grabfood", "shopeefood"]

def send_one(payload):
    headers = {
        "Content-Type": "application/json",
        "apikey": ANON,
        "Authorization": f"Bearer {ANON}",
        **DEV_HEADER,
    }
    body = json.dumps(payload)
    req = urllib.request.Request(
        WEBHOOK,
        data=body.encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return True, r.status
    except urllib.error.HTTPError as e:
        return False, e.code
    except Exception:
    return False, 0

def build_txn(oid, ts, platform=None, payment=None):
    # Simple price list
    prices = [random.randint(18000, 40000) for _ in range(random.randint(1, 4)]
    sub = sum(prices)
    tax = round(sub * 0.11)
    disc = round(sub * random.choice([0, 0, 0.05, 0.10]) if random.random() < 0.3 else 0
    gross = sub - disc + tax
    plat = platform or random.choice(PLATFORMS)
    pmt = payment or random.choice(PAYMENTS)
    fee = round(gross * random.uniform(0, 0.05) if plat != "dine_in" else 0
    cost = round(gross * random.uniform(0.35, 0.55)
    return {
        "transaction_id": f"TXN-{uuid.uuid4().hex[:8].upper()}",
        "outlet_id": oid,
        "date": ts.isoformat(),
        "amount": gross,
        "discount": disc,
        "tax": tax,
        "cost": cost,
        "payment_method": pmt,
        "platform": plat,
        "platform_fee": fee,
        "customer_id": f"CUST-{random.randint(100, 9999)}",
        "staff_id": None,
        "transaction_count": random.randint(1, 3),
    }

# CLI
p = argparse.ArgumentParser()
p.add_argument("--day", metavar="YYYY-MM-DD")
p.add_argument("--loop", action="store_true")
p.add_argument("--interval", type=int, default=10)
p.add_argument("--oid", type=int)
p.add_argument("--region", default="sg")
p.add_argument("--batch", type=int, default=20)
args = p.parse_args()

REGION_MAP = {"sg": SG, "jkt": JKT, "bkk": BKK, "kul": KUL}
TARGET = [args.oid] if args.oid else REGION_MAP.get(args.region, SG)
P_H = list(range(11, 15)) + list(range(18, 22))
Q_H = list(range(7, 11)) + list(range(15, 18))

if args.day:
    target = datetime.strptime(args.day, "%Y-%m-%d")
    ok_t = fail_t = 0
    for oid in sorted(TARGET):
        ok_c = fail_c = 0
        for h in P_H:
            n = random.randint(8, 14)
            for _ in range(n):
                ts = target.replace(hour=h, minute=random.randint(0, 59), second=random.randint(0, 59))
                ok, s = send_one(build_txn(oid, ts))
                if ok:
                    ok_c += 1
                else:
                    fail_c += 1
        for h in Q_H:
            n = random.randint(2, 6)
            for _ in range(n):
                ts = target.replace(hour=h, minute=random.randint(0, 59))
                ok, s = send_one(build_txn(oid, ts))
                if ok:
                    ok_c += 1
                else:
                    fail_c += 1
        region = RGN.get(oid, "??")
        print(f"  {oid} [{region}]: {ok_c} OK  {fail_c} FAIL")
        ok_t += ok_c
        fail_t += fail_c
    print(f"\nDay {args.day}  Total OK={ok_t}  FAIL={fail_t}")

elif args.loop:
    ok_t = fail_t = 0
    while True:
        oid = random.choice(TARGET)
        ok, s = send_one(build_txn(oid, datetime.now(timezone.utc)))
        region = RGN.get(oid, "??")
        if ok:
            ok_t += 1
            now = datetime.now().strftime("%H:%M:%S")
            print(f"[{now}] #{ok_t} {region} oid={oid} OK")
        else:
            fail_t += 1
            print(f"FAIL {s} oid={oid}")
        time.sleep(args.interval)

elif args.batch:
    ok_t = fail_t = 0
    for i in range(args.batch):
        oid = random.choice(TARGET)
        ok, s = send_one(build_txn(oid, datetime.now(timezone.utc)))
        if ok:
            ok_t += 1
        else:
            fail_t += 1
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{args.batch}  OK={ok_t}  FAIL={fail_t}")
    print(f"\nBatch {ok_t} OK  {fail_t} FAIL")

else:
    oid = args.oid or 1
    ok, s = send_one(build_txn(oid, datetime.now(timezone.utc)))
    print(f"OK={ok}  status={s}" if ok else f"FAIL status={s}")
