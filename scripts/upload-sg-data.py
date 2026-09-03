#!/usr/bin/env python3
"""Upload SG transactions to Supabase via REST API"""
import json
import subprocess
import time

SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzMjU3MzIwMCwiZXhwIjoxOTQ4MTQ4NjAwfQ.9MmmYhYrlN3qJ3H8xH2y8hZn9qY3r5bJk5X7vJ5ZqE"  # anon key for upload

# Load transactions
with open("sg_txns_60d.json", "r") as f:
    transactions = json.load(f)

print(f"📤 Uploading {len(transactions)} transactions...")
print(f"Splitting into chunks of 500...")

# Split into chunks
chunk_size = 500
chunks = [transactions[i:i+chunk_size] for i in range(0, len(transactions), chunk_size)]
print(f"Total chunks: {len(chunks)}")

# Upload each chunk
for i, chunk in enumerate(chunks):
    print(f"\nChunk {i+1}/{len(chunks)} ({len(chunk)} txns)...")
    
    # Write chunk to temp file
    with open(f"chunk_{i}.json", "w") as f:
        json.dump(chunk, f)
    
    # Upload via curl
    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions",
        "-H", f"apikey: {SERVICE_KEY}",
        "-H", f"Authorization: Bearer {SERVICE_KEY}",
        "-H", "Content-Type: application/json",
        "-H", "Prefer: resolution=merge-duplicates",
        "-d", f"@chunk_{i}.json"
    ], capture_output=True, text=True, timeout=60)
    
    # Check result
    if "error" in result.stdout.lower() or "could not" in result.stdout.lower():
        print(f"  ⚠️ {result.stdout[:100]}")
    else:
        print(f"  ✅ Uploaded")
    
    # Clean up
    subprocess.run(["rm", f"chunk_{i}.json"], check=False)
    
    # Small delay to avoid rate limit
    if (i + 1) % 10 == 0:
        time.sleep(1)

print("\n✅ Done!")
