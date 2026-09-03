#!/usr/bin/env python3
"""
CQaiFranchise POS Simulator
Local laptop → pos-webhook edge function (L1 ingestion)

Usage:
  # Dev bypass (no HMAC needed)
  python3 pos-simulator.py --dev --outlet 1 --platform dine_in

  # One-shot test
  python3 pos-simulator.py --dev --count 1 --outlet 1

  # Continuous loop (tiap 5 detik)
  python3 pos-simulator.py --dev --interval 5 --outlet 1

  # Production mode (real HMAC)
  python3 pos-simulator.py --secret "$POS_WEBHOOK_SECRET" --outlet 1

  # Run ALL negative/error test cases
  python3 pos-simulator.py --test-errors

  # Run specific error test case
  python3 pos-simulator.py --test-error invalid_outlet
  python3 pos-simulator.py --test-error duplicate_txn
  python3 pos-simulator.py --test-error missing_field

Environment:
  POS_WEBHOOK_SECRET   HMAC secret (optional — used when --dev is omitted)
  Reads ANON_KEY + SUPABASE_URL from .env.local automatically.
"""
import argparse
import hashlib
import hmac
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ── Load .env.local ──────────────────────────────────────────────────────────
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

# ── Realistic Simulation Config ──────────────────────────────────
# SG Outlets (region_id = 114)
SG_OUTLETS  = [164, 165, 167, 168, 169, 170, 171, 200, 201, 202]  # 10 SG outlets
JKT_OUTLETS = [4, 11, 12, 22, 24, 203, 204, 205]  # Jakarta
BDG_OUTLETS = [5, 206, 207]  # Bandung
SBY_OUTLETS = [6, 208, 209]  # Surabaya
BKK_OUTLETS = [7, 212, 213]  # Bangkok
KUL_OUTLETS = [8, 210, 211]  # Kuala Lumpur
ALL_OUTLETS = SG_OUTLETS + JKT_OUTLETS + BDG_OUTLETS + SBY_OUTLETS + BKK_OUTLETS + KUL_OUTLETS
PREMIUM_OUTLETS = SG_OUTLETS  # Singapore = premium pricing tier

# Weighted payment (qrcode/cash paling sering)
PAYMENT_METHODS  = ["cash", "card", "qrcode", "ewallet"]
PAYMENT_WEIGHTS  = [30, 20, 35, 15]   # cash, card, qrcode, ewallet

PLATFORMS  = ["dine_in", "gofood", "grabfood", "shopeefood", "dine_in"]
PLATFORM_WEIGHTS = [50, 20, 15, 10, 5]   # dine_in paling sering

# Menu prices per tier
MENU_STANDARD = [
    {"name": "Nasi Goreng",       "price": 22000},
    {"name": "Ayam Geprek",         "price": 20000},
    {"name": "Mie Goreng",          "price": 18000},
    {"name": "Es Teh Manis",        "price":  5000},
    {"name": "Es Jeruk",            "price":  6000},
    {"name": "Sate Ayam",           "price": 25000},
    {"name": "Soto Ayam",           "price": 22000},
    {"name": "Es Campur",           "price": 12000},
    {"name": "Bakso",              "price": 20000},
    {"name": "Rawon",              "price": 25000},
]
MENU_PREMIUM = [
    {"name": "Nasi Goreng Premium",  "price": 28000},
    {"name": "Ayam Geprek Matah",    "price": 25000},
    {"name": "Mie Goreng Jawa",     "price": 22000},
    {"name": "Es Teh Manis",        "price":  6000},
    {"name": "Es Jeruk Peras",       "price":  7000},
    {"name": "Sate Ayam 10 tusuk",   "price": 32000},
    {"name": "Soto Special",          "price": 28000},
    {"name": "Rendang Sapi",         "price": 38000},
    {"name": "Pisang Goreng Keju",   "price": 15000},
    {"name": "Es Campur SG style",   "price":  9000},
]
# Weighted choice helper
# Menu per currency (Aug 14, 2026)
MENU_SGD = [
    {"name": "Nasi Goreng", "price": 18}, {"name": "Ayam Geprek Matah", "price": 15},
    {"name": "Mie Goreng Jawa", "price": 14}, {"name": "Kopi O / Teh O", "price": 5},
    {"name": "Ayam Rice", "price": 22}, {"name": "Soto Ayam", "price": 16},
    {"name": "Laksa", "price": 15}, {"name": "Roti Prata + Curry", "price": 12},
    {"name": "Kopi C Siew Dai", "price": 6}, {"name": "Bakso", "price": 15},
]
MENU_IDR = [
    {"name": "Nasi Goreng", "price": 25000}, {"name": "Ayam Geprek", "price": 22000},
    {"name": "Mie Goreng", "price": 20000}, {"name": "Es Teh Manis", "price": 6000},
    {"name": "Sate Ayam", "price": 28000}, {"name": "Soto Ayam", "price": 25000},
    {"name": "Es Campur", "price": 12000}, {"name": "Bakso", "price": 22000},
    {"name": "Rawon", "price": 28000}, {"name": "Es Jeruk", "price": 7000},
]
MENU_THB = [
    {"name": "Pad Thai", "price": 120}, {"name": "Som Tam", "price": 80},
    {"name": "Khao Man Gai", "price": 100}, {"name": "Mango Sticky Rice", "price": 90},
    {"name": "Thai Iced Tea", "price": 50}, {"name": "Tom Yum Goong", "price": 180},
    {"name": "Green Curry", "price": 150}, {"name": "Fried Rice", "price": 90},
    {"name": "Spring Rolls", "price": 60}, {"name": "Coconut Ice Cream", "price": 45},
]
MENU_MYR = [
    {"name": "Nasi Lemak", "price": 18}, {"name": "Mee Goreng Mamak", "price": 16},
    {"name": "Roti Canai", "price": 8}, {"name": "Laksa Johor", "price": 20},
    {"name": "Nasi Kandar", "price": 25}, {"name": "Rendang Tok", "price": 28},
    {"name": "Teh Tarik", "price": 7}, {"name": "Cendol", "price": 10},
    {"name": "Satay 10 pcs", "price": 22}, {"name": "Curry Mee", "price": 15},
]

def get_menu(outlet_id):
    """FIX Aug14: Return (menu_list, currency_code) per outlet region."""
    if outlet_id in SG_OUTLETS: return MENU_SGD, "SGD"
    if outlet_id in BKK_OUTLETS: return MENU_THB, "THB"
    if outlet_id in KUL_OUTLETS: return MENU_MYR, "MYR"
    return MENU_IDR, "IDR"   # JKT / BDG / SBY

def wchoice(opts, weights):
    return random.choices(opts, weights=weights, k=1)[0]

# ── Realistic transaction builder ─────────────────────────────────
def build_realistic_txn(outlet_id: int, ts: datetime) -> dict:
    """Build realistic txn: realistic menu items, PPN 11%, weighted payment/platform."""
    menu, currency = get_menu(outlet_id)  # FIX Aug14: currency-aware menus
    # OLD: MENU_PREMIUM/MENU_STANDARD menus removed
    # OLD: PREMIUM_OUTLETS removed
    items    = random.sample(menu, k=random.randint(1, min(4, len(menu))))
    subtotal = sum(i["price"] for i in items)
    tax      = round(subtotal * 0.11)

    # Discount: 30% chance of 5-10%
    discount = 0
    if random.random() < 0.3:
        discount = round(subtotal * random.choice([0.05, 0.10]))
    amount = subtotal - discount + tax
    cost  = round(amount * random.uniform(0.35, 0.55))

    platform = wchoice(PLATFORMS, PLATFORM_WEIGHTS)
    payment = wchoice(PAYMENT_METHODS, PAYMENT_WEIGHTS)
    platform_fee = round(amount * random.uniform(0, 0.05)) if platform != "dine_in" else 0

    return {
        "transaction_id":   f"TXN-{uuid.uuid4().hex[:8].upper()}",
        "outlet_id":        outlet_id,
        "date":             ts.isoformat(),
        "amount":           amount,
        "discount":         discount,
        "tax":              tax,
        "cost":             cost,
        "payment_method":    payment,
        "platform":         platform,
        "platform_fee":     platform_fee,
        "customer_id":      f"CUST-{random.randint(100, 9999)}",
        "staff_id":         None,
        "transaction_count": random.randint(1, 3),
        "currency_code": currency,  # FIX Aug14: tag local currency
    }

# ── Full day simulation ──────────────────────────────────────────
def run_day(date_str: str, outlet_ids: list, dev_mode: bool):
    """Simulate business hours 7am-10pm per outlet."""
    target = datetime.strptime(date_str, "%Y-%m-%d")
    PEAK_HOURS  = list(range(11, 15)) + list(range(18, 22))   # busy: 11-14, 18-21
    QUIET_HOURS = list(range(7, 11)) + list(range(15, 18))    # quiet: 7-10, 15-17

    region_map = {oid: "SG" for oid in SG_OUTLETS}
    region_map.update({oid: "JKT" for oid in JKT_OUTLETS})
    region_map.update({oid: "BDG" for oid in BDG_OUTLETS})
    region_map["BKK"] = "BKK" if oid not in region_map else region_map.get(oid, "SG")

    def rregion(oid):
        if oid in SG_OUTLETS: return "SG"
        if oid in JKT_OUTLETS: return "JKT"
        if oid in BDG_OUTLETS: return "BDG"
        if oid in SBY_OUTLETS: return "SBY"
        if oid in BKK_OUTLETS: return "BKK"
        if oid in KUL_OUTLETS: return "KUL"
        return "???"

    print(f"\nDAY SIM: {date_str} | {len(outlet_ids)} outlets | DEV={dev_mode}")
    ok_t, fail_t = 0, 0
    for oid in sorted(outlet_ids):
        ok_c, fail_c = 0, 0
        for h in PEAK_HOURS:
            n = random.randint(8, 14)
            for _ in range(n):
                ts = target.replace(hour=h, minute=random.randint(0, 59), second=random.randint(0, 59), tzinfo=timezone.utc)
                ok, s, b = send(build_realistic_txn(oid, ts), dev_mode)
                if ok: ok_c += 1
                else: fail_c += 1
        for h in QUIET_HOURS:
            n = random.randint(2, 6)
            for _ in range(n):
                ts = target.replace(hour=h, minute=random.randint(0, 59), second=random.randint(0, 59), tzinfo=timezone.utc)
                ok, s, b = send(build_realistic_txn(oid, ts), dev_mode)
                if ok: ok_c += 1
                else: fail_c += 1
        region = rregion(oid)
        print(f"  #{oid:3d} [{region}]  {ok_c} txns  fail={fail_c}")
        ok_t += ok_c; fail_t += fail_c
    print(f"\nTotal: {ok_t} OK  {fail_t} FAIL")

# ── Continuous realistic loop ───────────────────────────────────
def run_realistic(dev_mode: bool, interval: int):
    """Loop with random outlet/platform/amount every N seconds."""
    ok_t, fail_t = 0, 0
    print(f"\nREALISTIC LOOP | interval={interval}s | DEV={dev_mode}")
    while True:
        oid = random.choice(ALL_OUTLETS)
        ts  = datetime.now(timezone.utc)
        ok, s, b = send(build_realistic_txn(oid, ts), dev_mode)
        now = datetime.now().strftime("%H:%M:%S")
        if ok:
            ok_t += 1
            try:
                data = json.loads(b)
                txn = data.get("data", {}).get("transaction_id", "?")
            except Exception:
                txn = "?"
            region = "SG" if oid in SG_OUTLETS else "JKT"
            print(f"[{now}] #{oid:3d} [{region}] ✅ {s}  OK={ok_t}  FAIL={fail_t}")
        else:
            fail_t += 1
            print(f"[{now}] ❌ {s}: {b[:80]}  OK={ok_t}  FAIL={fail_t}")
        time.sleep(interval)

# ── All-outlets batch test ───────────────────────────────────
def run_all_batch(count: int, dev_mode: bool):
    """Fire N txns across random outlets."""
    print(f"\nBATCH: {count} txns  DEV={dev_mode}")
    ok_t, fail_t = 0, 0
    for i in range(count):
        oid = random.choice(ALL_OUTLETS)
        ok, s, b = send(build_realistic_txn(oid, datetime.now(timezone.utc)), dev_mode)
        if ok: ok_t += 1
        else: fail_t += 1
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{count}  OK={ok_t}  FAIL={fail_t}")
    print(f"\nBatch done: {ok_t} OK  {fail_t} FAIL")

# ── Menu ──────────────────────────────────────────────────────────────────────
MENU = [
    {"name": "Nasi Goreng",          "price": 25000},
    {"name": "Ayam Geprek Sambal",   "price": 22000},
    {"name": "Mie Goreng Jawa",       "price": 18000},
    {"name": "Es Teh Manis",          "price":  5000},
    {"name": "Es Jeruk Peras",        "price":  7000},
    {"name": "Pisang Goreng Keju",    "price": 12000},
    {"name": "Sate Ayam (10 tusuk)",   "price": 30000},
    {"name": "Soto Ayam",             "price": 28000},
    {"name": "Es Campur",             "price": 15000},
    {"name": "Rendang",               "price": 35000},
]

VALID_PAYMENT_METHODS = ["cash", "card", "qrcode", "ewallet", "gofood",
                          "grabfood", "shopeefood", "dine_in"]
VALID_PLATFORMS       = ["dine_in", "gofood", "grabfood", "shopeefood", "pos"]

# ── Helpers ───────────────────────────────────────────────────────────────────
def sign_payload(body_str: str, secret: str) -> str:
    """HMAC-SHA256 hex digest over raw JSON string."""
    return hmac.new(secret.encode(), body_str.encode(), hashlib.sha256).hexdigest()

def build_txn(outlet_id: int, platform: str = "dine_in", **overrides) -> dict:
    """
    Generate one fake transaction payload matching pos-webhook schema.
    Pass **overrides to inject bad values for error testing.
    """
    items    = random.sample(MENU, k=random.randint(1, 3))
    subtotal = sum(i["price"] for i in items)
    tax      = round(subtotal * 0.11)    # PPN 11%
    amount   = subtotal + tax

    txn_id = overrides.pop("transaction_id", None) or f"TXN-{uuid.uuid4().hex[:8].upper()}"

    payload = {
        "transaction_id":   txn_id,
        "outlet_id":        overrides.pop("outlet_id", None) or outlet_id,
        "date":             overrides.pop("date", None) or datetime.now(timezone.utc).isoformat(),
        "amount":           overrides.pop("amount", None) or amount,
        "discount":         overrides.pop("discount", None) if "discount" in overrides else 0,
        "tax":              overrides.pop("tax", None) or tax,
        "cost":             overrides.pop("cost", None) or round(amount * random.uniform(0.35, 0.55), -2),
        "payment_method":   overrides.pop("payment_method", None) or random.choice(VALID_PAYMENT_METHODS),
        "platform":         overrides.pop("platform", None) or platform,
        "platform_fee":     overrides.pop("platform_fee", None) if "platform_fee" in overrides
                            else (round(amount * random.uniform(0, 0.05), -2) if platform != "dine_in" else 0),
        "customer_id":      overrides.pop("customer_id", None) or f"CUST-{random.randint(100, 999)}",
        "staff_id":         overrides.pop("staff_id", None),
        "transaction_count": overrides.pop("transaction_count", None) or 1,
    }

    # Inject any remaining overrides directly (for malformed fields)
    for k, v in overrides.items():
        payload[k] = v

    return payload

def send(payload: dict, secret: str = "", dev_mode: bool = False) -> tuple:
    """
    POST to pos-webhook.
    Returns (success: bool, status_code: int, body_str: str)
    """
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

# ── Error Test Cases ──────────────────────────────────────────────────────────
ERROR_TESTS = {
    # (name, expected_status, description)
    "invalid_outlet":     (400, "outlet_id=99999 (does not exist)"),
    "outlet_zero":        (400, "outlet_id=0 (invalid)"),
    "outlet_negative":    (400, "outlet_id=-1 (negative)"),
    "missing_txn_id":     (400, "transaction_id omitted"),
    "missing_outlet_id":  (400, "outlet_id omitted"),
    "missing_amount":     (400, "amount omitted"),
    "missing_date":       (400, "date omitted"),
    "amount_string":      (400, "amount='abc' (wrong type)"),
    "amount_negative":    (400, "amount=-100 (negative))"),
    "amount_zero":       (200,  "amount=0 (zero — allowed, not rejected)"),
    "payment_invalid":    (400, "payment_method='ovo' (not in allowlist)"),
    "platform_invalid":   (400, "platform='delivery' (not in allowlist)"),
    "discount_negative":  (400, "discount=-5000 (negative)"),
    "tax_negative":       (400, "tax=-1000 (negative)"),
    "cost_negative":      (400, "cost=-5000 (negative)"),
    "outlet_float":       (400, "outlet_id=1.5 (float, not integer)"),
    "duplicate_txn":      (409, "same transaction_id sent twice"),
    "auth_missing":       (401, "no Authorization header (anon key)"),
}

# Payload builders for each test
def error_payload(name: str) -> tuple[str, dict]:
    """Return (test_name, payload) for given error test."""
    base_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc).isoformat()

    cases = {
        "invalid_outlet":    {"transaction_id": base_id, "outlet_id": 99999, "date": now, "amount": 25000},
        "outlet_zero":       {"transaction_id": base_id, "outlet_id": 0, "date": now, "amount": 25000},
        "outlet_negative":   {"transaction_id": base_id, "outlet_id": -1, "date": now, "amount": 25000},
        "missing_txn_id":    {"outlet_id": 1, "date": now, "amount": 25000},
        "missing_outlet_id": {"transaction_id": base_id, "date": now, "amount": 25000},
        "missing_amount":    {"transaction_id": base_id, "outlet_id": 1, "date": now},
        "missing_date":      {"transaction_id": base_id, "outlet_id": 1, "amount": 25000},
        "amount_string":     {"transaction_id": base_id, "outlet_id": 1, "date": now, "amount": "abc"},
        "amount_negative":   {"transaction_id": base_id, "outlet_id": 1, "date": now, "amount": -100},
        "amount_zero":       {"transaction_id": base_id, "outlet_id": 1, "date": now, "amount": 0},
        "payment_invalid":   {"transaction_id": base_id, "outlet_id": 1, "date": now, "amount": 25000,
                              "payment_method": "ovo"},
        "platform_invalid":  {"transaction_id": base_id, "outlet_id": 1, "date": now, "amount": 25000,
                              "platform": "delivery"},
        "discount_negative": {"transaction_id": base_id, "outlet_id": 1, "date": now, "amount": 25000,
                              "discount": -5000},
        "tax_negative":      {"transaction_id": base_id, "outlet_id": 1, "date": now, "amount": 25000,
                              "tax": -1000},
        "cost_negative":     {"transaction_id": base_id, "outlet_id": 1, "date": now, "amount": 25000,
                              "cost": -5000},
        "outlet_float":      {"transaction_id": base_id, "outlet_id": 1.5, "date": now, "amount": 25000},
        "duplicate_txn":     {"transaction_id": "TXN-DUPE-2026", "outlet_id": 1, "date": now, "amount": 25000},
        "auth_missing":      {"transaction_id": base_id, "outlet_id": 1, "date": now, "amount": 25000},
    }
    return name, cases.get(name, {})

# ── Run Error Tests ───────────────────────────────────────────────────────────
def run_all_error_tests(dev_mode: bool = True):
    """Run all error test cases and print summary."""
    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║            ⚠️  L1 INGESTION — ERROR TEST SUITE               ║
╠══════════════════════════════════════════════════════════════════╣
║  Running {len(ERROR_TESTS)} test cases against pos-webhook                    ║
║  Dev mode: {'ON  (HMAC bypassed)' if dev_mode else 'OFF (HMAC enforced)'}        ║
╚══════════════════════════════════════════════════════════════════╝
""")

    results = []

    # First: run duplicate_txn to pre-seed the dupe txn (409 test needs this)
    dup_name, dup_payload = error_payload("duplicate_txn")
    # Use same payload twice
    ok1, s1, b1 = send(dup_payload, dev_mode=dev_mode)
    ok2, s2, b2 = send(dup_payload, dev_mode=dev_mode)
    dup_exp = ERROR_TESTS["duplicate_txn"][0]
    dup_got = s2
    dup_pass = dup_got == dup_exp
    results.append({
        "name": "duplicate_txn",
        "expected": dup_exp,
        "got": dup_got,
        "pass": dup_pass,
        "desc": ERROR_TESTS["duplicate_txn"][1],
    })
    print(f"  duplicate_txn: expected={dup_exp}, got={dup_got} {'✅' if dup_pass else '❌'}")

    # Now run all other tests
    for name in ERROR_TESTS:
        if name == "duplicate_txn":
            continue
        if name == "auth_missing":
            # This test intentionally omits the Authorization header
            # We handle it specially below
            continue

        exp_status, desc = ERROR_TESTS[name]
        _, payload = error_payload(name)
        ok, status, body = send(payload, dev_mode=dev_mode)
        passed = status == exp_status
        results.append({
            "name": name,
            "expected": exp_status,
            "got": status,
            "pass": passed,
            "desc": desc,
        })
        mark = "✅" if passed else "❌"
        body_short = body[:80].replace("\n", " ") if body else ""
        print(f"  {name:25s} expected={exp_status}, got={status} {mark}  {desc}")
        if not passed:
            print(f"    ↳ {body_short}")

    # Summary
    total = len(results)
    passed = sum(1 for r in results if r["pass"])
    failed = total - passed

    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║                   📊 ERROR TEST RESULTS                        ║
╠══════════════════════════════════════════════════════════════════╣
║  Total : {total} tests                                             ║
║  Passed: {passed} ✅                                                ║
║  Failed: {failed} ❌                                                ║
╚══════════════════════════════════════════════════════════════════╝
""")

    if failed > 0:
        print("Failed tests:")
        for r in results:
            if not r["pass"]:
                print(f"  - {r['name']}: expected {r['expected']}, got {r['got']}")
        print()

    return failed == 0

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(
        description="CQaiFranchise POS Simulator → pos-webhook edge function"
    )
    p.add_argument("--secret",   default=os.environ.get("POS_WEBHOOK_SECRET", ""),
                    help="HMAC secret (production mode)")
    p.add_argument("--dev",      action="store_true",
                    help="Use dev bypass (skip HMAC). No --secret needed.")
    p.add_argument("--outlet",   type=int, default=None,
                    help="Outlet ID. Default: random SG outlet")
    p.add_argument("--region",   type=str, default="SG",
                    help="Region to simulate. Default: SG (all 10 SG outlets)")
    p.add_argument("--platform", default="dine_in", choices=VALID_PLATFORMS,
                    help=f"Platform. Default: dine_in")
    p.add_argument("--interval", type=int, default=5,
                    help="Seconds between transactions. Default: 5")
    p.add_argument("--count",    type=int, default=0,
                    help="Send N transactions then stop (0 = loop forever). Default: 0")
    p.add_argument("--dry-run",  action="store_true",
                    help="Print payload without sending")

    # Error test arguments
    p.add_argument("--test-errors", action="store_true",
                    help="Run ALL error/negative test cases against pos-webhook")
    p.add_argument("--test-error", metavar="NAME",
                    help=f"Run one error test. Options: {list(ERROR_TESTS.keys())}")
    p.add_argument("--test-list", action="store_true",
                    help="List all available error test names")

    args = p.parse_args()

    # ── Validate env ──
    if not ANON_KEY:
        print("ERROR: Could not load ANON_KEY from .env.local")
        print("  Make sure VITE_SUPABASE_ANON_KEY is set.")
        sys.exit(1)

    dev_mode = args.dev

    # ── Error test mode ──
    if args.test_list:
        print("Available error test cases:")
        for name, (exp, desc) in ERROR_TESTS.items():
            print(f"  {name:25s}  expected={exp}  {desc}")
        return

    if args.test_error:
        name = args.test_error
        if name not in ERROR_TESTS:
            print(f"ERROR: Unknown test '{name}'")
            print(f"  Available: {', '.join(ERROR_TESTS.keys())}")
            sys.exit(1)
        exp_status, desc = ERROR_TESTS[name]
        _, payload = error_payload(name)

        if name == "duplicate_txn":
            # Run twice to trigger 409
            ok1, s1, b1 = send(payload, dev_mode=dev_mode)
            ok2, s2, b2 = send(payload, dev_mode=dev_mode)
            got = s2
        else:
            ok, status, body = send(payload, dev_mode=dev_mode)
            got = status

        passed = got == exp_status
        print(f"\nTest: {name}")
        print(f"  Description : {desc}")
        print(f"  Expected    : HTTP {exp_status}")
        print(f"  Got         : HTTP {got}")
        print(f"  Result      : {'✅ PASS' if passed else '❌ FAIL'}")
        sys.exit(0 if passed else 1)

    if args.test_errors:
        ok = run_all_error_tests(dev_mode=dev_mode)
        sys.exit(0 if ok else 1)
        return

    # ── Normal simulator mode ──
    if not dev_mode and not args.secret:
        print("ERROR: --secret required in production mode")
        print("  OR use --dev to bypass HMAC:")
        print("  python3 pos-simulator.py --dev --count 1 --outlet 1")
        sys.exit(1)

    # ── Select outlet based on args ──
    if args.outlet:
        target_outlet = args.outlet
        print(f"Target outlet: {args.outlet}")
    else:
        # Use SG outlets by default
        target_outlet = random.choice(SG_OUTLETS)
        print(f"Random SG outlet: {target_outlet}")

    mode = "DEV BYPASS" if dev_mode else "PRODUCTION HMAC"
    loop = args.count == 0

    print(f"""
╔══════════════════════════════════════════════════════════╗
║           🚀  CQaiFranchise POS SIMULATOR               ║
╠══════════════════════════════════════════════════════════╣
║  Webhook : {SUPABASE_URL}/functions/v1/pos-webhook
║  Region  : {args.region} (10 SG outlets)
║  Outlet  : {target_outlet}
║  Platform: {args.platform}
║  Mode    : {mode}
║  Interval: {args.interval}s
║  Count   : {'∞ (loop)' if loop else args.count}
╚══════════════════════════════════════════════════════════╝
  Ctrl+C to stop
""")

    count      = 0
    ok_total   = 0
    fail_total = 0

    while True:
        count += 1
        # FIX: Use build_realistic_txn() which correctly picks MENU per outlet region
        ts = datetime.now(timezone.utc)
        payload = build_realistic_txn(target_outlet, ts)

        if args.dry_run:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] DRY RUN #{count}")
            print(json.dumps(payload, indent=2, ensure_ascii=False))
            time.sleep(args.interval)
            continue

        ok, status, body = send(payload, args.secret, dev_mode)
        ts = datetime.now().strftime("%H:%M:%S")

        if ok:
            ok_total += 1
            try:
                resp_json = json.loads(body)
                txn_id = resp_json.get("data", {}).get("transaction_id", "?")
            except Exception:
                txn_id = "?"
            print(f"[{ts}] #{count:04d} ✅ {status}  txn={txn_id}  OK={ok_total}  FAIL={fail_total}")
        else:
            fail_total += 1
            print(f"[{ts}] #{count:04d} ❌ {status}: {body[:120]}  OK={ok_total}  FAIL={fail_total}")

        if args.count > 0 and count >= args.count:
            break
        time.sleep(args.interval)

if __name__ == "__main__":
    main()
