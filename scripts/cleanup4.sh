#!/bin/bash
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')
for date in 2026-08-13 2026-08-12 2026-08-11 2026-08-10 2026-08-09 2026-08-08 2026-08-07 2026-08-06 2026-08-05 2026-08-04 2026-08-03 2026-08-02 2026-08-01; do
  echo "Deleting $date..."
  curl -s -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/delete-transactions" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"date_from\": \"${date}T00:00:00\", \"dry_run\": false}" | python3 -m json.tool
  sleep 0.5
done
echo "Done!"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
