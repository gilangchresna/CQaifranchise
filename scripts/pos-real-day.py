#!/usr/bin/env python3
"""POS Realistic Day Simulator — all outlets, weighted platforms/payments."""
import argparse, json, random, sys, time, urllib.error, urllib.request, uuid
from datetime import datetime, timezone

# config
ANON_KEY = ""
SUPABASE_URL = "https://ploqeifazcgzwjzmukgp.supabase.co"
WEBHOOK = f"{SUPABASE_URL}/functions/v1/pos-webhook"

# load key
for line in open(".env.local"):
    line = line.strip()
    if "=" in line:
        k, _, v = line.partition("=")
        if k in ("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"):
            ANON_KEY = v.strip().strip('"').strip("'")
            break

# regions
SG = list(range(156, 164)) + [1, 2, 3]
JKT = [4] + list(range(1, 6))
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

PAYMENT = [("cash", 30), ("qrcode", 35), ("card", 20), ("ewallet", 15)]
PLATFORM = [("dine_in", 50), ("gofood", 20), ("grabfood", 15), ("shopeefood", 10)]
PEAK_H = list(range(11, 15)) + list(range(18, 22))
QUIET_H = list(range(7, 11)) + list(range(15, 18))

def send(body, dev=True):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ANON_KEY}",
        "apikey": ANON_KEY,
        "x-pos-dev-bypass": "dev-mode-2026",
    }
    req = urllib.request.Request(WEBHOOK, data=json.dumps(body).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return True, r.status
    except urllib.error.HTTPError as e:
        return False, e.code
    except Exception:
    return False, 0

def pick(opts):
    return random.choices([o[0] for o in opts], weights=[o[1] for o in opts])[0]

def tx(oid, ts):
    n = random.randint(1, 4)
    prices = [random.randint(18000, 40000) for _ in range(n)]
    sub = sum(prices)
    tax = round(sub * 0.11)
    disc = round(sub * random.choice([0, 0, 0, 0, 0, 0.05, 0.10])) if random.random() < 0.3 else 0
    gross = sub - disc + tax
    plat = pick([("dine_in", 50), ("gofood", 20), ("grabfood", 15), ("shopeefood", 10)]
    pmt = pick([("cash", 30), ("qrcode", 35), ("card", 20), ("ewallet", 15])
    fee = round(gross * random.uniform(0, 0.05)) if plat != "dine_in" else 0
    cost = round(gross * random.uniform(0.35, 0.55)
    return {
        "transaction_id": f"TXN-{uuid.uuid4().hex[:8].upper()}",
        "outlier_id": oid,
        "date": ts.isoformat(),
        "amount": gross,
        "discount": disc,
        "tax": tax,
        "cost": cost,
        "payment_method": pmt,
        "platform": plat,
        "platform_fee": fee,
        "customer_id": f"CUST-{random.randint(100, 9999)",
        "staff_id": None,
        "transaction_count": random.randint(1, 3),
    }

# ── parse args
p = argparse.ArgumentParser()
p.add_argument("--dev", action="store_true")
p.add_argument("--day", metavar="YYYY-MM-DD")
p.add_argument("--loop", action="store_true")
p.add_argument("--oid", type=int)
p.add_argument("--interval", type=int, default=10)
p.add_argument("--count", type=int, default=20)
p.add_argument("--region", default="sg")
p.add_argument("--batch", type=int)
args = p.parse_args()

if not ANON_KEY:
    print("ERROR: ANON_KEY not loaded")
    sys.exit(1)

REGION_MAP = {"sg": SG, "jkt": JKT, "bdg": BDG, "sby": SBY, "bkk": BKK, "kul": KUL, "all": ALL}
OUTLETS = [args.oid] if args.oid else REGION_MAP.get(args.region, SG)

# ── full day simulation
if args.day:
    target = datetime.strptime(args.day, "%Y-%m-%d")
    ok_t = fail_t = 0
    for oid in sorted(OUTLETS):
        ok_c = fail_c = 0
        for h in PEAK_H:
            for _ in range(random.randint(8, 14)):
                ts = target.replace(hour=h, minute=random.randint(0, 59))
                ok, s = send(tx(oid, ts), dev=args.dev)
                if ok: ok_c += 1
                else: fail_c += 1
        for h in QUIET_H:
            for _ in range(random.randint(2, 6)):
                ts = target.replace(hour=h, minute=random.randint(0, 59))
                ok, s = send(tx(oid, datetime.now()), dev=args.dev)
                if ok: ok_c += 1
                else: fail_c += 1
        rgn = RGN.get(oid, "??")
        print(f"  #{oid} [{rgn}]: {ok_c} OK  {fail_c} FAIL")
        ok_t += ok_c
        fail_t += fail_c
    print(f"Day {args.day}: {ok_t} OK  {fail_t} FAIL")

# ── continuous loop
elif args.loop:
    ok_t = fail_t = 0
    while True:
        oid = random.choice(OUTLETS)
        ok, s = send(tx(oid, datetime.now()), dev=True)
        now = datetime.now().strftime("%H:%M:%S")
        rgn = RGN.get(oid, "??")
        if ok:
            ok_t += 1
            print(f"[{now}] #{oid} [{rgn}] OK  total={ok_t}")
        else:
            fail_t += 1
            print(f"[{now}] #{oid} FAIL={s}")

# ── batch mode
elif args.batch:
    ok_t = fail_t = 0
    for i in range(args.batch):
        oid = random.choice(OUTLETS)
        ok, s = send(tx(oid, datetime.now()), dev=True)
        if ok: ok_t += 1
        else: fail_t += 1
        if (i + 1) % 20 == 0:
            print(f"  {i+1}/{args.batch}  OK={ok_t}  FAIL={fail_t}")
    print(f"Batch {args.batch}: {ok_t} OK  {fail_t} FAIL")

# ── one-shot
else:
    oid = args.oid or 1
    ok, s = send(tx(oid, datetime.now()), dev=True)
    rgn = RGN.get(oid, "??")
    if ok:
        print(f"OK {s}  oid={oid} [{rgn}]")
    else:
        print(f"FAIL {s} oid={oid}")
