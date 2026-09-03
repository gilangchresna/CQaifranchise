#!/bin/bash
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" ../.env.local | cut -d= -f2 | tr -d '"')

echo "=== Total SGD ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?currency_code=eq.SGD&select=id" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; print('Total SGD:', len(json.load(sys.stdin)))"

echo ""
echo "=== Summary by date range ==="
for range in "2026-01" "2026-02" "2026-03" "2026-06" "2026-07" "2026-08" "2026-09"; do
  count=$(curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?currency_code=eq.SGD&date=like.${range}*&select=id" \
    -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  echo "${range}: ${count} txns"
done
