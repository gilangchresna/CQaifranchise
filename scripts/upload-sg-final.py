#!/usr/bin/env python3
"""Upload SG transactions - reads key from .env.local"""
import json
import subprocess
import os

# Read service role key from .env.local
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
service_key = None

with open(env_path, 'r') as f:
    for line in f:
        if 'SUPABASE_SERVICE_ROLE_KEY' in line:
            service_key = line.split('=', 1)[1].strip().strip('"')
            break

if not service_key:
    print("ERROR: Could not find SUPABASE_SERVICE_ROLE_KEY in .env.local")
    exit(1)

print(f"Using key starting with: {service_key[:30]}...")

with open("sg_txns_60d.json", "r") as f:
    transactions = json.load(f)

print(f"📤 Uploading {len(transactions)} transactions...")

chunk_size = 500
chunks = [transactions[i:i+chunk_size] for i in range(0, len(transactions), chunk_size)]
print(f"Total chunks: {len(chunks)}")

for i, chunk in enumerate(chunks):
    with open(f"tmp_chunk_{i}.json", "w") as f:
        json.dump(chunk, f)
    
    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions",
        "-H", f"apikey: {service_key}",
        "-H", f"Authorization: Bearer {service_key}",
        "-H", "Content-Type: application/json",
        "-H", "Prefer: resolution=merge-duplicates",
        "-d", f"@tmp_chunk_{i}.json"
    ], capture_output=True, text=True, timeout=60)
    
    if "error" in result.stdout.lower() or "could not" in result.stdout.lower() or result.stdout == '':
        # Try edge function approach
        result = subprocess.run([
            "curl", "-s", "-X", "POST",
            "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/bulk-insert",
            "-H", f"Authorization: Bearer {service_key}",
            "-H", "Content-Type: application/json",
            "-d", f"@tmp_chunk_{i}.json"
        ], capture_output=True, text=True, timeout=60)
    
    print(f"Chunk {i+1}/{len(chunks)}: {result.stdout[:60] if result.stdout else 'EMPTY'}")
    subprocess.run(["rm", f"tmp_chunk_{i}.json"], check=False)

print("\n✅ Done!")
