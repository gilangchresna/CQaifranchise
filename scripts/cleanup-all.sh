#!/bin/bash
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')
for date in 2026-08-25 2026-08-24 2026-08-23 2026-08-22 2026-08-21 2026-08-20 2026-08-19 2026-09-03; do
  echo "Deleting from $date..."
  curl -s -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/delete-transactions" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"date_from\": \"${date}T00:00:00\", \"dry_run\": false}" | python3 -m json.tool
  sleep 1
done
echo "Done! Remaining:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
