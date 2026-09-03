#!/bin/bash
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" ../.env.local | cut -d= -f2 | tr -d '"')

echo "=== Count by currency ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?currency_code=eq.IDR&select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" --total | head -1

echo ""
echo "=== Total transactions ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" --total | head -1
