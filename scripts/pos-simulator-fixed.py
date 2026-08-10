#!/usr/bin/env python3
"""
CQaiFranchise POS Simulator — FIXED v2
========================================
Realistic SGD amounts, correct outlet IDs, idempotency.

Usage:
  # One-shot test (1 transaction)
  python3 pos-simulator-fixed.py --dev --count 1

  # Loop realistic (every 10s)
  python3 pos-simulator-fixed.py --dev --interval 10

  # Test specific outlet
  python3 pos-simulator-fixed.py --dev --outlet 169 --interval 5

  # Batch test (10 transactions, stop)
  python3 pos-simulator-fixed.py --dev --count 10

Environment:
  Reads VITE_SUPABASE_ANON_KEY from .env.local automatically.
"""
import argparse
import hashlib
import hmac
import json
import os
import random
import sys
import time
import uuid
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ── Load .env.local ─────────────────────────────────────────────────────────
ENV_FILE = Path(__file__).resolve().parent.parent / ".env.local"
ANON_KEY = None
SUPABASE_URL = None

if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, val = line.partition("=")
            val = val.strip().strip('"').strip("'")
            if key in ("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"):
                ANON_KEY = val
            elif key in ("VITE_SUPABASE_URL", "SUPABASE_URL"):
                SUPABASE_URL = val

WEBHOOK_URL = f"{SUPABASE_URL}/functions/v1/pos-webhook" if SUPABASE_URL else ""

# ── Outlet Config — ID + Region + Currency ────────────────────────────────
# Real seeded outlets (IDs 164-171, confirmed in DB)
OUTLETS = [
    {"id": 164, "code": "KT-TMP-001", "region": "Singapore", "currency": "SGD", "tier": "standard"},
    {"id": 165, "code": "NL-AMK-001", "region": "Singapore", "currency": "SGD", "tier": "standard"},
    {"id": 166, "code": "CR-JGP-001", "region": "Singapore", "currency": "SGD", "tier": "standard"},
    {"id": 167, "code": "LK-PLB-001", "region": "Singapore", "currency": "SGD", "tier": "premium"},
    {"id": 168, "code": "WS-TPY-001", "region": "Singapore", "currency": "SGD", "tier": "standard"},
    {"id": 169, "code": "MT-WDL-001", "region": "Singapore", "currency": "SGD", "tier": "premium"},
    {"id": 170, "code": "KT-HCE-001", "region": "Singapore", "currency": "SGD", "tier": "standard"},
    {"id": 171, "code": "ER-BSN-001", "region": "Singapore", "currency": "SGD", "tier": "standard"},
]

# Menu items with realistic prices in LOCAL CURRENCY
MENU_SGD_PREMIUM = [
    {"name": "Nasi Goreng Premium",  "price": 12.80},
    {"name": "Ayam Geprek Matah",    "price": 11.50},
    {"name": "Mie Goreng Jawa",       "price": 10.50},
    {"name": "Sate Ayam 10 tusuk",    "price": 14.00},
    {"name": "Rendang Sapi",          "price": 16.50},
    {"name": "Soto Special",          "price": 12.80},
    {"name": "Es Teh Manis",          "price":  3.00},
    {"name": "Es Jeruk Peras",        "price":  3.50},
    {"name": "Es Campur SG style",    "price":  5.00},
    {"name": "Pisang Goreng Keju",   "price":  6.50},
    {"name": "Cappuccino",           "price":  5.50},
    {"name": "Teh Tarik",            "price":  4.00},
]

MENU_SGD_STANDARD = [
    {"name": "Nasi Goreng",          "price":  8.50},
    {"name": "Ayam Geprek",          "price":  8.00},
    {"name": "Mie Goreng",            "price":  7.50},
    {"name": "Soto Ayam",             "price":  8.50},
    {"name": "Bakso",                "price":  9.00},
    {"name": "Sate Ayam 5 tusuk",    "price":  7.50},
    {"name": "Es Teh Manis",          "price":  2.50},
    {"name": "Es Jeruk",              "price":  3.00},
    {"name": "Es Campur",            "price":  4.50},
    {"name": "Pisang Goreng",        "price":  5.00},
]

MENU_IDR = [
    {"name": "Nasi Goreng",          "price": 28000},
    {"name": "Ayam Geprek",          "price": 25000},
    {"name": "Mie Goreng",            "price": 22000},
    {"name": "Soto Ayam",             "price": 28000},
    {"name": "Bakso",                "price": 25000},
    {"name": "Rawon",                "price": 32000},
    {"name": "Sate Ayam",            "price": 30000},
    {"name": "Es Teh Manis",          "price":  6000},
    {"name": "Es Jeruk",              "price":  7000},
    {"name": "Es Campur",            "price": 12000},
    {"name": "Pisang Goreng",        "price": 10000},
]

MENU_THB = [
    {"name": "Pad Thai",              "price": 120},
    {"name": "Tom Yum",              "price": 180},
    {"name": "Green Curry",           "price": 150},
    {"name": "Mango Sticky Rice",    "price": 90},
    {"name": "Thai Iced Tea",         "price": 50},
]

MENU_MYR = [
    {"name": "Nasi Lemak",           "price": 12},
    {"name": "Roti Canai",           "price": 8},
    {"name": "Mee Goreng Mamak",     "price": 10},
    {"name": " Teh Tarik",           "price": 5},
]

# Payment methods
PAYMENT_METHODS  = ["cash", "card", "qrcode", "ewallet"]
PAYMENT_WEIGHTS  = [25, 20, 35, 20]   # cash, card, qrcode, ewallet

# Platforms
PLATFORMS  = ["dine_in", "gofood", "grabfood", "shopeefood", "deliveroo"]
PLATFORM_WEIGHTS = [60, 15, 10, 10, 5]  # dine_in most common

# ── Helpers ───────────────────────────────────────────────────────────────────

def wchoice(opts, weights):
    return random.choices(opts, weights=weights, k=1)[0]

def get_menu(region: str, tier: str, currency: str):
    if currency == "IDR":
        return MENU_IDR
    elif currency == "THB":
        return MENU_THB
    elif currency == "MYR":
        return MENU_MYR
    elif tier == "premium":
        return MENU_SGD_PREMIUM
    else:
        return MENU_SGD_STANDARD

def sign_payload(body_str: str, secret: str) -> str:
    return hmac.new(secret.encode(), body_str.encode(), hashlib.sha256).hexdigest()

# ── Build realistic transaction ───────────────────────────────────────────────

def build_txn(outlet: dict, ts: datetime, use_idempotency: bool = True) -> dict:
    """Build one realistic transaction in local currency."""
    currency = outlet["currency"]
    menu = get_menu(outlet["region"], outlet["tier"], currency)

    # Random items (1-4 items)
    items = random.sample(menu, k=random.randint(1, min(4, len(menu))))
    subtotal = sum(i["price"] for i in items)

    # Tax: SG GST 9%
    tax = round(subtotal * 0.09, 2)

    # Discount (20% chance of 5-10% off)
    discount = 0
    if random.random() < 0.20:
        discount = round(subtotal * random.choice([0.05, 0.10]), 2)

    amount = round(subtotal - discount + tax, 2)
    cost = round(amount * random.uniform(0.35, 0.55), 2)

    # Platform + payment
    platform = wchoice(PLATFORMS, PLATFORM_WEIGHTS)
    payment  = wchoice(PAYMENT_METHODS, PAYMENT_WEIGHTS)
    platform_fee = round(amount * random.uniform(0, 0.05), 2) if platform != "dine_in" else 0

    # Transaction ID: real POS format — idempotent
    date_str = ts.strftime("%Y%m%d")
    time_str = ts.strftime("%H%M%S")
    suffix = uuid.uuid4().hex[:6].upper()
    txn_id = f"{outlet['code']}-{date_str}-T{time_str}-{suffix}"

    return {
        "transaction_id":    txn_id,
        "outlet_id":        outlet["id"],
        "date":             ts.isoformat(),
        "amount":            amount,        # Stored in SGD
        "discount":          discount,
        "tax":              tax,
        "cost":              cost,
        "payment_method":    payment,
        "platform":          platform,
        "platform_fee":      platform_fee,
        "customer_id":      f"CUST-{random.randint(100, 9999)}",
        "staff_id":          None,
        "transaction_count": random.randint(1, 3),
        "items": [
            {"name": i["name"], "price": i["price"]} for i in items
        ],
    }

# ── Send to webhook ───────────────────────────────────────────────────────────

def send(payload: dict, dev_mode: bool = False, secret: str = "") -> tuple:
    body_str = json.dumps(payload, ensure_ascii=False)
    headers = {
        "Content-Type":  "application/json",
        "Authorization": f"Bearer {ANON_KEY}",
        "apikey":        ANON_KEY,
    }
    if dev_mode:
        headers["x-pos-dev-bypass"] = "dev-mode-2026"
    elif secret:
        headers["x-pos-signature"] = sign_payload(body_str, secret)

    req = urllib.request.Request(
        WEBHOOK_URL,
        data=body_str.encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True, resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return False, e.code, e.read().decode()
    except Exception as exc:
        return False, 0, str(exc)

# ── Run modes ────────────────────────────────────────────────────────────────

def run_loop(outlet_ids: list, dev_mode: bool, interval: int):
    """Continuous loop — random outlet, realistic interval."""
    outlets = [o for o in OUTLETS if not outlet_ids or o["id"] in outlet_ids]
    if not outlets:
        print(f"ERROR: No matching outlets. Available IDs: {[o['id'] for o in OUTLETS]}")
        return

    print(f"\n{'='*60}")
    print(f"  REALISTIC LOOP | {len(outlets)} outlets | {interval}s interval")
    print(f"{'='*60}")

    ok, fail = 0, 0
    while True:
        outlet = random.choice(outlets)
        ts = datetime.now(timezone.utc)
        payload = build_txn(outlet, ts)
        ok_, status, body = send(payload, dev_mode)
        ts_str = datetime.now().strftime("%H:%M:%S")

        if ok_:
            ok += 1
            try:
                resp = json.loads(body)
                txn = resp.get("data", {}).get("transaction_id", "?")
                amt = payload["amount"]
                cur = payload["currency"]
                print(f"[{ts_str}] {outlet['code']} [{cur} {amt:.2f}] ✅ OK={ok} FAIL={fail}")
            except Exception:
                print(f"[{ts_str}] {outlet['code']} ✅ OK={ok} FAIL={fail}")
        else:
            fail += 1
            print(f"[{ts_str}] {outlet['code']} ❌ {status}: {body[:80]} OK={ok} FAIL={fail}")

        time.sleep(interval)

def run_batch(count: int, outlet_ids: list, dev_mode: bool):
    """Fire N transactions then stop."""
    outlets = [o for o in OUTLETS if not outlet_ids or o["id"] in outlet_ids]
    print(f"\n{'='*60}")
    print(f"  BATCH | {count} txns | {len(outlets)} outlets")
    print(f"{'='*60}")

    ok, fail = 0, 0
    for i in range(count):
        outlet = random.choice(outlets)
        ts = datetime.now(timezone.utc)
        payload = build_txn(outlet, ts)
        ok_, status, body = send(payload, dev_mode)
        if ok_: ok += 1
        else: fail += 1
        if (i+1) % 20 == 0:
            print(f"  {i+1}/{count}  OK={ok}  FAIL={fail}")
    print(f"\nDone: {ok} OK  {fail} FAIL")

def run_day_simulation(date_str: str, dev_mode: bool):
    """Simulate full business day (7am-10pm) for all outlets."""
    target = datetime.strptime(date_str, "%Y-%m-%d")
    PEAK_HOURS  = list(range(11, 15)) + list(range(18, 22))
    QUIET_HOURS = list(range(7, 11)) + list(range(15, 18))

    print(f"\n{'='*60}")
    print(f"  DAY SIM | {date_str} | {len(OUTLETS)} outlets")
    print(f"{'='*60}")

    total_ok, total_fail = 0, 0
    for outlet in OUTLETS:
        ok_c, fail_c = 0, 0
        for h in PEAK_HOURS:
            n = random.randint(8, 14)
            for _ in range(n):
                ts = target.replace(hour=h, minute=random.randint(0,59), second=random.randint(0,59), tzinfo=timezone.utc)
                payload = build_txn(outlet, ts)
                ok_, _, _ = send(payload, dev_mode)
                if ok_: ok_c += 1
                else: fail_c += 1
        for h in QUIET_HOURS:
            n = random.randint(2, 6)
            for _ in range(n):
                ts = target.replace(hour=h, minute=random.randint(0,59), second=random.randint(0,59), tzinfo=timezone.utc)
                payload = build_txn(outlet, ts)
                ok_, _, _ = send(payload, dev_mode)
                if ok_: ok_c += 1
                else: fail_c += 1
        cur = outlet["currency"]
        print(f"  {outlet['code']:15} [{cur}] {ok_c} txns  fail={fail_c}")
        total_ok += ok_c; total_fail += fail_c
    print(f"\nTotal: {total_ok} OK  {total_fail} FAIL")

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not ANON_KEY:
        print("ERROR: Could not load ANON_KEY from .env.local")
        print("  Set VITE_SUPABASE_ANON_KEY in .env.local")
        sys.exit(1)

    p = argparse.ArgumentParser(description="CQaiFranchise POS Simulator — Fixed v2")
    p.add_argument("--dev",      action="store_true", help="Dev bypass (skip HMAC)")
    p.add_argument("--secret",   default="",          help="HMAC secret (production)")
    p.add_argument("--outlet",   type=int, nargs="+", help="Specific outlet ID(s)")
    p.add_argument("--interval", type=int, default=10, help="Seconds between txns (default: 10)")
    p.add_argument("--count",    type=int, default=0,  help="Send N txns then stop (0=loop)")
    p.add_argument("--day",      metavar="YYYY-MM-DD", help="Simulate full business day")
    p.add_argument("--dry-run",  action="store_true", help="Print payload without sending")
    args = p.parse_args()

    dev_mode = args.dev
    outlet_ids = args.outlet or []

    mode = "DEV BYPASS" if dev_mode else "PRODUCTION HMAC"
    print("""\n╔══════════════════════════════════════════════════════════╗\n║        🚀 CQaiFranchise POS SIMULATOR — Fixed v2       ║\n╠══════════════════════════════════════════════════════════╣\n║  Webhook : %s\n║  Mode    : %s\n║  Outlet  : %s\n║  Interval: %ds\n║  Count   : %s\n╚══════════════════════════════════════════════════════════╝\n    """ % (
    WEBHOOK_URL if WEBHOOK_URL else "(no URL)",
    mode,
    str(outlet_ids) if outlet_ids else "ALL",
    args.interval,
    "∞ (loop)" if args.count == 0 else str(args.count)
    ))

    if args.dry_run:
        outlet = OUTLETS[0]
        payload = build_txn(outlet, datetime.now(timezone.utc))
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return

    if args.day:
        run_day_simulation(args.day, dev_mode)
    elif args.count > 0:
        run_batch(args.count, outlet_ids, dev_mode)
    else:
        run_loop(outlet_ids, dev_mode, args.interval)

if __name__ == "__main__":
    main()
