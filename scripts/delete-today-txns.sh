#!/bin/bash
# Delete today's bad transactions

SUPABASE_URL="https://ploqeifazcgzwjzmukgp.supabase.co"
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "=== DRY RUN: Checking how many to delete ==="
curl -s -X POST "${SUPABASE_URL}/functions/v1/delete-transactions" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "date_from": "2026-09-03",
    "dry_run": true
  }' | python3 -m json.tool

echo ""
echo "=== ACTUAL DELETE: Press Ctrl+C to cancel, or wait 5 seconds ==="
sleep 5

echo ""
echo "=== DELETING... ==="
curl -s -X POST "${SUPABASE_URL}/functions/v1/delete-transactions" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "date_from": "2026-09-03",
    "dry_run": false
  }' | python3 -m json.tool

echo ""
echo "=== VERIFY: Checking remaining ==="
curl -s "${SUPABASE_URL}/rest/v1/sales_transactions?date=gte.2026-09-03&select=id&limit=5" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
