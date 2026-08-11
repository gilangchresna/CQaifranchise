#!/usr/bin/env python3
"""
Seed regions + outlets via REST API (service role)
"""
import json, os, urllib.request, urllib.error

source = open(".env.local")
for line in source:
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        os.environ[k] = v
source.close()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

def api_get(path):
    url = f"{SUPABASE_URL}/rest/v1{path}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  GET {path} → {e.code}: {e.read().decode()[:200]}")
        return []

def api_post(path, payload):
    url = f"{SUPABASE_URL}/rest/v1{path}"
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"  Inserted: {r.status}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  POST {path} → {e.code}: {e.read().decode()[:300]}")
        return False

# ── Regions ──────────────────────────────────────────────────────────────────
REGIONS = [
    {"name": "Singapore",  "code": "SG",  "description": "Singapore, Singapore"},
    {"name": "Jakarta",     "code": "JKT", "description": "Jakarta, Indonesia"},
    {"name": "Bandung",     "code": "BDG", "description": "Bandung, Indonesia"},
    {"name": "Surabaya",    "code": "SBY", "description": "Surabaya, Indonesia"},
    {"name": "Kuala Lumpur","code": "KUL", "description": "Kuala Lumpur, Malaysia"},
    {"name": "Bangkok",     "code": "BKK", "description": "Bangkok, Thailand"},
]

print("Seeding regions...")
for r in REGIONS:
    api_post("/rest/v1/regions", r)

# Fetch region IDs
regions = api_get("/regions?select=id,name,code")
region_map = {r["code"]: r["id"] for r in regions}
print(f"  Regions: {region_map}")

# ── Outlets ──────────────────────────────────────────────────────────────────
OUTLETS = [
    # Singapore
    {"code": "SG-001", "name": "SG Marina Bay",        "region_code": "SG",  "city": "Singapore",    "status": "active",   "daily_target": 5000},
    {"code": "SG-002", "name": "SG Orchard",           "region_code": "SG",  "city": "Singapore",    "status": "active",   "daily_target": 6500},
    {"code": "SG-003", "name": "SG Changi",            "region_code": "SG",  "city": "Singapore",    "status": "active",   "daily_target": 8000},
    # Jakarta
    {"code": "JKT-001","name": "JKT Sudirman",         "region_code": "JKT", "city": "Jakarta",     "status": "active",   "daily_target": 35000000},
    {"code": "JKT-002","name": "JKT Thamrin",          "region_code": "JKT", "city": "Jakarta",     "status": "active",   "daily_target": 40000000},
    {"code": "JKT-003","name": "JKT Blok M",           "region_code": "JKT", "city": "Jakarta",     "status": "active",   "daily_target": 25000000},
    # Bandung
    {"code": "BDG-001","name": "BDG Braga",              "region_code": "BDG", "city": "Bandung",     "status": "active",   "daily_target": 15000000},
    {"code": "BDG-002","name": "BDG Dago",              "region_code": "BDG", "city": "Bandung",     "status": "active",   "daily_target": 12000000},
    # Surabaya
    {"code": "SBY-001","name": "SBY Tunjungan",         "region_code": "SBY", "city": "Surabaya",    "status": "active",   "daily_target": 20000000},
    {"code": "SBY-002","name": "SBY Pakuwon",           "region_code": "SBY", "city": "Surabaya",    "status": "active",   "daily_target": 22000000},
    # Kuala Lumpur
    {"code": "KUL-001","name": "KUL Bukit Bintang",    "region_code": "KUL", "city": "Kuala Lumpur", "status": "active",  "daily_target": 35000},
    {"code": "KUL-002","name": "KUL Pavilion",          "region_code": "KUL", "city": "Kuala Lumpur", "status": "active",  "daily_target": 45000},
    # Bangkok
    {"code": "BKK-001","name": "BKK Siam",              "region_code": "BKK", "city": "Bangkok",     "status": "active",   "daily_target": 55000},
    {"code": "BKK-002","name": "BKK Silom",             "region_code": "BKK", "city": "Bangkok",     "status": "active",   "daily_target": 48000},
]

print(f"\nSeeding {len(OUTLETS)} outlets...")
outlet_ids = {}
for o in OUTLETS:
    rid = region_map.get(o.pop("region_code"))
    row = {**o, "region_id": rid}
    ok = api_post("/rest/v1/outlets", row)
    if ok:
        print(f"  ✅ {row['code']} - {row['name']}")

# Fetch inserted outlet IDs
outlets = api_get("/outlets?select=id,code,name,region_id")
outlet_ids = {o["code"]: o["id"] for o in outlets}
print(f"\n✅ Outlets seeded: {len(outlet_ids)}")
print("Outlet IDs:", outlet_ids)
