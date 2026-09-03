#!/bin/bash
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" ../.env.local | cut -d= -f2 | tr -d '"')
echo "=== Database Status ==="
echo "Total transactions:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"

echo ""
echo "SGD transactions:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?currency_code=eq.SGD&select=id" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"

echo ""
echo "Sample SGD amounts:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?currency_code=eq.SGD&select=amount&order=id.desc&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
