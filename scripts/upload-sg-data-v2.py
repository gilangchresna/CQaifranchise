#!/usr/bin/env python3
"""Upload SG transactions to Supabase via REST API - SERVICE ROLE"""
import json
import subprocess
import time

# Service role key (full access)
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjMyNTczMjAwLCJleHAiOjE5NDgxNDg2MDB9.7x8k5w9Z3qR2t6Y4hL8mB1vN0cF5dE7sP2kJ9xT4gU8"

# Load transactions
with open("sg_txns_60d.json", "r") as f:
    transactions = json.load(f)

print(f"📤 Uploading {len(transactions)} transactions with SERVICE ROLE...")
print(f"Splitting into chunks of 500...")

chunk_size = 500
chunks = [transactions[i:i+chunk_size] for i in range(0, len(transactions), chunk_size)]
print(f"Total chunks: {len(chunks)}")

for i, chunk in enumerate(chunks):
    print(f"\nChunk {i+1}/{len(chunks)} ({len(chunk)} txns)...")
    
    with open(f"chunk_{i}.json", "w") as f:
        json.dump(chunk, f)
    
    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions",
        "-H", f"apikey: {SERVICE_KEY}",
        "-H", f"Authorization: Bearer {SERVICE_KEY}",
        "-H", "Content-Type: application/json",
        "-H", "Prefer: resolution=merge-duplicates",
        "-d", f"@chunk_{i}.json"
    ], capture_output=True, text=True, timeout=60)
    
    if "error" in result.stdout.lower() or "could not" in result.stdout.lower():
        print(f"  ⚠️ {result.stdout[:100]}")
    else:
        print(f"  ✅ Uploaded")
    
    subprocess.run(["rm", f"chunk_{i}.json"], check=False)
    
    if (i + 1) % 10 == 0:
        time.sleep(1)

print("\n✅ Done!")
