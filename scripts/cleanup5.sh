#!/bin/bash
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')
for date in 2026-07-25 2026-07-24 2026-07-23 2026-07-22 2026-07-21 2026-07-20 2026-07-19 2026-07-18 2026-07-17 2026-07-16 2026-07-15; do
  echo "Deleting from $date..."
  curl -s -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/delete-transactions" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"date_from\": \"${date}T00:00:00\", \"dry_run\": false}" | python3 -m json.tool
  sleep 0.5
done
echo "Final check:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
