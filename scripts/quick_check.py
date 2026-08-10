import urllib.request, json

env = {}
for line in open("/Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise/.env.local"):
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

print("=== REGIONS ===")
data = get(f"{base}/rest/v1/regions?select=id,code,name,currency_code")
for r in data:
    print(f"  {r}")

print()
print("=== SALES TX with COST ===")
data2 = get(f"{base}/rest/v1/sales_transactions?select=date,amount,cost,outlet_id&order=date.desc&limit=5")
for t in data2:
    print(f"  {t}")
