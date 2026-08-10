#!/usr/bin/env python3
"""CQaiFranchise POS Simulator — Realistic Day Simulation.

Usage:
  # Full business day (all Singapore outlets)
  python3 scripts/pos-sim-real.py --day 2026-08-09 --region sg

  # Specific date + region
  python3 scripts/pos-sim-real.py --day 2026-08-09 --region jkt

  # Realistic continuous loop (random outlet/platform/amount every N seconds)
  python3 scripts/pos-sim-real.py --loop --interval 10

  # All outlets one-shot batch
  python3 scripts/pos-sim-real.py --batch 100 --region all

  # Single outlet one-shot
  python3 scripts/pos-sim-real.py --oid 1 --platform dine_in --count 5

  # Dev mode: skips HMAC
  python3 scripts/pos-sim-real.py --dev --region sg --day 2026-08-09
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
from pathlib import Path

# ── Config ───────────────────────────────────────────────────
ENV = Path(__file__).resolve().parent.parent / ".env.local"
ANON_KEY = None
SUPABASE_URL = None

if ENV.exists():
    for line in ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            v = v.strip().strip('"').strip("'")
            if k in ("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"):
                ANON_KEY = v
            elif k in ("VITE_SUPABASE_URL", "SUPABASE_URL"):
                SUPABASE_URL = v

WEBHOOK = (
    f"{SUPABASE_URL}/functions/v1/pos-webhook"
    if SUPABASE_URL
    else "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/pos-webhook"
)

# ── Outlet Regions ──────────────────────────────────────────
SG_OUTLETS = list(range(156, 164)) + [1, 2, 3]
JKT_OUTLETS = [4] + list(range(1, 6))
BDG_OUTLETS = [5]
SBY_OUTLETS = [6]
BKK_OUTLETS = [7]
KUL_OUTLETS = [8]
ALL_OUTLETS = SG_OUTLETS + JKT_OUTLETS + BDG_OUTLETS + SBY_OUTLETS + BKK_OUTLETS + KUL_OUTLETS

REGION_OUTLETS = {
    "sg":   SG_OUTLETS,
    "jkt":  JKT_OUTLETS,
    "bdg":  BDG_OUTLETS,
    "sby":  SBY_OUTLETS,
    "bkk":  BKK_OUTLETS,
    "kul":  KUL_OUTLETS,
    "all":  ALL_OUTLETS,
}

REGION_NAME = {oid: "SG"  for oid in SG_OUTLETS}
REGION_NAME.update({oid: "JKT" for oid in JKT_OUTLETS})
REGION_NAME.update({oid: "BDG" for oid in BDG_OUTLETS})
REGION_NAME.update({oid: "SBY" for oid in SBY_OUTLETS})
REGION_NAME.update({oid: "BKK" for oid in BKK_OUTLETS})
REGION_NAME.update({oid: "KUL" for oid in KUL_OUTLETS})

# ── Menu ───────────────────────────────────────────────────
STANDARD_MENU = [
    "Nasi Goreng", "Ayam Geprek", "Mie Goreng", "Es Teh Manis",
    "Soto Ayam", "Bakso", "Es Campur", "Rawon",
]
PREMIUM_MENU = [
    "Nasi Goreng Premium", "Ayam Geprek Sambal", "Mie Goreng Jawa",
    "Es Jeruk Peras", "Sate Ayam Premium", "Soto Special",
    "Rendang Sapi", "Pisang Goreng Keju",
]

PAYMENT_OPTS  = ["cash", "card", "qrcode", "ewallet"]
PAYMENT_WEIGHTS = [30, 20, 35, 15]
PLATFORM_OPTS  = ["dine_in", "gofood", "grabfood", "shopeefood"]
PLATFORM_WEIGHTS = [50, 20, 15, 10]

# ── Helpers ──────────────────────────────────────────────────
def wc(opts, weights):
    return random.choices(opts, weights=weights, k=1)[0]

def send_one(payload, dev_mode):
    body = json.dumps(payload, ensure_ascii=False)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ANON_KEY}",
        "apikey": ANON_KEY,
    }
    if dev_mode:
        headers["x-pos-dev-bypass"] = "dev-mode-2026"
    req = urllib.request.Request(
        WEBHOOK, data=body.encode(), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return True, r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return False, e.code, e.read().decode()
    except Exception as exc:
        return False, 0, str(exc)

def build_txn(outlet_id, ts, platform=None):
    menu = PREMIUM_MENU if outlet_id in SG_OUTLETS else STANDARD_MENU
    items = random.sample(menu, k=random.randint(1, min(4, len(menu)))
    prices = [random.randint(18000, 40000) for _ in range(len(items))]
    sub = sum(prices)
    tax = round(sub * 0.11)
    disc = 0
    if random.random() < 0.3:
        disc = round(sub * random.choice([0.05, 0.10]))
    gross = sub - disc + tax
    pform = platform or random.choice(PLATFORM_OPTS)
    pymt = random.choice(PAYMENT_OPTS)
    fee = round(gross * random.uniform(0, 0.05)) if pform != "dine_in" else 0
    cost = round(gross * random.uniform(0.35, 0.55))
    tax    = round(sub * 0.11)
    disc   = round(sub * random.choice([0, 0, 0, 0, 0.05, 0.10])) if random.random() < 0.3 else 0
    gross  = sub - disc + tax
    pform  = platform or wc(PLATFORM_OPTS, PLATFORM_WEIGHTS)
    pymt   = wc(PAYMENT_OPTS, PAYMENT_WEIGHTS)
    fee    = round(gross * random.uniform(0, 0.05)) if pform != "dine_in" else 0
    cost   = round(gross * random.uniform(0.35, 0.55))
    return {
        "transaction_id":   f"TXN-{uuid.uuid4().hex[:8].upper()}",
        "outlet_id":         outlet_id,
        "date":              ts.isoformat(),
        "amount":            gross,
        "discount":           disc,
        "tax":               tax,
        "cost":              cost,
        "payment_method":     pymt,
        "platform":          pform,
        "platform_fee":       fee,
        "customer_id":         f"CUST-{random.randint(100, 9999)}",
        "staff_id":          None,
        "transaction_count":   random.randint(1, 3),
    }

# ── Business hours distribution ──────────────────────────────
PEAK_HOURS  = list(range(11, 15)) + list(range(18, 22))   # 11-14, 18-21
QUIET_HOURS = list(range(7, 11)) + list(range(15, 18))    # 7-10, 15-17
# TUNE counts per hour
PEAK_TXNS  = range(8, 15)    # 8-14 txns per peak hour
QUIET_TXNS = range(2, 7)     # 2-6 txns per quiet hour

# ── Core simulation ────────────────────────────────────────
def sim_day(date_str, outlets, dev_mode):
    target = datetime.strptime(date_str, "%Y-%m-%d")
    ok_t = fail_t = 0
    for oid in sorted(outlets):
        ok_c = fail_c = 0
        region = REGION_NAME.get(oid, "??")
        for h in PEAK_HOURS:
            for _ in range(random.randint(*PEAK_TXNS.start, PEAK_TXNS.stop - 1):
                ts = target.replace(hour=h, minute=random.randint(0, 59), second=random.randint(0, 59), tzinfo=timezone.utc)
                ok, s, b = send_one(build_txn(oid, ts), dev_mode)
                if ok: ok_c += 1
                else:   fail_c += 1
        for h in QUIET_HOURS:
            for _ in range(random.randint(*QUIET_TXNS.start, QUIET_TXNS.stop - 1):
                ts = ok = fail_c = 0
                ok, s, b = send_one(build_txn(oid, ts), dev_mode)
                if ok: ok_c += 1
                else:   fail_c += 1
        ok_t += ok_c; fail_t += fail_c
        print(f"  #{oid} [{region}]  {ok_c} txns  fail={fail_c}")
    print(f"\nTotal: {ok_t} OK  {fail_t} FAIL")

def sim_loop(interval, dev_mode):
    ok_t = fail_t = 0
    while True:
        oid = random.choice(ALL_OUTLETS)
        ts   = datetime.now(timezone.utc)
        ok, s, b = send_one(build_txn(oid, ts), dev_mode)
        now  = datetime.now().strftime("%H:%M:%S")
        region = REGION_NAME.get(oid, "??")
        if ok:
            ok_t += 1
            print(f"[{now}] #{oid}[{region}] ok={ok_t}  fail={fail_t}")
        else:
            fail_t += 1
            print(f"[{now}] #{oid} FAIL {s}: {b[:80]}")
        time.sleep(interval)

def sim_batch(count, outlets, dev_mode):
    ok_t = fail_t = 0
    for i in range(count):
        oid = random.choice(outlets)
        ok, s, b = send_one(build_txn(oid, datetime.now(timezone.utc)), dev_mode)
        if ok: ok_t += 1
        else:   fail_t += 1
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{count}  ok={ok_t}  fail={fail_t}")
    print(f"\nBatch done: {ok_t} ok  {fail_t} fail")
    return ok_t, fail_t

# ── CLI ────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(description="POS Realistic Simulator")
    p.add_argument("--dev",       action="store_true")
    p.add_argument("--oid",        type=int,  default=None,  help="Outlet ID")
    p.add_argument("--region",      default="sg",  help="sg | jkt | bdg | sby | bkk | kul | all")
    p.add_argument("--platform",    default=None)
    p.add_argument("--interval",   type=int,  default=10)
    p.add_argument("--count",      type=int,  default=1)
    p.add_argument("--day",        metavar="YYYY-MM-DD")
    p.add_argument("--loop",        action="store_true")
    p.add_argument("--batch",       type=int,  metavar="N")
    args = p.parse_args()

    if not ANON_KEY:
        print("ERROR: ANON_KEY not loaded. Check .env.local")
        sys.exit(1)

    dev = args.dev
    region = args.region or "sg"
    outlets = [args.oid] if args.oid else REGION_OUTLETS.get(region, SG_OUTLETS)

    if args.loop:
        print(f"\nMODE: LOOP every {args.interval}s  region={region}  outlets={len(outlets)}  dev={dev}")
        sim_loop(args.interval, dev)
    elif args.batch:
        print(f"\nMODE: BATCH {args.batch} txns  region={region}  dev={dev}")
        sim_batch(args.batch, outlets, dev)
    elif args.day:
        print(f"\nMODE: DAY SIM  {args.day}  region={region}  outlets={outlets}  dev={dev}")
        sim_day(args.day, outlets, dev)
    else:
        # One-shot
        oid = args.oid or 1
        ts = datetime.now(timezone.utc)
        ok, s, b = send_one(build_txn(oid, ts, args.platform), dev)
        if ok:
            print(f"OK {s}")
        else:
            print(f"FAIL {s}: {b[:100]}")

if __name__ == "__main__":
    main()
