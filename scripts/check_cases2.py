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

# Check cases columns
print("=== CASES columns ===")
try:
    # Get one case with all columns
    data = get(f"{base}/rest/v1/cases?select=*&limit=1")
    if data:
        print(f"Columns: {list(data[0].keys()) if data else 'empty'}")
        print(f"Sample: {json.dumps(data[0], indent=2) if data else 'empty'}")
except Exception as e:
    print(f"Error: {e}")

print()
# Check without join
print("=== CASES direct (no join) ===")
try:
    data = get(f"{base}/rest/v1/cases?select=id,status,title,alert_id&order=created_at.desc&limit=5")
    print(f"Count: {len(data)}")
    for c in data:
        print(f"  id={c.get('id')} alert_id={c.get('alert_id')} status={c.get('status')} title={c.get('title')[:50]}")
except Exception as e:
    print(f"Error: {e}")
