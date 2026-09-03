#!/bin/bash
# Delete test transactions from 21:30 onwards today

SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "=== Deleting test transactions from 21:30 ==="
curl -s -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/delete-transactions" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"date_from": "2026-09-03T21:30:00", "dry_run": false}' | python3 -m json.tool
