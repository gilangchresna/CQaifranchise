#!/usr/bin/env python3
import urllib.request, json

env = {}
for line in open("/Users/ / Web/CQaiFrh/CQaifranchise/.env.local"):
    line = line.strip()
    if "=" in line:
        parts = line.split("=", 1)
        if len(parts) == 2:
            env[parts[0].strip()] = parts[1].strip().strip('"').strip("'")

ANON = env.get("VITE_SUPABASE_ANON_KEY", "")
base = "https://ploqeifazcgzwjzmukgp.supabase.co"

def get(url):
    req = urllib.request.Request(url)
    req.add_header("apikey", ANON)
    req.add_header("Authorization", f"Bearer {ANON}")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())

# All tx for Aug 10
print("=== ALL TX 2026-08-10 ===")
url = f'{base}/rest/v1/sales_transactions?date=eq.2026-08-10&select=date,amount,outlet_id,transaction_id&order=date.desc'
data = get(url)
print(f"Total tx Aug 10: {len(data)}")
total = sum(float(d.get('amount', 0)) for d in data)
print(f"Total amount Aug 10: S${total:,.2f}")
for d in data:
    print(f"  outlet={d.get('outlet_id')} amount={d.get('amount')} txn={d.get('transaction_id')}")

print()

# All tx for Aug 9
print("=== ALL TX 2026-08-09 ===")
url2 = f'{base}/rest/v1/sales_transactions?date=eq.2026-08-09&select=date,amount,outlet_id,transaction_id'
data2 = get(url2)
print(f"Total tx Aug 9: {len(data2)}")
total9 = sum(float(d.get('amount', 0)) for d in data2)
print(f"Total amount Aug 9: S${total9:,.2f}")
for d in data2:
    print(f"  outlet={d.get('outlet_id')} amount={d.get('amount')} txn={d.get('transaction_id')}")

print()

# Date range - how many days have data?
print("=== DAYS WITH DATA ===")
url3 = f'{base}/rest/v1/sales_transactions?select=date&order=date.desc&limit=100'
data3 = get(url3)
from collections import Counter
days = Counter(d.get('date') for d in data3)
for day, cnt in sorted(days.items(), reverse=True):
    print(f"  {day}: {cnt} txns")

print()

# outlets table
print("=== OUTLETS ===")
url4 = f'{base}/rest/v1/outlets?select=id,name,code,region&order=id'
data4 = get(url4)
for o in data4:
    print(f"  {o.get('id')} | {o.get('region'):15s} | {o.get('code')} | {o.get('name')}")
