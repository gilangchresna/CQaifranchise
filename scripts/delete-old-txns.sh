#!/bin/bash
# Delete all old bad transactions (before today)

SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "=== Checking transactions to delete ==="
echo ""
echo "Deleting transactions before: 2026-09-03"
echo ""

# Dry run first
curl -s -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/delete-transactions" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"date_from": "2026-08-28", "dry_run": true}' | python3 -m json.tool

echo ""
echo "=== To DELETE, run this manually ==="
echo 'curl -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/delete-transactions" \'
echo '  -H "Authorization: Bearer ***" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d "{\"date_from\": \"2026-08-28\", \"dry_run\": false}"'
