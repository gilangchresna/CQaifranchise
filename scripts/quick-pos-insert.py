#!/usr/bin/env python3
"""
Quick POS Data Insert for Demo
Uses pos-bulk-insert (no HMAC required)
"""
import json
import random
import urllib.request
from datetime import datetime, timezone

# Config
SUPABASE_URL = "https://ploqeifazcgzwjzmukgp.supabase.co"
BULK_INSERT_URL = f"{SUPABASE_URL}/functions/v1/pos-bulk-insert"

# Load anon key
with open('.env.local') as f:
    for line in f:
        if 'SUPABASE_ANON_KEY' in line or 'VITE_SUPABASE_ANON_KEY' in line:
            ANON_KEY = line.strip().split('=', 1)[1].strip().strip('"').strip("'")
            break

# Singapore outlets
SG_OUTLETS = [1, 2, 3, 164, 165, 166, 167, 168, 169, 170]

# Menu items (SGD)
MENU_SGD = [
    {"name": "Nasi Goreng", "price": 18},
    {"name": "Ayam Geprek Matah", "price": 15},
    {"name": "Mie Goreng Jawa", "price": 14},
    {"name": "Kopi O / Teh O", "price": 5},
    {"name": "Ayam Rice", "price": 22},
    {"name": "Soto Ayam", "price": 16},
    {"name": "Laksa", "price": 15},
    {"name": "Roti Prata + Curry", "price": 12},
    {"name": "Kopi C Siew Dai", "price": 6},
    {"name": "Bakso", "price": 15},
]

def build_txn(outlet_id, ts):
    """Build realistic transaction"""
    items = random.sample(MENU_SGD, k=random.randint(1, 3))
    subtotal = sum(i["price"] for i in items)
    tax = round(subtotal * 0.11)  # PPN 11%
    amount = subtotal + tax
    
    return {
        "transaction_id": f"TXN-{outlet_id}-{ts.strftime('%Y%m%d%H%M%S')}-{random.randint(1000,9999)}",
        "outlet_id": outlet_id,
        "date": ts.isoformat(),
        "amount": amount,
        "currency_code": "SGD",
        "transaction_count": random.randint(1, 3),
    }

def send_batch(transactions):
    """Send batch to pos-bulk-insert"""
    body = json.dumps({"transactions": transactions}).encode()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ANON_KEY}",
    }
    req = urllib.request.Request(BULK_INSERT_URL, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return True, json.loads(resp.read())
    except Exception as e:
        return False, str(e)

def main():
    print("🚀 Quick POS Data Insert for Demo")
    print("=" * 50)
    
    # Generate 50 transactions per outlet (500 total)
    all_txns = []
    now = datetime.now(timezone.utc)
    
    for outlet_id in SG_OUTLETS:
        for i in range(50):
            # Random time in last 7 days
            days_ago = random.randint(0, 6)
            hours = random.randint(7, 21)
            minutes = random.randint(0, 59)
            ts = now.replace(hour=hours, minute=minutes, second=0) - __import__('datetime').timedelta(days=days_ago)
            all_txns.append(build_txn(outlet_id, ts))
    
    print(f"Generated {len(all_txns)} transactions")
    
    # Send in batches of 50
    batch_size = 50
    total_inserted = 0
    
    for i in range(0, len(all_txns), batch_size):
        batch = all_txns[i:i+batch_size]
        success, result = send_batch(batch)
        if success:
            total_inserted += len(batch)
            print(f"✅ Batch {i//batch_size + 1}: {len(batch)} inserted")
        else:
            print(f"❌ Batch {i//batch_size + 1}: {result}")
    
    print(f"\n🎉 Total inserted: {total_inserted}/{len(all_txns)}")

if __name__ == "__main__":
    main()
