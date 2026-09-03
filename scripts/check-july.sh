#!/bin/bash
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" ../.env.local | cut -d= -f2 | tr -d '"')

echo "=== July onwards ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?currency_code=eq.SGD&date=gte.2026-07-01&select=date&limit=5000" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
data=json.load(sys.stdin)
dates=sorted(set(d['date'] for d in data))
print('July+ dates:', len(dates))
for d in dates: print(' ', d)
"

echo ""
echo "=== July count ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?currency_code=eq.SGD&date=gte.2026-07-01&select=id" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; print('July+ txns:', len(json.load(sys.stdin)))"
