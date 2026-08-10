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

url = f"{base}/functions/v1/agent-status"
req = urllib.request.Request(url, data=b"{}", headers={
    "Content-Type": "application/json",
    "apikey": svc,
    "Authorization": f"Bearer {svc}"
})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        result = json.loads(r.read().decode())
        print(f"agent-status: success={result.get('success')}")
        print(f"  agents: {len(result.get('agents', []))}")
        for a in result.get('agents', [])[:3]:
            print(f"    {a.get('agent_id')}: {a.get('name')} = {a.get('status')}")
        print(f"  summary: {result.get('summary')}")
except Exception as e:
    print(f"Error: {e}")

print()
# Also check tables
url2 = f"{base}/rest/v1/agent_tasks?select=id,agent_id,status&limit=3"
req2 = urllib.request.Request(url2)
req2.add_header("apikey", svc)
req2.add_header("Authorization", f"Bearer {svc}")
try:
    with urllib.request.urlopen(req2, timeout=10) as r:
        data = json.loads(r.read().decode())
        print(f"agent_tasks: {len(data)} rows")
        for t in data[:3]:
            print(f"  {t}")
except Exception as e:
    print(f"agent_tasks: {e}")
