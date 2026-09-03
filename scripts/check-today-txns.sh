#!/bin/bash
# Delete today's bad transactions using direct REST API

SUPABASE_URL="https://ploqeifazcgzwjzmukgp.supabase.co"
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "=== Checking today's data count ==="
curl -s "${SUPABASE_URL}/rest/v1/rpc/count_today_txns" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool 2>/dev/null || echo "RPC not found, checking manually..."

echo ""
echo "=== Checking with filter ==="
curl -s "${SUPABASE_URL}/rest/v1/sales_transactions?date=gte.2026-09-03&select=id,amount,currency_code&limit=5" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Counting today's records ==="
curl -s "${SUPABASE_URL}/rest/v1/sales_transactions?date=gte.2026-09-03&select=id" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Prefer: count=exact" | head -1

echo ""
echo "=== If you want to DELETE, uncomment the line below and run again ==="
echo "# curl -X DELETE ... (supabase.rest does not allow DELETE via REST)"
echo ""
echo "To delete via Supabase Dashboard:"
echo "1. Go to https://supabase.com/dashboard/project/ploqeifazcgzwjzmukgp/table editor"
echo "2. Select sales_transactions table"
echo "3. Filter: date >= 2026-09-03"
echo "4. Click Delete Rows"
