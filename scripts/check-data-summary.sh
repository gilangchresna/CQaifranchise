#!/bin/bash
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" ../.env.local | cut -d= -f2 | tr -d '"')
echo "=== Transaction Summary ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/rpc/summary_stats" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool 2>/dev/null || echo "RPC not available"

echo ""
echo "=== Sample transactions by outlet ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=outlet_id,amount,currency_code&order=id.desc&limit=20" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
