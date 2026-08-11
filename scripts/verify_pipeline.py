#!/usr/bin/env python3
import urllib.request, json

env = {}
for line in open("/Users/ / Web/CQaiFrh/CQaifranchise/.env.local"):
    line = line.strip()
    if "=" in line:
        parts = line.split("=", 1)
        if len(parts) == 2:
            env[parts[0].strip()] = parts[1].strip().strip('"').strip("'")

svc = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
base = "https://ploqeifazcgzwjzmukgp.supabase.co"

# Check tables
for tbl in ["ml_anomaly_scores", "ml_stockout_risk"]:
    url = f"{base}/rest/v1/{tbl}?select=id&limit=1"
    req = urllib.request.Request(url)
    req.add_header("apikey", svc)
    req.add_header("Authorization", f"Bearer {svc}")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            print(f"  {tbl}: EXISTS")
    except Exception as e:
        print(f"  {tbl}: MISSING ({e})")

# Test pipeline
url2 = f"{base}/functions/v1/coordinator-pipeline"
req2 = urllib.request.Request(url2, data=b"{}", headers={"Content-Type": "application/json", "apikey": svc, "Authorization": f"Bearer {svc}"})
try:
    with urllib.request.urlopen(req2, timeout=20) as r:
        result = json.loads(r.read())
        print(f"\nPipeline result:")
        print(json.dumps(result, indent=2))
except Exception as e:
    print(f"Pipeline error: {e}")
