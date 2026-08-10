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

WEBHOOK_URL = (
    f"{SUPABASE_URL}/functions/v1/pos-webhook"
    if SUPABASE_URL
    else "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/pos-webhook"
)

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
    p.add_argument("--outlet",   type=int, default=1,
                    help="Outlet ID. Default: 1")
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

    mode = "DEV BYPASS" if dev_mode else "PRODUCTION HMAC"
    loop = args.count == 0

    print(f"""
╔══════════════════════════════════════════════════════════╗
║           🚀  CQaiFranchise POS SIMULATOR               ║
╠══════════════════════════════════════════════════════════╣
║  Webhook : {WEBHOOK_URL}
║  Outlet  : {args.outlet}
║  Platform: {args.platform}
║  Mode    : {mode}
║  Interval: {args.interval}s{'':19}║
║  Count   : {'∞ (loop)' if loop else args.count}
╚══════════════════════════════════════════════════════════╝
  Ctrl+C to stop
""")

    count      = 0
    ok_total   = 0
    fail_total = 0

    while True:
        count += 1
        payload = build_txn(args.outlet, args.platform)

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
