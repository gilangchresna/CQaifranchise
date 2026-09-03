#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Deleting today's transactions (2026-09-03) ==="
curl -s -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/delete-transactions" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"date_from": "2026-09-03T00:00:00", "dry_run": false}' | python3 -m json.tool

echo ""
echo "=== Verify deletion ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=eq.2026-09-03&select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}"
