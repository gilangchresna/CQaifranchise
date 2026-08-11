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

print("=== CASES TABLE (5 sample) ===")
try:
    data = get(f"{base}/rest/v1/cases?select=id,status,priority,title,created_at&order=created_at.desc&limit=5")
    print(f"Count: {len(data)}")
    for c in data:
        print(f"  id={c.get('id')} status={c.get('status')} pri={c.get('priority')} title={c.get('title')}")
except Exception as e:
    print(f"Error: {e}")

print()
print("=== TOTAL CASES ===")
try:
    req = urllib.request.Request(f"{base}/rest/v1/cases?select=id&limit=1")
    req.add_header("apikey", ANON)
    req.add_header("Authorization", f"Bearer {ANON}")
    req.add_header("Prefer", "count=exact")
    with urllib.request.urlopen(req, timeout=10) as r:
        raw = r.read().decode()
        print(f"Raw: {raw}")
except Exception as e:
    print(f"Error: {e}")
