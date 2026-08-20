#!/usr/bin/env python3
"""
Use seed-sales edge function to populate data
"""
import json
import urllib.request

# Config
SUPABASE_URL = "https://ploqeifazcgzwjzmukgp.supabase.co"
SEED_URL = f"{SUPABASE_URL}/functions/v1/seed-sales"

# Load service role key
with open('.env.local') as f:
    for line in f:
        if 'SUPABASE_SERVICE_ROLE_KEY' in line:
            SR_KEY = line.strip().split('=', 1)[1].strip().strip('"').strip("'")
            break

print("🚀 Calling seed-sales edge function...")
print("=" * 50)

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {SR_KEY}",
}

req = urllib.request.Request(SEED_URL, headers=headers, method="POST")
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())
        print(f"✅ Success!")
        print(json.dumps(result, indent=2))
except Exception as e:
    print(f"❌ Error: {e}")
