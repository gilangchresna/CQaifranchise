import urllib.request
import json
import os

key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

req = urllib.request.Request(
    "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/executor-cron",
    data=b"{}",
    headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode()
        print(f"HTTP {resp.status}")
        print(f"Response: {body}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode()}")
except Exception as e:
    print(f"Error: {e}")
