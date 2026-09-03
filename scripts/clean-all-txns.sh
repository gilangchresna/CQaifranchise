#!/bin/bash
# Delete ALL remaining transactions

SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "=== DELETING all remaining transactions ==="
curl -s -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/delete-transactions" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"date_from": "2020-01-01", "dry_run": false}' | python3 -m json.tool

echo ""
echo "=== VERIFY: Check if database is clean ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
