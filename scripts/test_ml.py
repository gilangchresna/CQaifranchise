#!/usr/bin/env python3
import urllib.request, json

env = {}
for line in open("/Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise/.env.local"):
    line = line.strip()
    if "=" in line:
        parts = line.split("=", 1)
        if len(parts) == 2:
            env[parts[0].strip()] = parts[1].strip().strip('"').strip("'")

svc = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
base = "https://ploqeifazcgzwjzmukgp.supabase.co"

# Test ml-stockout-risk edge
url = f"{base}/functions/v1/ml-stockout-risk"
req = urllib.request.Request(url, data=b"{}", headers={
    "Content-Type": "application/json",
    "apikey": svc,
    "Authorization": f"Bearer {svc}"
})
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        result = json.loads(r.read().decode())
        print("=== ml-stockout-risk ===")
        print(json.dumps(result, indent=2)[:2000])
except Exception as e:
    print(f"Error: {e}")
