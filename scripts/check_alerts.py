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

print("=== ALERTS SAMPLE (5) ===")
try:
    data = get(f"{base}/rest/v1/alerts?select=id,type,severity,status,title,created_at&order=created_at.desc&limit=5")
    print(f"Count: {len(data)}")
    for a in data:
        print(f"  id={a.get('id')} type={a.get('type')} sev={a.get('severity')} status={a.get('status')} title={a.get('title')}")
except Exception as e:
    print(f"Error: {e}")

print()
print("=== TOTAL ALERTS ===")
try:
    req = urllib.request.Request(f"{base}/rest/v1/alerts?select=id&limit=1")
    req.add_header("apikey", ANON)
    req.add_header("Authorization", f"Bearer {ANON}")
    req.add_header("Prefer", "count=exact")
    with urllib.request.urlopen(req, timeout=10) as r:
        print(f"Response headers: {dict(r.headers)}")
        raw = r.read().decode()
        print(f"Body: {raw[:500]}")
except Exception as e:
    print(f"Error: {e}")
