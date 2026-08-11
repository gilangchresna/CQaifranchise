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
svc = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
base = "https://ploqeifazcgzwjzmukgp.supabase.co"

# Test cases-list edge fn directly (service role bypass)
url = f"{base}/functions/v1/cases-list"
data = json.dumps({}).encode()
req = urllib.request.Request(url, data=data, headers={
    "Content-Type": "application/json",
    "apikey": svc,
    "Authorization": f"Bearer {svc}"
})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        result = json.loads(r.read().decode())
        cases = result.get("cases", [])
        print(f"cases-list edge fn: {len(cases)} cases")
        for c in cases[:3]:
            print(f"  id={c.get('id')} status={c.get('status')} title={c.get('title')[:50]}")
except Exception as e:
    print(f"Error: {e}")

# Also test alerts-list
print()
url2 = f"{base}/functions/v1/alerts-list"
req2 = urllib.request.Request(url2, data=data, headers={
    "Content-Type": "application/json",
    "apikey": svc,
    "Authorization": f"Bearer {svc}"
})
try:
    with urllib.request.urlopen(req2, timeout=15) as r:
        result2 = json.loads(r.read().decode())
        alerts = result2.get("data", [])
        print(f"alerts-list edge fn: {len(alerts)} alerts")
except Exception as e:
    print(f"alerts-list Error: {e}")
