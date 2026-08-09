#!/usr/bin/env python3
"""CQaiFranchise POS Simulator — local laptop → L1 webhook ingestion."""
import argparse, hashlib, hmac, json, os, random, sys, time, urllib.request, urllib.error, uuid
from datetime import datetime

MENU = [
    {"name": "Nasi Goreng", "price": 25000},
    {"name": "Ayam Geprek Sambal", "price": 22000},
    {"name": "Mie Goreng Jawa", "price": 18000},
    {"name": "Es Teh Manis", "price": 5000},
    {"name": "Es Jeruk Peras", "price": 7000},
]

PAYMENT_METHODS = ["cash", "qris", "gofood", "grabfood", "dine_in"]
PLATFORMS = ["dine_in", "gofood", "grabfood", "takeaway"]

def sign_payload(payload_str, secret):
    return hmac.new(secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()

def build_txn(outlet_id, platform):
    items = random.sample(MENU, k=random.randint(1, 3))
    subtotal = sum(i["price"] for i in items)
    tax = round(subtotal * 0.11)
    total = subtotal + tax
    txn_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
    return {
        "transaction_id": txn_id,
        "outlet_id": outlet_id,
        "date": datetime.utcnow().isoformat(),
        "amount": total,
        "payment_method": random.choice(PAYMENT_METHODS),
        "platform": platform,
        "customer_id": f"CUST-{random.randint(100,999)}",
        "items": [{"name": i["name"], "price": i["price"]} for i in items],
        "subtotal": subtotal,
        "tax_amount": tax,
        "discount": 0,
    }

def send(url, secret, outlet_id, platform):
    payload = build_txn(outlet_id, platform)
    body = json.dumps(payload, ensure_ascii=False)
    sig = sign_payload(body, secret)
    req = urllib.request.Request(
        url, data=body.encode(),
        headers={"Content-Type": "application/json", "x-pos-signature": sig},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return True, r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return False, e.code, e.read().decode()
    except Exception as exc:
        return False, 0, str(exc)

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="CQaiFranchise POS simulator")
    BASE = "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/pos-webhook"
    p.add_argument("--url", default=BASE)
    p.add_argument("--secret", default=os.environ.get("POS_WEBHOOK_SECRET", ""))
    p.add_argument("--outlet", type=int, default=1)
    p.add_argument("--platform", default="dine_in")
    p.add_argument("--interval", type=int, default=5)
    p.add_argument("--count", type=int, default=0)
    args = p.parse_args()

    if not args.secret:
        print("ERROR: --secret required (set POS_WEBHOOK_SECRET env var)")
        sys.exit(1)

    print(f"\nPOS Simulator -> L1 webhook\nURL: {args.url}\nOutlet: {args.outlet}\nPlatform: {args.platform}\nInterval: {args.interval}s\n")
    n = 0
    while True:
        n += 1
        ok, code, body = send(args.url, args.secret, args.outlet, args.platform)
        ts = datetime.now().strftime("%H:%M:%S")
        if ok:
            try:
                data = json.loads(body)
                txn_id = (data.get("data") or {}).get("transaction_id", "?")
            except Exception:
                txn_id = "?"
            print(f"[{ts}] TXN {n:04d} OK {code} | {txn_id}")
        else:
            print(f"[{ts}] TXN {n:04d} ERR {code}: {body[:120]}")

        if args.count > 0 and n >= args.count:
            break
        time.sleep(args.interval)
