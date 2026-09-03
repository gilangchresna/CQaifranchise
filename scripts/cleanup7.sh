#!/bin/bash
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')
for date in 2026-07-14 2026-07-13 2026-07-12 2026-07-11 2026-07-10 2026-07-09 2026-07-08 2026-07-07 2026-07-06 2026-07-05 2026-07-04 2026-07-03 2026-07-02 2026-07-01 2026-06-30 2026-06-29 2026-06-28 2026-06-27 2026-06-26; do
  curl -s -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/delete-transactions" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"date_from\": \"${date}T00:00:00\", \"dry_run\": false}" | python3 -m json.tool
  sleep 0.3
done
echo "Check:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
